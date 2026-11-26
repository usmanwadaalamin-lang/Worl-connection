import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Captions,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  ImagePlus,
  Languages,
  Link2,
  Loader2,
  Lock,
  Megaphone,
  MessageSquarePlus,
  Mic,
  Phone,
  Plus,
  ReceiptText,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import {
  ActiveConversation,
  CallType,
  ChannelPostItem,
  ChannelRoom,
  ChannelVipReceipt,
  ChatMessage,
  ChatThreadSummary,
  GroupMessageItem,
  GroupRoom,
  UserProfile,
} from '../types/social';
import { Avatar } from './Avatar';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import {
  buildRoomInviteLink,
  copyTextToClipboard,
  getCachedShortInviteLink,
  RoomInviteKind,
  shareOrCopyInviteLink,
  shortenRoomInviteLink,
} from '../lib/inviteLinks';
import {
  extractReadableError,
  queryDeepThink,
  summarizeChatRoom,
  transcribeVoiceNote,
  translateChatMessage,
  TranslationTarget,
} from '../lib/thinkApi';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  compressReceiptImage,
  formatFirestoreTime,
  markDirectMessagesRead,
  markRoomReadCursor,
  pruneExpiredChannelVipMembers,
  publishFirestoreChannelPost,
  sendFirestoreDirectMessage,
  sendFirestoreGroupMessage,
  submitChannelVipReceipt,
  upsertGroupReadReceipt,
  VoiceNotePayload,
} from '../lib/firestoreSocial';
import { Language, Translations } from '../lib/i18n';
import { RoomModalMode } from './CreateRoomModal';

interface ChatViewProps {
  users: UserProfile[];
  currentUser: UserProfile;
  currentUserId: string;
  currentUserName: string;
  language: Language;
  dmThreads: ChatThreadSummary[];
  groups: GroupRoom[];
  channels: ChannelRoom[];
  followedChannelIds: Set<string>;
  readSeqByRoom: Map<string, number>;
  activeConversation: ActiveConversation;
  mobileThreadOpen: boolean;
  deepThinkMessages: ChatMessage[];
  t: Translations;
  onSelectConversation: (conv: ActiveConversation, openMobile?: boolean) => void;
  onCloseMobileThread: () => void;
  onAddDeepThinkMessage: (msg: ChatMessage) => void;
  onOpenRoomModal: (mode: RoomModalMode, group?: GroupRoom) => void;
  onOpenVipManager: (channel: ChannelRoom) => void;
  onToggleFollowChannel: (channelId: string, currentlyFollowing: boolean) => void;
  onStartCall: (peer: UserProfile, callType: CallType) => void;
  onShowToast?: (msg: string) => void;
}

type ChatFilter = 'all' | 'private' | 'groups' | 'channels';

const TRANSLATION_TARGETS: Array<{ code: TranslationTarget; label: string }> = [
  { code: 'Hausa', label: 'Hausa' },
  { code: 'English', label: 'English' },
  { code: 'Arabic', label: 'العربية' },
  { code: 'French', label: 'Français' },
];

interface FirestoreThreadMsg extends ChatMessage {
  ms: number;
}

