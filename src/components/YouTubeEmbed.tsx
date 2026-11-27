import { getYouTubeEmbedUrl } from '../lib/youtube';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
  compact?: boolean;
}

export function YouTubeEmbed({
  videoId,
  title = 'YouTube video player',
  autoplay = false,
  compact = false,
}: YouTubeEmbedProps) {
  const embedUrl = getYouTubeEmbedUrl(videoId, autoplay);
  if (!embedUrl) return null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-black shadow-xs ${
        compact ? 'w-full max-w-[320px] sm:max-w-[380px] mt-1.5' : 'w-full mt-3'
      }`}
    >
      <div className="relative w-full aspect-video">
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    </div>
  );
}
