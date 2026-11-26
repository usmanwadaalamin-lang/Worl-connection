import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';

interface VoiceNotePlayerProps {
  src: string;
  durationSec?: number;
  isMe?: boolean;
  label: string;
}

function formatSec(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VoiceNotePlayer({
  src,
  durationSec = 0,
  isMe = false,
  label,
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.round(audio.duration));
      }
    };
    const onTime = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  const progress =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px] sm:min-w-[230px] py-0.5">
      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={label}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isMe
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {playing ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div
          className={`h-1.5 rounded-full overflow-hidden ${
            isMe ? 'bg-white/30' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        >
          <div
            className={`h-full rounded-full transition-all ${
              isMe ? 'bg-white' : 'bg-emerald-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between text-[11px] tabular-nums ${
            isMe ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span className="inline-flex items-center gap-1 truncate">
            <Mic className="w-3 h-3 shrink-0" />
            <span>{label}</span>
          </span>
          <span>{formatSec(playing ? currentTime : duration)}</span>
        </div>
      </div>
    </div>
  );
}