export function ChatView({
  users,
  currentUser,
  currentUserId,
  currentUserName,
  language,
  dmThreads,
  groups,
  channels,
  followedChannelIds,
  readSeqByRoom,
  activeConversation,
  mobileThreadOpen,
  deepThinkMessages,
  t,
  onSelectConversation,
  onCloseMobileThread,
  onAddDeepThinkMessage,
  onOpenRoomModal,
  onOpenVipManager,
  onToggleFollowChannel,
  onStartCall,
  onShowToast,
}: ChatViewProps) {
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [sending, setSending] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordStartMsRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);

  const [dmMessages, setDmMessages] = useState<FirestoreThreadMsg[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessageItem[]>([]);
  const [channelPosts, setChannelPosts] = useState<ChannelPostItem[]>([]);
  const [vipDocState, setVipDocState] = useState<{
    loaded: boolean;
    exists: boolean;
    accessMode: 'monthly' | 'lifetime';
    expiresAtMs: number | null;
  }>({
    loaded: false,
    exists: false,
    accessMode: 'monthly',
    expiresAtMs: null,
  });
  const [vipNowMs, setVipNowMs] = useState<number>(() => Date.now());
  const [myVipReceipts, setMyVipReceipts] = useState<ChannelVipReceipt[]>([]);
  const [creatorPendingReceiptsCount, setCreatorPendingReceiptsCount] =
    useState(0);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptImage, setReceiptImage] = useState('');
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedVipInfo, setCopiedVipInfo] = useState(false);
  const [groupReadReceipts, setGroupReadReceipts] = useState<
    Map<string, number>
  >(() => new Map());
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  );
  const [openTranslateMsgId, setOpenTranslateMsgId] = useState<string | null>(
    null,
  );
  const [translatingMsgKey, setTranslatingMsgKey] = useState<string | null>(
    null,
  );
  const [translationsByMsgId, setTranslationsByMsgId] = useState<
    Record<string, { targetLanguage: TranslationTarget; text: string }>
  >({});
  const [translateErrorByMsgId, setTranslateErrorByMsgId] = useState<
    Record<string, string>
  >({});
  const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(
    null,
  );
  const [transcriptsByMsgId, setTranscriptsByMsgId] = useState<
    Record<string, string>
  >({});
  const [transcriptErrorByMsgId, setTranscriptErrorByMsgId] = useState<
    Record<string, string>
  >({});
  const [summarizingRoomKey, setSummarizingRoomKey] = useState<string | null>(
    null,
  );
  const [summaryByRoomKey, setSummaryByRoomKey] = useState<
    Record<string, { summary: string; messageCount: number }>
  >({});
  const [summaryErrorByRoomKey, setSummaryErrorByRoomKey] = useState<
    Record<string, string>
  >({});
  const [summaryOpenRoomKey, setSummaryOpenRoomKey] = useState<string | null>(
    null,
  );
  const [inviteBannerRoomKey, setInviteBannerRoomKey] = useState<string | null>(
    null,
  );
  const [copiedInviteRoomKey, setCopiedInviteRoomKey] = useState<string | null>(
    null,
  );
  const [shortInviteByRoomKey, setShortInviteByRoomKey] = useState<
    Record<string, string>
  >({});
  const [shorteningInviteRoomKey, setShorteningInviteRoomKey] = useState<
    string | null
  >(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktopViewport(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isThreadVisible = mobileThreadOpen || isDesktopViewport;

  const peers = useMemo(
    () => users.filter((u) => u.id !== currentUserId),
    [users, currentUserId],
  );

  const threadSummaryByPeer = useMemo(() => {
    const map = new Map<string, ChatThreadSummary>();
    for (const th of dmThreads) {
      map.set(th.peerId, th);
    }
    return map;
  }, [dmThreads]);

  const sortedPeers = useMemo(() => {
    return [...peers].sort((a, b) => {
      const ta = threadSummaryByPeer.get(a.id)?.updatedAtMs ?? 0;
      const tb = threadSummaryByPeer.get(b.id)?.updatedAtMs ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }, [peers, threadSummaryByPeer]);

  const activePeer =
    activeConversation.kind === 'dm'
      ? peers.find((u) => u.id === activeConversation.userId) ?? null
      : null;

  const activeGroup =
    activeConversation.kind === 'group'
      ? groups.find((g) => g.id === activeConversation.groupId) ?? null
      : null;

  const activeChannel =
    activeConversation.kind === 'channel'
      ? channels.find((c) => c.id === activeConversation.channelId) ?? null
      : null;

  // Listen to 1-on-1 Private Chat messages
  useEffect(() => {
    if (activeConversation.kind !== 'dm' || !activePeer) {
      setDmMessages([]);
      return;
    }

    const sorted = [currentUserId, activePeer.id].sort();
    const threadId = `${sorted[0]}_${sorted[1]}`;
    const path = `chats/${threadId}/messages`;

    let sentMap = new Map<string, FirestoreThreadMsg>();
    let receivedMap = new Map<string, FirestoreThreadMsg>();

    const syncMerged = () => {
      const merged = new Map<string, FirestoreThreadMsg>([
        ...sentMap,
        ...receivedMap,
      ]);
      const list = Array.from(merged.values()).sort((a, b) => a.ms - b.ms);
      setDmMessages(list);
    };

    const parseDoc = (
      id: string,
      data: Record<string, unknown>,
    ): FirestoreThreadMsg => {
      const ts = data.createdAt;
      const date = ts instanceof Timestamp ? ts.toDate() : new Date();
      return {
        id,
        sender: data.senderId === currentUserId ? 'me' : 'them',
        text: String(data.text ?? ''),
        read: Boolean(data.read),
        messageType: data.messageType === 'voice' ? 'voice' : 'text',
        audioData:
          typeof data.audioData === 'string' ? data.audioData : undefined,
        audioDuration:
          typeof data.audioDuration === 'number'
            ? data.audioDuration
            : undefined,
        timestamp: date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        ms: date.getTime(),
      };
    };

    const unsubSent = onSnapshot(
      query(
        collection(db, 'chats', threadId, 'messages'),
        where('senderId', '==', currentUserId),
      ),
      (snap) => {
        const next = new Map<string, FirestoreThreadMsg>();
        for (const d of snap.docs) {
          next.set(d.id, parseDoc(d.id, d.data()));
        }
        sentMap = next;
        syncMerged();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    const unsubReceived = onSnapshot(
      query(
        collection(db, 'chats', threadId, 'messages'),
        where('recipientId', '==', currentUserId),
      ),
      (snap) => {
        const next = new Map<string, FirestoreThreadMsg>();
        for (const d of snap.docs) {
          next.set(d.id, parseDoc(d.id, d.data()));
        }
        receivedMap = next;
        syncMerged();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [activeConversation, activePeer, currentUserId]);

  // Listen to Group Messages
  useEffect(() => {
    if (activeConversation.kind !== 'group' || !activeGroup) {
      setGroupMessages([]);
      return;
    }

    const groupId = activeGroup.id;
    const path = `groups/${groupId}/messages`;

    const unsub = onSnapshot(
      query(
        collection(db, 'groups', groupId, 'messages'),
        where('groupId', '==', groupId),
        where('visibleTo', 'array-contains', currentUserId),
      ),
      (snap) => {
        const list: GroupMessageItem[] = snap.docs.map((d) => {
          const data = d.data();
          const ts = data.createdAt;
          const date = ts instanceof Timestamp ? ts.toDate() : new Date();
          return {
            id: d.id,
            groupId,
            senderId: String(data.senderId ?? ''),
            senderName: String(data.senderName ?? 'Member'),
            text: String(data.text ?? ''),
            messageType: data.messageType === 'voice' ? 'voice' : 'text',
            audioData:
              typeof data.audioData === 'string' ? data.audioData : undefined,
            audioDuration:
              typeof data.audioDuration === 'number'
                ? data.audioDuration
                : undefined,
            timestamp: date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            ms: date.getTime(),
          };
        });
        list.sort((a, b) => a.ms - b.ms);
        setGroupMessages(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => unsub();
  }, [activeConversation, activeGroup, currentUserId]);

  // Listen to Group Read Receipts for sender checkmarks
  useEffect(() => {
    if (activeConversation.kind !== 'group' || !activeGroup) {
      setGroupReadReceipts(new Map());
      return;
    }

    const groupId = activeGroup.id;
    const path = `groups/${groupId}/readReceipts`;
    const unsub = onSnapshot(
      query(
        collection(db, 'groups', groupId, 'readReceipts'),
        where('groupId', '==', groupId),
        where('visibleTo', 'array-contains', currentUserId),
      ),
      (snap) => {
        const next = new Map<string, number>();
        for (const d of snap.docs) {
          const data = d.data();
          const uid = String(data.userId ?? d.id);
          const ts = data.lastReadAt;
          const ms = ts instanceof Timestamp ? ts.toDate().getTime() : 0;
          next.set(uid, ms);
        }
        setGroupReadReceipts(next);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => unsub();
  }, [activeConversation, activeGroup, currentUserId]);

  // Listen to live VIP membership record & 30-day expiration for current user
  useEffect(() => {
    setCopiedVipInfo(false);
    setReceiptError(null);
    setReceiptImage('');
    setReceiptRef('');
    setReceiptNote('');
    if (
      activeConversation.kind !== 'channel' ||
      !activeChannel ||
      !activeChannel.isVip ||
      activeChannel.creatorId === currentUserId
    ) {
      setVipDocState({
        loaded: false,
        exists: false,
        accessMode: 'monthly',
        expiresAtMs: null,
      });
      setReceiptAmount('');
      return;
    }

    setReceiptAmount(activeChannel.vipPriceLabel ?? '');
    setVipNowMs(Date.now());
    setVipDocState({
      loaded: false,
      exists: false,
      accessMode: 'monthly',
      expiresAtMs: null,
    });

    const memberRef = doc(
      db,
      'channels',
      activeChannel.id,
      'vipMembers',
      currentUserId,
    );
    const unsub = onSnapshot(
      memberRef,
      (snap) => {
        if (!snap.exists()) {
          setVipDocState({
            loaded: true,
            exists: false,
            accessMode: 'monthly',
            expiresAtMs: null,
          });
          return;
        }
        const data = snap.data();
        const accessMode =
          data.accessMode === 'lifetime' ? 'lifetime' : 'monthly';
        const rawExp = data.expiresAt;
        const expiresAtMs =
          rawExp instanceof Timestamp ? rawExp.toMillis() : null;
        setVipNowMs(Date.now());
        setVipDocState({
          loaded: true,
          exists: true,
          accessMode,
          expiresAtMs,
        });
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          `channels/${activeChannel.id}/vipMembers/${currentUserId}`,
        );
      },
    );

    return () => unsub();
  }, [activeConversation, activeChannel, currentUserId]);

  // Automatic 30-day expiration timer so open screens lock immediately on expiry
  useEffect(() => {
    if (
      !vipDocState.exists ||
      vipDocState.accessMode === 'lifetime' ||
      vipDocState.expiresAtMs === null
    ) {
      return;
    }
    const remainingMs = vipDocState.expiresAtMs - Date.now();
    if (remainingMs <= 0) return;
    const delay = Math.min(remainingMs + 300, 60 * 60 * 1000);
    const timer = window.setTimeout(() => {
      setVipNowMs(Date.now());
    }, delay);
    return () => window.clearTimeout(timer);
  }, [vipDocState, vipNowMs]);

  // Listen to subscriber's own VIP receipts on active VIP channel
  useEffect(() => {
    if (
      activeConversation.kind !== 'channel' ||
      !activeChannel ||
      !activeChannel.isVip ||
      activeChannel.creatorId === currentUserId
    ) {
      setMyVipReceipts([]);
      return;
    }

    const channelId = activeChannel.id;
    const unsub = onSnapshot(
      query(
        collection(db, 'channels', channelId, 'vipReceipts'),
        where('channelId', '==', channelId),
        where('userId', '==', currentUserId),
      ),
      (snap) => {
        const list: ChannelVipReceipt[] = snap.docs.map((d) => {
          const data = d.data();
          const { label, ms } = formatFirestoreTime(data.createdAt);
          const verdict =
            data.aiVerdict === 'match' ||
            data.aiVerdict === 'review' ||
            data.aiVerdict === 'mismatch' ||
            data.aiVerdict === 'unavailable'
              ? data.aiVerdict
              : 'review';
          const status =
            data.status === 'approved' || data.status === 'rejected'
              ? data.status
              : 'pending';
          return {
            id: d.id,
            channelId,
            creatorId: String(data.creatorId ?? ''),
            userId: String(data.userId ?? currentUserId),
            userName: String(data.userName ?? currentUserName),
            userHandle: String(data.userHandle ?? currentUser.handle),
            amountText: String(data.amountText ?? ''),
            referenceText: String(data.referenceText ?? ''),
            note: String(data.note ?? ''),
            receiptImage:
              typeof data.receiptImage === 'string'
                ? data.receiptImage
                : undefined,
            status,
            aiVerdict: verdict,
            aiSummary: String(data.aiSummary ?? ''),
            reviewedBy:
              typeof data.reviewedBy === 'string' ? data.reviewedBy : undefined,
            createdAt: label,
            createdAtMs: ms,
          };
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setMyVipReceipts(list);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `channels/${channelId}/vipReceipts`,
        );
      },
    );

    return () => unsub();
  }, [activeConversation, activeChannel, currentUserId, currentUserName, currentUser.handle]);

  // Creator: listen for pending receipts badge & auto-prune expired VIP subscribers
  useEffect(() => {
    if (
      activeConversation.kind !== 'channel' ||
      !activeChannel ||
      !activeChannel.isVip ||
      activeChannel.creatorId !== currentUserId
    ) {
      setCreatorPendingReceiptsCount(0);
      return;
    }

    const channelId = activeChannel.id;
    void pruneExpiredChannelVipMembers({
      channelId,
      creatorId: currentUserId,
    }).catch(() => {});

    const unsub = onSnapshot(
      query(
        collection(db, 'channels', channelId, 'vipReceipts'),
        where('channelId', '==', channelId),
        where('creatorId', '==', currentUserId),
      ),
      (snap) => {
        let pending = 0;
        for (const d of snap.docs) {
          if (d.data().status === 'pending') pending += 1;
        }
        setCreatorPendingReceiptsCount(pending);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `channels/${channelId}/vipReceipts`,
        );
      },
    );

    return () => unsub();
  }, [activeConversation, activeChannel, currentUserId]);

  const isOneTimeChannel = activeChannel?.vipBillingCycle === 'once';

  const isVipExpired = Boolean(
    activeChannel?.isVip &&
      activeChannel.creatorId !== currentUserId &&
      vipDocState.exists &&
      vipDocState.accessMode !== 'lifetime' &&
      vipDocState.expiresAtMs !== null &&
      vipDocState.expiresAtMs <= vipNowMs,
  );

  const vipDaysLeft =
    vipDocState.exists &&
    vipDocState.accessMode !== 'lifetime' &&
    vipDocState.expiresAtMs !== null &&
    vipDocState.expiresAtMs > vipNowMs
      ? Math.max(
          1,
          Math.ceil(
            (vipDocState.expiresAtMs - vipNowMs) / (24 * 60 * 60 * 1000),
          ),
        )
      : null;

  const canReadActiveChannel = Boolean(
    activeChannel &&
      (!activeChannel.isVip ||
        activeChannel.creatorId === currentUserId ||
        (vipDocState.exists && !isVipExpired)),
  );

  const activeSummaryRoomKey =
    activeConversation.kind === 'group' && activeGroup
      ? `group_${activeGroup.id}`
      : activeConversation.kind === 'channel' &&
          activeChannel &&
          canReadActiveChannel
        ? `channel_${activeChannel.id}`
        : null;

  const activeInviteRoom: {
    kind: RoomInviteKind;
    id: string;
    roomKey: string;
    name: string;
    url: string;
  } | null =
    activeConversation.kind === 'group' && activeGroup
      ? {
          kind: 'group',
          id: activeGroup.id,
          roomKey: `group_${activeGroup.id}`,
          name: activeGroup.name,
          url:
            shortInviteByRoomKey[`group_${activeGroup.id}`] ||
            getCachedShortInviteLink('group', activeGroup.id) ||
            buildRoomInviteLink('group', activeGroup.id),
        }
      : activeConversation.kind === 'channel' && activeChannel
        ? {
            kind: 'channel',
            id: activeChannel.id,
            roomKey: `channel_${activeChannel.id}`,
            name: activeChannel.name,
            url:
              shortInviteByRoomKey[`channel_${activeChannel.id}`] ||
              getCachedShortInviteLink('channel', activeChannel.id) ||
              buildRoomInviteLink('channel', activeChannel.id),
          }
        : null;

  const activeInviteKind = activeInviteRoom?.kind ?? null;
  const activeInviteId = activeInviteRoom?.id ?? null;
  const activeInviteKey = activeInviteRoom?.roomKey ?? null;

  useEffect(() => {
    if (
      !activeInviteKind ||
      !activeInviteId ||
      !activeInviteKey ||
      inviteBannerRoomKey !== activeInviteKey
    ) {
      return;
    }
    if (
      shortInviteByRoomKey[activeInviteKey] ||
      getCachedShortInviteLink(activeInviteKind, activeInviteId)
    ) {
      return;
    }
    let active = true;
    setShorteningInviteRoomKey(activeInviteKey);
    void shortenRoomInviteLink(activeInviteKind, activeInviteId)
      .then((res) => {
        if (!active) return;
        setShortInviteByRoomKey((prev) => ({
          ...prev,
          [activeInviteKey]: res.url,
        }));
      })
      .finally(() => {
        if (active) {
          setShorteningInviteRoomKey((curr) =>
            curr === activeInviteKey ? null : curr,
          );
        }
      });
    return () => {
      active = false;
    };
  }, [
    activeInviteKind,
    activeInviteId,
    activeInviteKey,
    inviteBannerRoomKey,
    shortInviteByRoomKey,
  ]);

  const handleTranslateMessage = async (
    msgId: string,
    text: string,
    targetLanguage: TranslationTarget,
  ) => {
    const reqKey = `${msgId}:${targetLanguage}`;
    if (translatingMsgKey === reqKey) return;
    setTranslatingMsgKey(reqKey);
    setTranslateErrorByMsgId((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
    try {
      const res = await translateChatMessage({ text, targetLanguage });
      setTranslationsByMsgId((prev) => ({
        ...prev,
        [msgId]: {
          targetLanguage: res.targetLanguage,
          text: res.translatedText,
        },
      }));
      setOpenTranslateMsgId(null);
    } catch (err) {
      setTranslateErrorByMsgId((prev) => ({
        ...prev,
        [msgId]: extractReadableError(err, 'Unable to translate message right now.'),
      }));
    } finally {
      setTranslatingMsgKey((curr) => (curr === reqKey ? null : curr));
    }
  };

  const handleTranscribeVoice = async (msgId: string, audioData: string) => {
    if (transcribingMsgId === msgId) return;
    setTranscribingMsgId(msgId);
    setTranscriptErrorByMsgId((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
    try {
      const res = await transcribeVoiceNote({ audioData });
      setTranscriptsByMsgId((prev) => ({
        ...prev,
        [msgId]: res.transcript,
      }));
    } catch (err) {
      setTranscriptErrorByMsgId((prev) => ({
        ...prev,
        [msgId]: extractReadableError(err, 'Unable to transcribe audio right now.'),
      }));
    } finally {
      setTranscribingMsgId((curr) => (curr === msgId ? null : curr));
    }
  };

  const handleSummarizeRoom = async () => {
    if (!activeSummaryRoomKey) return;
    const roomKey = activeSummaryRoomKey;
    setSummaryOpenRoomKey(roomKey);

    if (summarizingRoomKey === roomKey) return;

    const payloadMessages =
      activeConversation.kind === 'group' && activeGroup
        ? groupMessages.slice(-40).map((m) => ({
            senderName: m.senderName,
            text: m.audioData
              ? transcriptsByMsgId[m.id] || m.text
              : m.text,
            timestamp: m.timestamp,
          }))
        : activeConversation.kind === 'channel' && activeChannel
          ? channelPosts.slice(-40).map((p) => ({
              senderName: p.authorName,
              text: p.audioData
                ? transcriptsByMsgId[p.id] || p.text
                : p.text,
              timestamp: p.timestamp,
            }))
          : [];

    if (payloadMessages.length === 0) {
      setSummaryErrorByRoomKey((prev) => ({
        ...prev,
        [roomKey]: t.summaryEmptyErr,
      }));
      return;
    }

    setSummarizingRoomKey(roomKey);
    setSummaryErrorByRoomKey((prev) => {
      const next = { ...prev };
      delete next[roomKey];
      return next;
    });

    try {
      const res = await summarizeChatRoom({
        roomName:
          activeConversation.kind === 'group'
            ? activeGroup?.name ?? 'Group'
            : activeChannel?.name ?? 'Channel',
        roomType:
          activeConversation.kind === 'channel' ? 'channel' : 'group',
        uiLanguage: language,
        messages: payloadMessages,
      });
      setSummaryByRoomKey((prev) => ({
        ...prev,
        [roomKey]: res,
      }));
    } catch (err) {
      setSummaryErrorByRoomKey((prev) => ({
        ...prev,
        [roomKey]: extractReadableError(err, 'Unable to summarize messages right now.'),
      }));
    } finally {
      setSummarizingRoomKey((curr) => (curr === roomKey ? null : curr));
    }
  };

  const renderMessageTranslationBlock = (
    msgId: string,
    rawText: string,
    align: 'left' | 'right' | 'full',
  ) => {
    const pickerOpen = openTranslateMsgId === msgId;
    const translation = translationsByMsgId[msgId];
    const translateErr = translateErrorByMsgId[msgId];
    const alignClass =
      align === 'right'
        ? 'items-end'
        : align === 'left'
          ? 'items-start'
          : 'items-stretch';

    if (!pickerOpen && !translation && !translateErr) return null;

    return (
      <div
        className={`mt-1.5 flex flex-col gap-1.5 ${
          align === 'full' ? 'w-full' : `max-w-[85%] ${alignClass}`
        }`}
      >
        {pickerOpen && (
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 shadow-xs">
            {TRANSLATION_TARGETS.map((langOpt) => {
              const busy = translatingMsgKey === `${msgId}:${langOpt.code}`;
              const selected =
                translation?.targetLanguage === langOpt.code;
              return (
                <button
                  key={langOpt.code}
                  type="button"
                  disabled={translatingMsgKey !== null}
                  onClick={() =>
                    void handleTranslateMessage(msgId, rawText, langOpt.code)
                  }
                  className={`min-h-[28px] px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                    selected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300'
                  }`}
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{langOpt.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setOpenTranslateMsgId(null)}
              aria-label={t.cancel}
              className="min-h-[28px] min-w-[28px] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {translateErr && (
          <div className="rounded-xl px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300">
            {translateErr}
          </div>
        )}

        {translation && (
          <div className="rounded-xl px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-slate-800 dark:text-slate-100 space-y-1">
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span className="inline-flex items-center gap-1">
                <Languages className="w-3 h-3" />
                <span>
                  {t.translatedToPrefix} {translation.targetLanguage}
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setTranslationsByMsgId((prev) => {
                    const next = { ...prev };
                    delete next[msgId];
                    return next;
                  })
                }
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
              >
                {t.hideTranslationBtn}
              </button>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap break-words">
              {translation.text}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderVoiceTranscriptBlock = (
    msgId: string,
    align: 'left' | 'right' | 'full',
  ) => {
    const transcript = transcriptsByMsgId[msgId];
    const transcriptErr = transcriptErrorByMsgId[msgId];
    if (!transcript && !transcriptErr) return null;

    const alignClass =
      align === 'right'
        ? 'items-end'
        : align === 'left'
          ? 'items-start'
          : 'items-stretch';

    return (
      <div
        className={`mt-1.5 flex flex-col gap-1 ${
          align === 'full' ? 'w-full' : `max-w-[85%] ${alignClass}`
        }`}
      >
        {transcriptErr && (
          <div className="rounded-xl px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300">
            {transcriptErr}
          </div>
        )}
        {transcript && (
          <div className="rounded-xl px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 space-y-1 shadow-xs">
            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span className="inline-flex items-center gap-1">
                <Captions className="w-3 h-3" />
                <span>{t.transcriptLabel}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setTranscriptsByMsgId((prev) => {
                    const next = { ...prev };
                    delete next[msgId];
                    return next;
                  })
                }
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
              >
                {t.hideTranscriptBtn}
              </button>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap break-words">
              {transcript}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Listen to Channel Broadcast Posts
  useEffect(() => {
    if (
      activeConversation.kind !== 'channel' ||
      !activeChannel ||
      !canReadActiveChannel
    ) {
      setChannelPosts([]);
      return;
    }

    const channelId = activeChannel.id;
    const path = `channels/${channelId}/posts`;
    const postsQuery = activeChannel.isVip
      ? query(
          collection(db, 'channels', channelId, 'posts'),
          where('channelId', '==', channelId),
          where('visibility', '==', 'vip'),
          where('visibleTo', 'array-contains', currentUserId),
        )
      : query(
          collection(db, 'channels', channelId, 'posts'),
          where('channelId', '==', channelId),
          where('visibility', '==', 'public'),
        );

    const unsub = onSnapshot(
      postsQuery,
      (snap) => {
        const list: ChannelPostItem[] = snap.docs.map((d) => {
          const data = d.data();
          const ts = data.createdAt;
          const date = ts instanceof Timestamp ? ts.toDate() : new Date();
          return {
            id: d.id,
            channelId,
            authorId: String(data.authorId ?? ''),
            authorName: String(data.authorName ?? 'Creator'),
            text: String(data.text ?? ''),
            messageType: data.messageType === 'voice' ? 'voice' : 'text',
            audioData:
              typeof data.audioData === 'string' ? data.audioData : undefined,
            audioDuration:
              typeof data.audioDuration === 'number'
                ? data.audioDuration
                : undefined,
            visibility: data.visibility === 'vip' ? 'vip' : 'public',
            timestamp: date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            ms: date.getTime(),
          };
        });
        list.sort((a, b) => a.ms - b.ms);
        setChannelPosts(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );

    return () => unsub();
  }, [activeConversation, activeChannel, canReadActiveChannel, currentUserId]);

  // Automatically mark visible DM thread as read
  const activePeerUnreadCount = activePeer
    ? (threadSummaryByPeer.get(activePeer.id)?.unreadCount ?? 0)
    : 0;
  const unreadIncomingDmIds = useMemo(() => {
    if (activeConversation.kind !== 'dm') return [];
    return dmMessages
      .filter((m) => m.sender === 'them' && !m.read)
      .map((m) => m.id);
  }, [activeConversation.kind, dmMessages]);

  useEffect(() => {
    if (
      !isThreadVisible ||
      activeConversation.kind !== 'dm' ||
      !activePeer ||
      (unreadIncomingDmIds.length === 0 && activePeerUnreadCount === 0)
    ) {
      return;
    }
    const sortedIds = [currentUserId, activePeer.id].sort();
    const threadId = `${sortedIds[0]}_${sortedIds[1]}`;
    void markDirectMessagesRead({
      threadId,
      currentUserId,
      unreadMessageIds: unreadIncomingDmIds,
      shouldClearThreadBadge: activePeerUnreadCount > 0,
    });
  }, [
    isThreadVisible,
    activeConversation.kind,
    activePeer,
    currentUserId,
    unreadIncomingDmIds,
    activePeerUnreadCount,
  ]);

  // Automatically mark visible Group thread as read & update read receipt
  const currentGroupReadSeq = activeGroup
    ? (readSeqByRoom.get(`group_${activeGroup.id}`) ?? 0)
    : 0;
  const latestGroupMsgMs =
    groupMessages.length > 0
      ? groupMessages[groupMessages.length - 1].ms
      : 0;
  const myGroupReadReceiptMs = groupReadReceipts.get(currentUserId) ?? 0;

  useEffect(() => {
    if (!isThreadVisible || activeConversation.kind !== 'group' || !activeGroup) {
      return;
    }
    if (activeGroup.messageSeq > currentGroupReadSeq) {
      void markRoomReadCursor({
        userId: currentUserId,
        roomKey: `group_${activeGroup.id}`,
        seq: activeGroup.messageSeq,
      });
    }
    if (
      latestGroupMsgMs > 0 &&
      (!groupReadReceipts.has(currentUserId) ||
        myGroupReadReceiptMs < latestGroupMsgMs)
    ) {
      void upsertGroupReadReceipt({
        groupId: activeGroup.id,
        userId: currentUserId,
        visibleTo: activeGroup.memberIds,
      });
    }
  }, [
    isThreadVisible,
    activeConversation.kind,
    activeGroup,
    currentUserId,
    currentGroupReadSeq,
    latestGroupMsgMs,
    myGroupReadReceiptMs,
    groupReadReceipts,
  ]);

  // Automatically mark visible Channel as read
  const currentChannelReadSeq = activeChannel
    ? (readSeqByRoom.get(`channel_${activeChannel.id}`) ?? 0)
    : 0;

  useEffect(() => {
    if (
      !isThreadVisible ||
      activeConversation.kind !== 'channel' ||
      !activeChannel ||
      !canReadActiveChannel
    ) {
      return;
    }
    if (activeChannel.messageSeq > currentChannelReadSeq) {
      void markRoomReadCursor({
        userId: currentUserId,
        roomKey: `channel_${activeChannel.id}`,
        seq: activeChannel.messageSeq,
      });
    }
  }, [
    isThreadVisible,
    activeConversation.kind,
    activeChannel,
    canReadActiveChannel,
    currentUserId,
    currentChannelReadSeq,
  ]);

  const maxOtherGroupReadMs = useMemo(() => {
    let maxMs = 0;
    for (const [uid, ms] of groupReadReceipts.entries()) {
      if (uid !== currentUserId && ms > maxMs) {
        maxMs = ms;
      }
    }
    return maxMs;
  }, [groupReadReceipts, currentUserId]);

  useEffect(() => {
    const el = messagesViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [
    deepThinkMessages.length,
    dmMessages.length,
    groupMessages.length,
    channelPosts.length,
    activeConversation,
    mobileThreadOpen,
  ]);

  const sendDeepThinkPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || thinking) return;

    const now = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    onAddDeepThinkMessage({
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: trimmed,
      timestamp: now,
    });
    setThinking(true);

    try {
      const history = deepThinkMessages
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'me' ? ('user' as const) : ('model' as const),
          text: m.text,
        }));

      const result = await queryDeepThink({
        mode: 'chat',
        prompt: trimmed,
        history,
      });

      onAddDeepThinkMessage({
        id: `msg-ai-${Date.now()}`,
        sender: 'them',
        text: result.answer,
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } catch (err) {
      onAddDeepThinkMessage({
        id: `msg-err-${Date.now()}`,
        sender: 'them',
        text: extractReadableError(
          err,
          'An error occurred while reaching the reasoning service.',
        ),
        timestamp: now,
        error: 'failed',
      });
    } finally {
      setThinking(false);
    }
  };

  const stopRecordingHardware = () => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordStreamRef.current) {
      for (const track of recordStreamRef.current.getTracks()) {
        track.stop();
      }
      recordStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      stopRecordingHardware();
    };
  }, [activeConversation]);

  const sendVoicePayload = async (voice: VoiceNotePayload) => {
    setSending(true);
    try {
      if (activeConversation.kind === 'dm' && activePeer) {
        await sendFirestoreDirectMessage({
          senderId: currentUserId,
          recipientId: activePeer.id,
          text: voice.fallbackText,
          voice,
        });
      } else if (activeConversation.kind === 'group' && activeGroup) {
        await sendFirestoreGroupMessage({
          groupId: activeGroup.id,
          senderId: currentUserId,
          senderName: currentUserName,
          text: voice.fallbackText,
          voice,
        });
      } else if (
        activeConversation.kind === 'channel' &&
        activeChannel &&
        activeChannel.creatorId === currentUserId
      ) {
        await publishFirestoreChannelPost({
          channelId: activeChannel.id,
          authorId: currentUserId,
          authorName: currentUserName,
          text: voice.fallbackText,
          voice,
        });
      }
    } finally {
      setSending(false);
    }
  };

  const finishAndSendVoiceRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    const durationSec = Math.max(
      1,
      Math.round((Date.now() - recordStartMsRef.current) / 1000),
    );
    const mimeType = rec.mimeType || 'audio/webm';

    rec.onstop = () => {
      const chunks = [...recordChunksRef.current];
      recordChunksRef.current = [];
      stopRecordingHardware();
      setRecording(false);
      setRecordSec(0);

      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result.startsWith('data:audio/')) {
          setVoiceError(t.micPermissionErr);
          return;
        }
        if (result.length > 345000) {
          setVoiceError(t.voiceTooLargeErr);
          return;
        }
        const mm = Math.floor(durationSec / 60);
        const ss = String(durationSec % 60).padStart(2, '0');
        void sendVoicePayload({
          audioData: result,
          duration: durationSec,
          fallbackText: `${t.voiceMessageLabel} (${mm}:${ss})`,
        });
      };
      reader.readAsDataURL(blob);
    };

    rec.stop();
  };

  const cancelVoiceRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    recordChunksRef.current = [];
    stopRecordingHardware();
    setRecording(false);
    setRecordSec(0);
  };

  const startVoiceRecording = async () => {
    if (recording || sending) return;
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const supportedType = preferredTypes.find(
        (type) =>
          typeof MediaRecorder !== 'undefined' &&
          MediaRecorder.isTypeSupported(type),
      );
      const recorder = supportedType
        ? new MediaRecorder(stream, {
            mimeType: supportedType,
            audioBitsPerSecond: 16000,
          })
        : new MediaRecorder(stream, { audioBitsPerSecond: 16000 });

      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recordStartMsRef.current = Date.now();
      setRecordSec(0);
      setRecording(true);
      recorder.start(250);

      recordTimerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - recordStartMsRef.current) / 1000);
        setRecordSec(secs);
        if (secs >= 58) {
          finishAndSendVoiceRecording();
        }
      }, 400);
    } catch {
      stopRecordingHardware();
      setRecording(false);
      setVoiceError(t.micPermissionErr);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || thinking || sending) return;

    if (activeConversation.kind === 'deep_think') {
      setInput('');
      await sendDeepThinkPrompt(trimmed);
      return;
    }

    if (activeConversation.kind === 'dm' && activePeer) {
      setSending(true);
      try {
        await sendFirestoreDirectMessage({
          senderId: currentUserId,
          recipientId: activePeer.id,
          text: trimmed,
        });
        setInput('');
      } finally {
        setSending(false);
      }
      return;
    }

    if (activeConversation.kind === 'group' && activeGroup) {
      setSending(true);
      try {
        await sendFirestoreGroupMessage({
          groupId: activeGroup.id,
          senderId: currentUserId,
          senderName: currentUserName,
          text: trimmed,
        });
        setInput('');
      } finally {
        setSending(false);
      }
      return;
    }

    if (
      activeConversation.kind === 'channel' &&
      activeChannel &&
      activeChannel.creatorId === currentUserId
    ) {
      setSending(true);
      try {
        await publishFirestoreChannelPost({
          channelId: activeChannel.id,
          authorId: currentUserId,
          authorName: currentUserName,
          text: trimmed,
        });
        setInput('');
      } finally {
        setSending(false);
      }
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const visiblePeers = q
    ? sortedPeers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q),
      )
    : sortedPeers;
  const visibleGroups = q
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q),
      )
    : groups;
  const visibleChannels = q
    ? channels.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
    : channels;

  const showDeepThinkRow =
    filter === 'all' &&
    (!q || t.deepThinkTitle.toLowerCase().includes(q));
  const showPrivateRows = filter === 'all' || filter === 'private';
  const showGroupRows = filter === 'all' || filter === 'groups';
  const showChannelRows = filter === 'all' || filter === 'channels';

  const isChannelOwner =
    activeChannel !== null && activeChannel.creatorId === currentUserId;
  const isChannelFollowed =
    activeChannel !== null && followedChannelIds.has(activeChannel.id);

  const unreadGroupsFilterCount = useMemo(
    () =>
      groups.filter((grp) => {
        if (grp.lastSenderId === currentUserId) return false;
        const readSeq = readSeqByRoom.get(`group_${grp.id}`) ?? 0;
        return grp.messageSeq > readSeq;
      }).length,
    [groups, currentUserId, readSeqByRoom],
  );

  const unreadChannelsFilterCount = useMemo(
    () =>
      channels.filter((ch) => {
        if (ch.creatorId === currentUserId || !followedChannelIds.has(ch.id)) {
          return false;
        }
        const readSeq = readSeqByRoom.get(`channel_${ch.id}`) ?? 0;
        return ch.messageSeq > readSeq;
      }).length,
    [channels, currentUserId, followedChannelIds, readSeqByRoom],
  );

  const unreadPrivateFilterCount = useMemo(
    () =>
      dmThreads.filter((th) => th.unreadCount > 0).length,
    [dmThreads],
  );

  return (
    <section
      aria-label={t.navChat}
      className={`relative bg-white dark:bg-slate-900 lg:border lg:border-slate-200 dark:lg:border-slate-800 lg:rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[360px_1fr] ${
        mobileThreadOpen
          ? 'h-[100dvh] lg:h-[calc(100dvh-2rem)]'
          : 'h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-2rem)]'
      } min-h-[420px] lg:min-h-[600px]`}
    >
      {/* Left Pane: Full-bleed WhatsApp-style Chats List */}
      <aside
        className={`relative flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 ${
          mobileThreadOpen ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search + Filter Pills + Quick Actions Header */}
        <div className="px-4 pt-3 pb-2.5 space-y-2.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          {/* Full-width Search / Ask World Connection AI Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchUnifiedPlaceholder}
              aria-label={t.searchUnifiedPlaceholder}
              className="w-full min-h-[44px] pl-10 pr-4 rounded-full bg-slate-100 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Interactive Filter Chips matching WhatsApp screenshot */}
          <div className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto py-0.5">
            {(
              [
                { id: 'all', label: t.filterAll, count: 0 },
                { id: 'private', label: t.filterPrivate, count: unreadPrivateFilterCount },
                { id: 'groups', label: t.filterGroups, count: unreadGroupsFilterCount },
                { id: 'channels', label: t.filterChannels, count: unreadChannelsFilterCount },
              ] as const
            ).map((tabItem) => {
              const active = filter === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setFilter(tabItem.id)}
                  className={`min-h-[34px] px-3.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{tabItem.label}</span>
                  {tabItem.count > 0 && (
                    <span className="tabular-nums opacity-85">
                      {tabItem.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="-mx-4 px-4 flex items-center gap-2 overflow-x-auto pt-0.5">
            <button
              type="button"
              onClick={() => onOpenRoomModal('private')}
              title={t.newPrivateChat}
              aria-label={t.newPrivateChat}
              className="min-h-[34px] px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{t.newPrivateAction}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRoomModal('group')}
              title={t.createGroup}
              aria-label={t.createGroup}
              className="min-h-[34px] px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{t.newGroupAction}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRoomModal('channel')}
              title={t.createChannel}
              aria-label={t.createChannel}
              className="min-h-[34px] px-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Megaphone className="w-3.5 h-3.5 shrink-0" />
              <span>{t.newChannelAction}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Unified List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/70 pb-28 md:pb-4">
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => {
                const text = searchQuery.trim();
                setSearchQuery('');
                onSelectConversation({ kind: 'deep_think' }, true);
                void sendDeepThinkPrompt(text);
              }}
              className="w-full text-left px-4 py-3 flex items-center gap-3 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 transition-colors"
            >
              <Avatar name={t.deepThinkTitle} size="sm" isAi />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {t.askDeepThinkAction}
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-100 truncate">
                  {searchQuery.trim()}
                </p>
              </div>
            </button>
          )}

          {/* Private 1-on-1 Chats */}
          {showPrivateRows &&
            visiblePeers.map((peer) => {
              const isActive =
                activeConversation.kind === 'dm' &&
                activeConversation.userId === peer.id;
              const summary = threadSummaryByPeer.get(peer.id);
              const unreadCount = summary?.unreadCount ?? 0;
              return (
                <div
                  key={`dm-${peer.id}`}
                  className={`px-4 flex items-center gap-2 transition-colors min-h-[72px] ${
                    isActive
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/35'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onSelectConversation({ kind: 'dm', userId: peer.id }, true)
                    }
                    className="flex-1 min-w-0 py-3.5 flex items-center gap-3.5 text-left"
                  >
                    <Avatar
                      name={peer.name}
                      src={peer.avatarUrl}
                      size="md"
                      online={peer.isOnline}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                          {peer.name}
                        </span>
                        {summary?.updatedAt && (
                          <span
                            className={`text-xs tabular-nums shrink-0 ${
                              unreadCount > 0
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {summary.updatedAt}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={`text-[13px] truncate inline-flex items-center gap-1 min-w-0 ${
                            unreadCount > 0
                              ? 'text-slate-800 dark:text-slate-200 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {summary?.lastMessage ||
                              `${peer.handle} · ${t.privateChatLabel}`}
                          </span>
                        </p>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onStartCall(peer, 'audio')}
                      aria-label={`${t.audioCallBtn} ${peer.name}`}
                      title={t.audioCallBtn}
                      className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center justify-center transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(peer, 'video')}
                      aria-label={`${t.videoCallBtn} ${peer.name}`}
                      title={t.videoCallBtn}
                      className="min-h-[40px] min-w-[40px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center justify-center transition-colors"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

          {showDeepThinkRow && (
            <button
              type="button"
              onClick={() => onSelectConversation({ kind: 'deep_think' }, true)}
              className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition-colors min-h-[72px] ${
                activeConversation.kind === 'deep_think'
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/35'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Avatar name={t.deepThinkTitle} size="md" isAi />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                    {t.deepThinkTitle}
                  </span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">
                    {deepThinkMessages[deepThinkMessages.length - 1]?.timestamp}
                  </span>
                </div>
                <p className="text-[13px] text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
                  {deepThinkMessages[deepThinkMessages.length - 1]?.text ||
                    t.deepThinkTagline}
                </p>
              </div>
            </button>
          )}

          {/* Group Chats */}
          {showGroupRows &&
            visibleGroups.map((grp) => {
              const isActive =
                activeConversation.kind === 'group' &&
                activeConversation.groupId === grp.id;
              const readSeq = readSeqByRoom.get(`group_${grp.id}`) ?? 0;
              const unreadCount =
                grp.lastSenderId !== currentUserId && grp.messageSeq > readSeq
                  ? grp.messageSeq - readSeq
                  : 0;
              return (
                <button
                  key={`grp-${grp.id}`}
                  type="button"
                  onClick={() =>
                    onSelectConversation({ kind: 'group', groupId: grp.id }, true)
                  }
                  className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition-colors min-h-[72px] ${
                    isActive
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/35'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                        {grp.name}
                      </span>
                      <span
                        className={`text-xs tabular-nums shrink-0 ${
                          unreadCount > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {grp.updatedAt}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-[13px] truncate min-w-0 ${
                          unreadCount > 0
                            ? 'text-slate-800 dark:text-slate-200 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {grp.lastMessage ||
                          `${grp.memberIds.length} ${t.membersWord}`}
                      </p>
                      {unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

          {/* Channels */}
          {showChannelRows &&
            visibleChannels.map((ch) => {
              const isActive =
                activeConversation.kind === 'channel' &&
                activeConversation.channelId === ch.id;
              const readSeq = readSeqByRoom.get(`channel_${ch.id}`) ?? 0;
              const unreadCount =
                ch.creatorId !== currentUserId &&
                followedChannelIds.has(ch.id) &&
                ch.messageSeq > readSeq
                  ? ch.messageSeq - readSeq
                  : 0;
              return (
                <button
                  key={`ch-${ch.id}`}
                  type="button"
                  onClick={() =>
                    onSelectConversation(
                      { kind: 'channel', channelId: ch.id },
                      true,
                    )
                  }
                  className={`w-full text-left px-4 py-3.5 flex items-center gap-3.5 transition-colors min-h-[72px] ${
                    isActive
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/35'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      ch.isVip
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400'
                        : 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400'
                    }`}
                  >
                    {ch.isVip ? (
                      <Crown className="w-5 h-5" />
                    ) : (
                      <Megaphone className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-display font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                          {ch.name}
                        </span>
                        {ch.isVip && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase shrink-0">
                            {ch.vipBillingCycle === 'once'
                              ? `${t.vipBadge} · ${t.vipOnceBadge}`
                              : t.vipBadge}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs tabular-nums shrink-0 ${
                          unreadCount > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {ch.updatedAt}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-[13px] truncate min-w-0 ${
                          unreadCount > 0
                            ? 'text-slate-800 dark:text-slate-200 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {ch.lastMessage ||
                          `${ch.followersCount} ${t.followersWord}`}
                      </p>
                      {unreadCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

          {filter === 'groups' && visibleGroups.length === 0 && (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t.emptyGroupsTitle}
              </p>
              <button
                type="button"
                onClick={() => onOpenRoomModal('group')}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.createGroup}</span>
              </button>
            </div>
          )}

          {filter === 'channels' && visibleChannels.length === 0 && (
            <div className="p-6 text-center space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.emptyChannelsDesc}
              </p>
              <button
                type="button"
                onClick={() => onOpenRoomModal('channel')}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{t.createChannel}</span>
              </button>
            </div>
          )}
        </div>

        {/* WhatsApp-style Emerald FAB & Action Menu */}
        {fabMenuOpen && (
          <div className="absolute bottom-16 right-4 z-20 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => {
                setFabMenuOpen(false);
                onOpenRoomModal('private');
              }}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{t.newPrivateChat}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFabMenuOpen(false);
                onOpenRoomModal('group');
              }}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{t.createGroup}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFabMenuOpen(false);
                onOpenRoomModal('channel');
              }}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Megaphone className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{t.createChannel}</span>
            </button>
          </div>
        )}

        {/* Floating AI Shortcut + Emerald Chat+ FAB */}
        <button
          type="button"
          onClick={() => onSelectConversation({ kind: 'deep_think' }, true)}
          aria-label={t.deepThinkTitle}
          title={t.deepThinkTitle}
          className="md:hidden absolute bottom-20 right-4 z-20 w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 shadow-md flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors"
        >
          <BrainCircuit className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setFabMenuOpen((prev) => !prev)}
          aria-label="New chat, group, or channel"
          className="md:hidden absolute bottom-4 right-4 z-20 w-13 h-13 rounded-2xl bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 transition-colors"
        >
          {fabMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <MessageSquarePlus className="w-5 h-5" />
          )}
        </button>
      </aside>

      {/* Right Pane: Active Thread (Deep Think / Private 1-on-1 / Group / Channel) */}
      <div
        className={`flex flex-col min-h-0 ${
          mobileThreadOpen ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Thread Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onCloseMobileThread}
              aria-label="Back to chats"
              className="md:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {activeConversation.kind === 'dm' && activePeer ? (
              <>
                <Avatar
                  name={activePeer.name}
                  src={activePeer.avatarUrl}
                  size="sm"
                  online={activePeer.isOnline}
                />
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {activePeer.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate inline-flex items-center gap-1.5">
                    {activePeer.isOnline ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{t.onlineLabel}</span>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                      </span>
                    ) : (
                      <Lock className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">
                      {t.privateChatLabel} · {activePeer.handle}
                    </span>
                  </p>
                </div>
              </>
            ) : activeConversation.kind === 'group' && activeGroup ? (
              <>
                <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {activeGroup.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                    {activeGroup.memberIds.length} {t.membersWord}
                    {activeGroup.description
                      ? ` · ${activeGroup.description}`
                      : ''}
                  </p>
                </div>
              </>
            ) : activeConversation.kind === 'channel' && activeChannel ? (
              <>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    activeChannel.isVip
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400'
                      : 'bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-400'
                  }`}
                >
                  {activeChannel.isVip ? (
                    <Crown className="w-4 h-4" />
                  ) : (
                    <Megaphone className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {activeChannel.name}
                    </h3>
                    {activeChannel.isVip && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase shrink-0">
                        {t.vipBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                    {activeChannel.followersCount} {t.followersWord} ·{' '}
                    {activeChannel.creatorName}
                    {activeChannel.isVip && activeChannel.vipPriceLabel
                      ? ` · ${activeChannel.vipPriceLabel}`
                      : ''}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Avatar name={t.deepThinkTitle} size="sm" isAi />
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {t.deepThinkTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {t.deepThinkHeaderSub}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeConversation.kind === 'dm' && activePeer && (
              <>
                <button
                  type="button"
                  onClick={() => onStartCall(activePeer, 'video')}
                  aria-label={t.videoCallBtn}
                  title={t.videoCallBtn}
                  className="min-h-[42px] min-w-[42px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center justify-center transition-colors"
                >
                  <Video className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onStartCall(activePeer, 'audio')}
                  aria-label={t.audioCallBtn}
                  title={t.audioCallBtn}
                  className="min-h-[42px] min-w-[42px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center justify-center transition-colors"
                >
                  <Phone className="w-5 h-5" />
                </button>
              </>
            )}

            {activeInviteRoom && (
              <button
                type="button"
                onClick={() =>
                  setInviteBannerRoomKey((prev) =>
                    prev === activeInviteRoom.roomKey
                      ? null
                      : activeInviteRoom.roomKey,
                  )
                }
                aria-expanded={inviteBannerRoomKey === activeInviteRoom.roomKey}
                title={t.inviteLinkTitle}
                className={`min-h-[38px] px-2.5 sm:px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors ${
                  inviteBannerRoomKey === activeInviteRoom.roomKey
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t.inviteLinkTitle}</span>
              </button>
            )}

            {activeSummaryRoomKey && (
              <button
                type="button"
                onClick={() => void handleSummarizeRoom()}
                disabled={summarizingRoomKey === activeSummaryRoomKey}
                title={t.summarizeChatBtn}
                className="min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-60 inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors"
              >
                {summarizingRoomKey === activeSummaryRoomKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="hidden sm:inline">
                  {summarizingRoomKey === activeSummaryRoomKey
                    ? t.summarizingLabel
                    : t.summarizeChatBtn}
                </span>
                <span className="sm:hidden">
                  {summarizingRoomKey === activeSummaryRoomKey
                    ? t.summarizingLabel
                    : t.summarizeShortBtn}
                </span>
              </button>
            )}

            {activeGroup && activeGroup.creatorId === currentUserId && (
              <button
                type="button"
                onClick={() => onOpenRoomModal('group_members', activeGroup)}
                className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.manageMembersBtn}</span>
              </button>
            )}

            {activeChannel && isChannelOwner && activeChannel.isVip && (
              <button
                type="button"
                onClick={() => onOpenVipManager(activeChannel)}
                className="min-h-[38px] px-3 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{t.manageVipBtn}</span>
                {creatorPendingReceiptsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-white text-amber-700 text-[10px] font-bold tabular-nums">
                    {creatorPendingReceiptsCount}
                  </span>
                )}
              </button>
            )}

            {activeChannel && !isChannelOwner && (
              <button
                type="button"
                onClick={() =>
                  onToggleFollowChannel(activeChannel.id, isChannelFollowed)
                }
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold transition-colors shrink-0 whitespace-nowrap ${
                  isChannelFollowed
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isChannelFollowed ? t.followingBtn : t.followBtn}
              </button>
            )}
          </div>
        </div>

        {/* Invite Link Banner (Group Chats & Channels) */}
        {activeInviteRoom &&
          inviteBannerRoomKey === activeInviteRoom.roomKey && (
            <div className="px-4 py-3 border-b border-emerald-200/80 dark:border-emerald-800/60 bg-slate-50 dark:bg-slate-900/90 shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-0">
                  <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {t.inviteLinkTitle} · {activeInviteRoom.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteBannerRoomKey(null)}
                  aria-label={t.cancel}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeInviteRoom.url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={t.inviteLinkTitle}
                  className="flex-1 min-w-0 min-h-[38px] px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 select-all focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                {shorteningInviteRoomKey === activeInviteRoom.roomKey && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 shrink-0">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.shorteningLinkLabel}</span>
                  </span>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyTextToClipboard(activeInviteRoom.url);
                      if (ok) {
                        setCopiedInviteRoomKey(activeInviteRoom.roomKey);
                        window.setTimeout(
                          () =>
                            setCopiedInviteRoomKey((curr) =>
                              curr === activeInviteRoom.roomKey ? null : curr,
                            ),
                          2200,
                        );
                      }
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    {copiedInviteRoomKey === activeInviteRoom.roomKey ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {copiedInviteRoomKey === activeInviteRoom.roomKey
                        ? t.linkCopiedToast
                        : t.copyInviteLinkBtn}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const outcome = await shareOrCopyInviteLink({
                        title: activeInviteRoom.name,
                        text: `${t.inviteLinkTitle}: ${activeInviteRoom.name}`,
                        url: activeInviteRoom.url,
                      });
                      if (outcome === 'copied') {
                        setCopiedInviteRoomKey(activeInviteRoom.roomKey);
                        window.setTimeout(
                          () =>
                            setCopiedInviteRoomKey((curr) =>
                              curr === activeInviteRoom.roomKey ? null : curr,
                            ),
                          2200,
                        );
                      }
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.shareInviteLinkBtn}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* AI Chat Summary Banner (Group Chats & Channels) */}
        {activeSummaryRoomKey &&
          (summaryOpenRoomKey === activeSummaryRoomKey ||
            summarizingRoomKey === activeSummaryRoomKey) && (
            <div className="px-4 py-3 border-b border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/75 dark:bg-emerald-950/35 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.chatSummaryTitle}</span>
                  {summaryByRoomKey[activeSummaryRoomKey] && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/70 text-[10px] font-semibold tabular-nums">
                      {summaryByRoomKey[activeSummaryRoomKey].messageCount}{' '}
                      {t.summaryMessagesWord}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSummaryOpenRoomKey(null)}
                  aria-label={t.cancel}
                  className="p-1 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {summarizingRoomKey === activeSummaryRoomKey ? (
                <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.summarizingLabel}</span>
                </p>
              ) : summaryErrorByRoomKey[activeSummaryRoomKey] ? (
                <p className="mt-1.5 text-xs text-rose-700 dark:text-rose-300">
                  {summaryErrorByRoomKey[activeSummaryRoomKey]}
                </p>
              ) : (
                summaryByRoomKey[activeSummaryRoomKey] && (
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {summaryByRoomKey[activeSummaryRoomKey].summary}
                  </p>
                )
              )}
            </div>
          )}

        {/* Messages Viewport */}
        <div
          ref={messagesViewportRef}
          className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50/60 dark:bg-slate-950/40"
        >
          {activeConversation.kind === 'deep_think' && (
            <>
              {deepThinkMessages.map((msg) => {
                const isMe = msg.sender === 'me';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isMe ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        msg.error
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : isMe
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <div className="mt-1 px-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                      <span>{msg.timestamp}</span>
                      {isMe && (
                        <span
                          title={thinking ? t.msgSentLabel : t.msgReadLabel}
                          aria-label={thinking ? t.msgSentLabel : t.msgReadLabel}
                          className={
                            thinking
                              ? 'text-slate-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {thinking ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                      {!msg.error && msg.text.trim() && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTranslateMsgId((prev) =>
                              prev === msg.id ? null : msg.id,
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                          <Languages className="w-3 h-3" />
                          <span>{t.translateBtn}</span>
                        </button>
                      )}
                    </div>
                    {!msg.error &&
                      renderMessageTranslationBlock(
                        msg.id,
                        msg.text,
                        isMe ? 'right' : 'left',
                      )}
                  </div>
                );
              })}
              {thinking && (
                <div className="flex items-start">
                  <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>{t.deepThinkTyping}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {activeConversation.kind === 'dm' && (
            <>
              {dmMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                  <Lock className="w-6 h-6 text-emerald-600 mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t.emptyChatTitlePrefix} {activePeer?.name ?? ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t.emptyChatHint}
                  </p>
                </div>
              ) : (
                dmMessages.map((msg) => {
                  const isMe = msg.sender === 'me';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isMe
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {msg.audioData ? (
                          <VoiceNotePlayer
                            src={msg.audioData}
                            durationSec={msg.audioDuration}
                            isMe={isMe}
                            label={t.voiceMessageLabel}
                          />
                        ) : (
                          msg.text
                        )}
                      </div>
                      <div className="mt-1 px-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                        <span>{msg.timestamp}</span>
                        {isMe && (
                          <span
                            title={msg.read ? t.msgReadLabel : t.msgSentLabel}
                            aria-label={msg.read ? t.msgReadLabel : t.msgSentLabel}
                            className={
                              msg.read
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }
                          >
                            {msg.read ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
                        {msg.audioData ? (
                          <button
                            type="button"
                            disabled={transcribingMsgId === msg.id}
                            onClick={() =>
                              void handleTranscribeVoice(msg.id, msg.audioData!)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            {transcribingMsgId === msg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Captions className="w-3 h-3" />
                            )}
                            <span>
                              {transcribingMsgId === msg.id
                                ? t.transcribingLabel
                                : t.transcribeBtn}
                            </span>
                          </button>
                        ) : (
                          msg.text.trim() && (
                            <button
                              type="button"
                              onClick={() =>
                                setOpenTranslateMsgId((prev) =>
                                  prev === msg.id ? null : msg.id,
                                )
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              <Languages className="w-3 h-3" />
                              <span>{t.translateBtn}</span>
                            </button>
                          )
                        )}
                      </div>
                      {msg.audioData
                        ? renderVoiceTranscriptBlock(
                            msg.id,
                            isMe ? 'right' : 'left',
                          )
                        : renderMessageTranslationBlock(
                            msg.id,
                            msg.text,
                            isMe ? 'right' : 'left',
                          )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeConversation.kind === 'group' && (
            <>
              {groupMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                  <Users className="w-6 h-6 text-emerald-600 mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {activeGroup?.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t.emptyChatHint}
                  </p>
                </div>
              ) : (
                groupMessages.map((msg) => {
                  const isMe = msg.senderId === currentUserId;
                  const isRead =
                    isMe && msg.ms > 0 && maxOtherGroupReadMs >= msg.ms;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      {!isMe && (
                        <span className="px-1 mb-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isMe
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {msg.audioData ? (
                          <VoiceNotePlayer
                            src={msg.audioData}
                            durationSec={msg.audioDuration}
                            isMe={isMe}
                            label={t.voiceMessageLabel}
                          />
                        ) : (
                          msg.text
                        )}
                      </div>
                      <div className="mt-1 px-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                        <span>{msg.timestamp}</span>
                        {isMe && (
                          <span
                            title={isRead ? t.msgReadLabel : t.msgSentLabel}
                            aria-label={isRead ? t.msgReadLabel : t.msgSentLabel}
                            className={
                              isRead
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }
                          >
                            {isRead ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
                        {msg.audioData ? (
                          <button
                            type="button"
                            disabled={transcribingMsgId === msg.id}
                            onClick={() =>
                              void handleTranscribeVoice(msg.id, msg.audioData!)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                          >
                            {transcribingMsgId === msg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Captions className="w-3 h-3" />
                            )}
                            <span>
                              {transcribingMsgId === msg.id
                                ? t.transcribingLabel
                                : t.transcribeBtn}
                            </span>
                          </button>
                        ) : (
                          msg.text.trim() && (
                            <button
                              type="button"
                              onClick={() =>
                                setOpenTranslateMsgId((prev) =>
                                  prev === msg.id ? null : msg.id,
                                )
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              <Languages className="w-3 h-3" />
                              <span>{t.translateBtn}</span>
                            </button>
                          )
                        )}
                      </div>
                      {msg.audioData
                        ? renderVoiceTranscriptBlock(
                            msg.id,
                            isMe ? 'right' : 'left',
                          )
                        : renderMessageTranslationBlock(
                            msg.id,
                            msg.text,
                            isMe ? 'right' : 'left',
                          )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeConversation.kind === 'channel' && activeChannel && (
            <>
              {!canReadActiveChannel ? (
                <div className="py-2 sm:py-4 flex justify-center">
                  <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 p-5 sm:p-6 space-y-4 shadow-xs">
                    {isVipExpired && (
                      <div className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 space-y-1">
                        <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{t.vipExpiredTitle}</span>
                        </div>
                        <p className="text-xs text-rose-700 dark:text-rose-200 leading-relaxed">
                          {t.vipExpiredDesc}
                        </p>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Crown className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                            {t.vipLockedTitle}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                            {isOneTimeChannel
                              ? t.vipOnceBadge
                              : t.vipBillingMonthlyLabel}
                          </span>
                        </div>
                        {activeChannel.vipPriceLabel && (
                          <p className="mt-0.5 text-sm font-bold text-amber-700 dark:text-amber-400">
                            {activeChannel.vipPriceLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {isOneTimeChannel ? t.vipLockedOnceDesc : t.vipLockedDesc}
                    </p>

                    {activeChannel.vipPaymentInfo && (
                      <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 p-3.5 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          {t.vipHowToPayTitle}
                        </p>
                        <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed">
                          {activeChannel.vipPaymentInfo}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {(() => {
                            const match = activeChannel.vipPaymentInfo.match(
                              /https?:\/\/[^\s)]+/i,
                            );
                            const safePaymentUrl =
                              match && /^https?:\/\//i.test(match[0])
                                ? match[0]
                                : '';
                            return safePaymentUrl ? (
                              <a
                                href={safePaymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 inline-flex items-center gap-1.5"
                              >
                                <span>{t.vipOpenPaymentLink}</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : null;
                          })()}
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard?.writeText) {
                                navigator.clipboard
                                  .writeText(activeChannel.vipPaymentInfo || '')
                                  .catch(() => {});
                              }
                              setCopiedVipInfo(true);
                              window.setTimeout(
                                () => setCopiedVipInfo(false),
                                2500,
                              );
                            }}
                            className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                          >
                            {copiedVipInfo ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{t.vipCopiedToast}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{t.vipCopyPaymentInfo}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Latest Submitted Receipt Status */}
                    {myVipReceipts.length > 0 && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2">
                        {(() => {
                          const latest = myVipReceipts[0];
                          return (
                            <>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                                    latest.status === 'approved'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                      : latest.status === 'rejected'
                                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                                        : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {latest.status === 'approved'
                                      ? isOneTimeChannel
                                        ? t.vipApprovedLifetimeStatus
                                        : t.vipApprovedStatus
                                      : latest.status === 'rejected'
                                        ? t.vipRejectedStatus
                                        : t.vipPendingStatus}
                                  </span>
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 ${
                                    latest.aiVerdict === 'match'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                      : latest.aiVerdict === 'mismatch'
                                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  {latest.aiVerdict === 'match' ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : latest.aiVerdict === 'mismatch' ? (
                                    <XCircle className="w-3 h-3" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3" />
                                  )}
                                  <span>
                                    {latest.aiVerdict === 'match'
                                      ? t.vipVerdictMatch
                                      : latest.aiVerdict === 'mismatch'
                                        ? t.vipVerdictMismatch
                                        : latest.aiVerdict === 'review'
                                          ? t.vipVerdictReview
                                          : t.vipVerdictUnavailable}
                                  </span>
                                </span>
                              </div>
                              {latest.aiSummary && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {latest.aiSummary}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Submit Payment Receipt Form */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (receiptSubmitting) return;
                        if (!receiptAmount.trim() && !receiptImage) {
                          setReceiptError(t.vipErrNeedAmountOrImage);
                          return;
                        }
                        setReceiptError(null);
                        setReceiptSubmitting(true);
                        try {
                          await submitChannelVipReceipt({
                            channelId: activeChannel.id,
                            creatorId: activeChannel.creatorId,
                            channelName: activeChannel.name,
                            vipPriceLabel: activeChannel.vipPriceLabel,
                            vipPaymentInfo: activeChannel.vipPaymentInfo,
                            user: currentUser,
                            amountText: receiptAmount,
                            referenceText: receiptRef,
                            note: receiptNote,
                            receiptImage: receiptImage || undefined,
                            language,
                          });
                          setReceiptRef('');
                          setReceiptNote('');
                          setReceiptImage('');
                          if (receiptFileInputRef.current) {
                            receiptFileInputRef.current.value = '';
                          }
                          onShowToast?.(
                            isOneTimeChannel
                              ? t.vipReceiptSentOnceToast
                              : t.vipReceiptSentToast,
                          );
                        } catch (err) {
                          setReceiptError(
                            err instanceof Error
                              ? err.message
                              : 'Unable to submit receipt.',
                          );
                        } finally {
                          setReceiptSubmitting(false);
                        }
                      }}
                      className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        <ReceiptText className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>{t.vipSubmitReceiptTitle}</span>
                      </div>

                      {receiptError && (
                        <div className="rounded-xl p-2.5 text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          {receiptError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label
                            htmlFor="vip-receipt-amount"
                            className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t.vipAmountPaidLabel}
                          </label>
                          <input
                            id="vip-receipt-amount"
                            type="text"
                            maxLength={60}
                            value={receiptAmount}
                            onChange={(e) => setReceiptAmount(e.target.value)}
                            placeholder={activeChannel.vipPriceLabel || '₦2,000'}
                            className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="vip-receipt-ref"
                            className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t.vipReferenceLabel}
                          </label>
                          <input
                            id="vip-receipt-ref"
                            type="text"
                            maxLength={120}
                            value={receiptRef}
                            onChange={(e) => setReceiptRef(e.target.value)}
                            placeholder="OPay / Ref / Suna"
                            className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="vip-receipt-note"
                          className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
                        >
                          {t.vipNoteLabel}
                        </label>
                        <input
                          id="vip-receipt-note"
                          type="text"
                          maxLength={500}
                          value={receiptNote}
                          onChange={(e) => setReceiptNote(e.target.value)}
                          placeholder="..."
                          className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <input
                          ref={receiptFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setReceiptError(null);
                            try {
                              const compressed =
                                await compressReceiptImage(file);
                              setReceiptImage(compressed);
                            } catch (err) {
                              setReceiptError(
                                err instanceof Error
                                  ? err.message
                                  : 'Unable to load receipt image.',
                              );
                            }
                          }}
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => receiptFileInputRef.current?.click()}
                            className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center gap-1.5"
                          >
                            <ImagePlus className="w-4 h-4 text-amber-600" />
                            <span>
                              {receiptImage
                                ? t.vipChangeReceiptBtn
                                : t.vipPickReceiptBtn}
                            </span>
                          </button>

                          {receiptImage && (
                            <button
                              type="button"
                              onClick={() => {
                                setReceiptImage('');
                                if (receiptFileInputRef.current) {
                                  receiptFileInputRef.current.value = '';
                                }
                              }}
                              className="min-h-[40px] px-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            >
                              {t.cancel}
                            </button>
                          )}
                        </div>

                        {receiptImage && (
                          <img
                            src={receiptImage}
                            alt={t.vipReceiptImageLabel}
                            className="max-h-36 rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
                          />
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={receiptSubmitting}
                        className="w-full min-h-[44px] px-4 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        {receiptSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t.vipVerifyingReceiptBtn}</span>
                          </>
                        ) : (
                          <>
                            <ReceiptText className="w-4 h-4" />
                            <span>{t.vipSubmitReceiptBtn}</span>
                          </>
                        )}
                      </button>
                    </form>

                    <div className="pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.vipWaitingActivation}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectConversation(
                            { kind: 'dm', userId: activeChannel.creatorId },
                            true,
                          )
                        }
                        className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                      >
                        {t.vipMessageCreatorBtn}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {activeChannel.isVip && (
                    <div className="rounded-xl px-3.5 py-2 bg-amber-50 dark:bg-amber-950/35 border border-amber-200/70 dark:border-amber-800/50 text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-2">
                        <Crown className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {vipDocState.exists && vipDocState.accessMode === 'lifetime'
                            ? t.vipLifetimeBanner
                            : vipDaysLeft !== null
                              ? `${t.vipAutoLockBanner} ${vipDaysLeft} ${t.vipDaysWord}`
                              : isOneTimeChannel
                                ? t.vipLifetimeBanner
                                : t.vipBroadcastHint}
                        </span>
                      </span>
                    </div>
                  )}

                  {channelPosts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                      {activeChannel.isVip ? (
                        <Crown className="w-6 h-6 text-amber-600 mb-2" />
                      ) : (
                        <Megaphone className="w-6 h-6 text-teal-600 mb-2" />
                      )}
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {activeChannel.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {activeChannel.description || t.channelReadOnlyHint}
                      </p>
                    </div>
                  ) : (
                    channelPosts.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5"
                      >
                        {item.audioData ? (
                          <VoiceNotePlayer
                            src={item.audioData}
                            durationSec={item.audioDuration}
                            label={t.voiceMessageLabel}
                          />
                        ) : (
                          <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
                            {item.text}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 tabular-nums">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              {item.authorName} · {item.timestamp}
                            </span>
                            {item.audioData ? (
                              <button
                                type="button"
                                disabled={transcribingMsgId === item.id}
                                onClick={() =>
                                  void handleTranscribeVoice(
                                    item.id,
                                    item.audioData!,
                                  )
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                              >
                                {transcribingMsgId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Captions className="w-3 h-3" />
                                )}
                                <span>
                                  {transcribingMsgId === item.id
                                    ? t.transcribingLabel
                                    : t.transcribeBtn}
                                </span>
                              </button>
                            ) : (
                              item.text.trim() && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenTranslateMsgId((prev) =>
                                      prev === item.id ? null : item.id,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                >
                                  <Languages className="w-3 h-3" />
                                  <span>{t.translateBtn}</span>
                                </button>
                              )
                            )}
                          </div>
                          {item.authorId === currentUserId && (
                            <span
                              title={
                                activeChannel.followersCount > 0
                                  ? t.msgReadLabel
                                  : t.msgSentLabel
                              }
                              aria-label={
                                activeChannel.followersCount > 0
                                  ? t.msgReadLabel
                                  : t.msgSentLabel
                              }
                              className={
                                activeChannel.followersCount > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {activeChannel.followersCount > 0 ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                        </div>
                        {item.audioData
                          ? renderVoiceTranscriptBlock(item.id, 'full')
                          : renderMessageTranslationBlock(
                              item.id,
                              item.text,
                              'full',
                            )}
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}

        </div>

        {/* Voice Recorder Error Notice */}
        {voiceError && (
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/50 border-t border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              aria-label={t.cancel}
              className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Composer or Channel Read-Only Footer */}
        {activeConversation.kind === 'channel' && !isChannelOwner ? (
          <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400 shrink-0">
            {t.channelReadOnlyHint}
          </div>
        ) : recording ? (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={cancelVoiceRecording}
              aria-label={t.cancelRecording}
              className="min-h-[44px] min-w-[44px] px-3 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 inline-flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.cancelRecording}</span>
            </button>

            <div className="flex-1 flex items-center justify-center gap-2 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Mic className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="truncate text-xs sm:text-sm">
                {t.recordingVoice}
              </span>
              <span className="tabular-nums font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                {Math.floor(recordSec / 60)}:
                {String(recordSec % 60).padStart(2, '0')}
              </span>
            </div>

            <button
              type="button"
              onClick={finishAndSendVoiceRecording}
              disabled={sending}
              aria-label={t.sendVoiceNote}
              className="min-h-[44px] min-w-[44px] px-4 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">
                {t.send}
              </span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 shrink-0"
          >
            {activeConversation.kind === 'deep_think' && (
              <BrainCircuit
                className="w-5 h-5 text-emerald-600 shrink-0 hidden sm:block ml-1"
                aria-hidden="true"
              />
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeConversation.kind === 'deep_think'
                  ? t.askDeepThinkPlaceholder
                  : activeConversation.kind === 'channel'
                    ? t.broadcastPlaceholder
                    : t.writeMessagePlaceholder
              }
              aria-label={t.writeMessagePlaceholder}
              className="flex-1 min-w-0 min-h-[44px] px-4 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {activeConversation.kind !== 'deep_think' && (
              <button
                type="button"
                onClick={() => void startVoiceRecording()}
                disabled={sending}
                aria-label={t.voiceMicLabel}
                title={t.voiceMicLabel}
                className="min-h-[44px] min-w-[44px] rounded-full bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 disabled:opacity-40 transition-colors inline-flex items-center justify-center shrink-0"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || thinking || sending}
              aria-label={t.send}
              className="min-h-[44px] min-w-[44px] px-4 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">
                {t.send}
              </span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
