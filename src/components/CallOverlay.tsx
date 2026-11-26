import { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
} from 'lucide-react';
import { CallSession, CallType, UserProfile } from '../types/social';
import { Translations } from '../lib/i18n';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  addFirestoreCallCandidate,
  answerFirestoreCallSession,
  createFirestoreCallSession,
  updateFirestoreCallStatus,
} from '../lib/firestoreSocial';
import { Avatar } from './Avatar';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface OutgoingCallDraft {
  peer: UserProfile;
  callType: CallType;
}

interface CallOverlayProps {
  currentUserId: string;
  currentUserName: string;
  outgoingCall: OutgoingCallDraft | null;
  incomingCall: CallSession | null;
  users: UserProfile[];
  t: Translations;
  onClose: (statusMessage?: string) => void;
}

export function CallOverlay({
  currentUserId,
  currentUserName,
  outgoingCall,
  incomingCall,
  users,
  t,
  onClose,
}: CallOverlayProps) {
  const isOutgoing = Boolean(outgoingCall);
  const callType: CallType =
    outgoingCall?.callType ?? incomingCall?.callType ?? 'audio';
  const peerId = outgoingCall?.peer.id ?? incomingCall?.callerId ?? '';
  const peerProfile = users.find((u) => u.id === peerId) ?? outgoingCall?.peer;
  const peerName =
    peerProfile?.name ?? incomingCall?.callerName ?? 'World Connection Member';

  const [phase, setPhase] = useState<
    'ringing_in' | 'calling_out' | 'connecting' | 'connected'
  >(isOutgoing ? 'calling_out' : 'ringing_in');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(incomingCall?.id ?? null);
  const remoteDescSetRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const seenCandidateIdsRef = useRef<Set<string>>(new Set());
  const unsubsRef = useRef<Array<() => void>>([]);
  const closedRef = useRef(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const cleanupMediaAndRtc = () => {
    for (const unsub of unsubsRef.current) {
      unsub();
    }
    unsubsRef.current = [];

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
  };

  const finishCall = async (
    targetStatus: 'ended' | 'declined',
    toastMessage?: string,
  ) => {
    if (closedRef.current) return;
    closedRef.current = true;
    const id = callIdRef.current;
    cleanupMediaAndRtc();
    if (id) {
      await updateFirestoreCallStatus({ callId: id, status: targetStatus });
    }
    onClose(toastMessage);
  };

  // Gentle incoming ringtone using Web Audio API while ringing_in
  useEffect(() => {
    if (phase !== 'ringing_in') return;
    let ctx: AudioContext | null = null;
    let intervalId: number | null = null;

    const ringOnce = () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        if (!ctx) ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      } catch {
        // Ignore audio autoplay blocks
      }
    };

    ringOnce();
    intervalId = window.setInterval(ringOnce, 2200);

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      if (ctx) {
        ctx.close().catch(() => {});
      }
    };
  }, [phase]);

  // Call duration timer when connected
  useEffect(() => {
    if (phase !== 'connected') return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const attachStreamsToElements = () => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteStreamRef.current) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
    }
  };

  useEffect(() => {
    attachStreamsToElements();
  }, [phase, callType]);

  const createPeerConnection = (
    callId: string,
    role: 'caller' | 'callee',
    remoteUid: string,
    localStream: MediaStream,
  ) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    pc.ontrack = (event) => {
      for (const stream of event.streams) {
        for (const track of stream.getTracks()) {
          remoteStream.addTrack(track);
        }
      }
      if (event.track && !remoteStream.getTracks().includes(event.track)) {
        remoteStream.addTrack(event.track);
      }
      attachStreamsToElements();
      setPhase('connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setPhase('connected');
      } else if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        void finishCall('ended', t.callEndedStatus);
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || closedRef.current) return;
      void addFirestoreCallCandidate({
        callId,
        role,
        senderId: currentUserId,
        recipientId: remoteUid,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid ?? '',
        sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
      });
    };

    attachStreamsToElements();
    return pc;
  };

  const subscribeToCallSignaling = (
    callId: string,
    pc: RTCPeerConnection,
    remoteCandidateSub: 'callerCandidates' | 'calleeCandidates',
  ) => {
    const callUnsub = onSnapshot(
      doc(db, 'calls', callId),
      (snap) => {
        if (!snap.exists() || closedRef.current) return;
        const data = snap.data();
        const status = String(data.status ?? '');

        if (status === 'declined') {
          closedRef.current = true;
          cleanupMediaAndRtc();
          onClose(t.callDeclinedStatus);
          return;
        }
        if (status === 'ended') {
          closedRef.current = true;
          cleanupMediaAndRtc();
          onClose(t.callEndedStatus);
          return;
        }

        if (
          isOutgoing &&
          typeof data.answerSdp === 'string' &&
          data.answerSdp.length > 0 &&
          !remoteDescSetRef.current
        ) {
          remoteDescSetRef.current = true;
          setPhase('connecting');
          pc.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp }),
          )
            .then(async () => {
              for (const cand of pendingCandidatesRef.current) {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
              pendingCandidatesRef.current = [];
            })
            .catch(() => {});
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `calls/${callId}`);
      },
    );

    const candUnsub = onSnapshot(
      query(
        collection(db, 'calls', callId, remoteCandidateSub),
        where('recipientId', '==', currentUserId),
      ),
      (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type !== 'added') continue;
          if (seenCandidateIdsRef.current.has(change.doc.id)) continue;
          seenCandidateIdsRef.current.add(change.doc.id);

          const d = change.doc.data();
          const candInit: RTCIceCandidateInit = {
            candidate: String(d.candidate ?? ''),
            sdpMid: String(d.sdpMid ?? ''),
            sdpMLineIndex: Number(d.sdpMLineIndex ?? 0),
          };
          if (remoteDescSetRef.current) {
            pc.addIceCandidate(new RTCIceCandidate(candInit)).catch(() => {});
          } else {
            pendingCandidatesRef.current.push(candInit);
          }
        }
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `calls/${callId}/${remoteCandidateSub}`,
        );
      },
    );

    unsubsRef.current.push(callUnsub, candUnsub);
  };

  // Start outgoing call automatically on mount
  useEffect(() => {
    if (!outgoingCall) return;
    let active = true;

    const startOutgoing = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video:
            outgoingCall.callType === 'video'
              ? { facingMode: 'user' }
              : false,
        });
        if (!active || closedRef.current) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        localStreamRef.current = stream;

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;
        const remoteStream = new MediaStream();
        remoteStreamRef.current = remoteStream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          for (const s of event.streams) {
            s.getTracks().forEach((tr) => remoteStream.addTrack(tr));
          }
          if (event.track && !remoteStream.getTracks().includes(event.track)) {
            remoteStream.addTrack(event.track);
          }
          attachStreamsToElements();
          setPhase('connected');
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') setPhase('connected');
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            void finishCall('ended', t.callEndedStatus);
          }
        };

        attachStreamsToElements();

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const callId = await createFirestoreCallSession({
          callerId: currentUserId,
          callerName: currentUserName,
          calleeId: outgoingCall.peer.id,
          calleeName: outgoingCall.peer.name,
          callType: outgoingCall.callType,
          offerSdp: offer.sdp ?? '',
        });

        if (!active || closedRef.current) {
          await updateFirestoreCallStatus({ callId, status: 'ended' });
          return;
        }

        callIdRef.current = callId;
        pc.onicecandidate = (event) => {
          if (!event.candidate || closedRef.current) return;
          void addFirestoreCallCandidate({
            callId,
            role: 'caller',
            senderId: currentUserId,
            recipientId: outgoingCall.peer.id,
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid ?? '',
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
          });
        };

        subscribeToCallSignaling(callId, pc, 'calleeCandidates');
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err instanceof Error && err.name === 'NotAllowedError'
            ? outgoingCall.callType === 'video'
              ? t.camPermissionErr
              : t.micPermissionErr
            : outgoingCall.callType === 'video'
              ? t.camPermissionErr
              : t.micPermissionErr,
        );
      }
    };

    void startOutgoing();

    return () => {
      active = false;
      cleanupMediaAndRtc();
    };
  }, []);

  // Watch incoming call status while ringing so if caller cancels, overlay closes
  useEffect(() => {
    if (!incomingCall) return;
    const unsub = onSnapshot(doc(db, 'calls', incomingCall.id), (snap) => {
      if (!snap.exists() || closedRef.current) return;
      const st = String(snap.data().status ?? '');
      if (st === 'ended' || st === 'declined') {
        closedRef.current = true;
        cleanupMediaAndRtc();
        onClose(t.callEndedStatus);
      }
    });
    return () => unsub();
  }, [incomingCall?.id]);

  const handleAnswerIncoming = async () => {
    if (!incomingCall || phase !== 'ringing_in') return;
    setPhase('connecting');
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video:
          incomingCall.callType === 'video' ? { facingMode: 'user' } : false,
      });
      if (closedRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      localStreamRef.current = stream;

      const pc = createPeerConnection(
        incomingCall.id,
        'callee',
        incomingCall.callerId,
        stream,
      );

      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: 'offer',
          sdp: incomingCall.offerSdp,
        }),
      );
      remoteDescSetRef.current = true;

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      subscribeToCallSignaling(incomingCall.id, pc, 'callerCandidates');

      await answerFirestoreCallSession({
        callId: incomingCall.id,
        answerSdp: answer.sdp ?? '',
      });
    } catch {
      setErrorMsg(
        incomingCall.callType === 'video'
          ? t.camPermissionErr
          : t.micPermissionErr,
      );
    }
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    setMuted(nextMuted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !camOff;
    for (const track of stream.getVideoTracks()) {
      track.enabled = !nextOff;
    }
    setCamOff(nextOff);
  };

  const flipCamera = async () => {
    if (callType !== 'video' || !pcRef.current || !localStreamRef.current) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const sender = pcRef.current
        .getSenders()
        .find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      for (const oldTrack of localStreamRef.current.getVideoTracks()) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }
      localStreamRef.current.addTrack(newVideoTrack);
      attachStreamsToElements();
      setFacingMode(nextFacing);
    } catch {
      // Ignore if device only has one camera
    }
  };

  const statusText =
    phase === 'ringing_in'
      ? callType === 'video'
        ? t.incomingVideoCall
        : t.incomingAudioCall
      : phase === 'calling_out'
        ? t.callingStatus
        : phase === 'connecting'
          ? t.connectingCallStatus
          : `${t.connectedCallStatus} · ${formatDuration(elapsedSec)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={peerName}
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden"
    >
      {/* Hidden audio output element for audio & video streams */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Video Call Remote Stream Stage */}
      {callType === 'video' && phase !== 'ringing_in' ? (
        <div className="absolute inset-0 bg-slate-950">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/65 pointer-events-none" />
          {/* PiP Local Video */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute top-20 right-4 w-28 sm:w-36 aspect-[3/4] rounded-2xl object-cover border border-white/25 bg-slate-900 shadow-xl ${
              camOff ? 'opacity-25' : 'opacity-100'
            }`}
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950" />
      )}

      {/* Top Call Header */}
      <div className="relative z-10 pt-8 px-6 text-center space-y-1.5">
        <p className="text-xs font-semibold text-emerald-300 tracking-wide">
          {callType === 'video' ? t.videoCallBtn : t.audioCallBtn}
        </p>
        <h2 className="font-display text-2xl font-bold text-white truncate max-w-md mx-auto">
          {peerName}
        </h2>
        <p className="text-sm text-slate-200 tabular-nums">{statusText}</p>
      </div>

      {/* Center Avatar for Audio Call or Ringing State */}
      {(callType === 'audio' || phase === 'ringing_in') && (
        <div className="relative z-10 flex flex-col items-center justify-center px-6">
          <div className="p-2 rounded-full border border-emerald-500/40 bg-emerald-900/30">
            <Avatar name={peerName} src={peerProfile?.avatarUrl} size="xl" />
          </div>
          {errorMsg && (
            <p className="mt-5 max-w-sm text-center text-sm text-rose-300 bg-rose-950/70 border border-rose-700/60 rounded-2xl px-4 py-3">
              {errorMsg}
            </p>
          )}
        </div>
      )}

      {/* Error Banner for Video Call */}
      {callType === 'video' && phase !== 'ringing_in' && errorMsg && (
        <div className="relative z-10 mx-auto max-w-sm px-4">
          <p className="text-center text-sm text-rose-200 bg-rose-950/85 border border-rose-700 rounded-2xl px-4 py-3">
            {errorMsg}
          </p>
        </div>
      )}

      {/* Bottom Controls Dock */}
      <div className="relative z-10 pb-10 pt-6 px-6 flex items-center justify-center gap-5">
        {phase === 'ringing_in' ? (
          <>
            <button
              type="button"
              onClick={() => void finishCall('declined', t.callDeclinedStatus)}
              aria-label={t.declineCallBtn}
              className="flex flex-col items-center gap-2"
            >
              <span className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center shadow-lg transition-colors">
                <PhoneOff className="w-7 h-7" />
              </span>
              <span className="text-xs font-medium text-slate-200">
                {t.declineCallBtn}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handleAnswerIncoming()}
              aria-label={t.answerCallBtn}
              className="flex flex-col items-center gap-2"
            >
              <span className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center shadow-lg transition-colors">
                {callType === 'video' ? (
                  <Video className="w-7 h-7" />
                ) : (
                  <Phone className="w-7 h-7" />
                )}
              </span>
              <span className="text-xs font-medium text-slate-200">
                {t.answerCallBtn}
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t.unmuteMicBtn : t.muteMicBtn}
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className={`w-13 h-13 rounded-full flex items-center justify-center transition-colors ${
                  muted
                    ? 'bg-white text-slate-900'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                {muted ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </span>
              <span className="text-[11px] text-slate-200">
                {muted ? t.unmuteMicBtn : t.muteMicBtn}
              </span>
            </button>

            {callType === 'video' && (
              <>
                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-label={camOff ? t.cameraOnBtn : t.cameraOffBtn}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={`w-13 h-13 rounded-full flex items-center justify-center transition-colors ${
                      camOff
                        ? 'bg-white text-slate-900'
                        : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                  >
                    {camOff ? (
                      <VideoOff className="w-5 h-5" />
                    ) : (
                      <Video className="w-5 h-5" />
                    )}
                  </span>
                  <span className="text-[11px] text-slate-200">
                    {camOff ? t.cameraOnBtn : t.cameraOffBtn}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void flipCamera()}
                  aria-label={t.flipCameraBtn}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="w-13 h-13 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
                    <RefreshCw className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] text-slate-200">
                    {t.flipCameraBtn}
                  </span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void finishCall('ended', t.callEndedStatus)}
              aria-label={t.endCallBtn}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transition-colors">
                <PhoneOff className="w-6 h-6" />
              </span>
              <span className="text-[11px] text-slate-200">{t.endCallBtn}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
