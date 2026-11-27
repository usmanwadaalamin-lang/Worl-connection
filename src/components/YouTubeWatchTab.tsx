import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Tv,
  X,
} from 'lucide-react';
import { Translations } from '../lib/i18n';
import { extractReadableError } from '../lib/thinkApi';
import {
  CURATED_YOUTUBE_CHANNELS,
  extractYouTubeChannelId,
  extractYouTubeVideoIdFromUrl,
  fetchYouTubeVideos,
  YouTubeVideoItem,
} from '../lib/youtube';
import { YouTubeEmbed } from './YouTubeEmbed';

interface YouTubeWatchTabProps {
  t: Translations;
}

function formatVideoDate(iso: string): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function YouTubeWatchTab({ t }: YouTubeWatchTabProps) {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<YouTubeVideoItem | null>(null);
  const [feedSource, setFeedSource] = useState<'api' | 'rss'>('rss');

  const loadFeed = useCallback(
    async (opts: { query?: string; channelId?: string; bypassCache?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchYouTubeVideos({
          query: opts.query,
          channelId: opts.channelId,
          bypassCache: opts.bypassCache,
        });
        setVideos(result.videos);
        setFeedSource(result.source);
      } catch (err) {
        setVideos([]);
        setError(extractReadableError(err, t.ytLoadErrorFallback));
      } finally {
        setLoading(false);
      }
    },
    [t.ytLoadErrorFallback],
  );

  useEffect(() => {
    void loadFeed({ query: activeQuery, channelId: activeChannelId });
  }, [activeQuery, activeChannelId, loadFeed]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setActiveQuery('');
      setActiveChannelId('');
      return;
    }

    // If the user pasted a direct YouTube watch/shorts/youtu.be link, play it directly in-app!
    const directVideoId = extractYouTubeVideoIdFromUrl(trimmed);
    if (directVideoId) {
      setActiveVideo({
        id: directVideoId,
        title: t.ytDirectVideoTitle,
        channelTitle: 'YouTube',
        publishedAt: '',
        thumbnailUrl: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
        source: 'rss',
      });
      return;
    }

    // If the user pasted a Channel ID (UC...) or /channel/UC... URL, load that channel's RSS feed!
    const parsedChannelId = extractYouTubeChannelId(trimmed);
    if (parsedChannelId) {
      setActiveQuery('');
      setActiveChannelId(parsedChannelId);
      return;
    }

    setActiveChannelId('');
    setActiveQuery(trimmed);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
    setActiveChannelId('');
  };

  return (
    <div className="space-y-4">
      {/* Header + Search / Channel ID Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {t.ytTabTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t.ytTabSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadFeed({
                query: activeQuery,
                channelId: activeChannelId,
                bypassCache: true,
              })
            }
            disabled={loading}
            aria-label={t.ytRefreshBtn}
            title={t.ytRefreshBtn}
            className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.ytRefreshBtn}</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.ytSearchPlaceholder}
              aria-label={t.ytSearchPlaceholder}
              className="w-full min-h-[42px] pl-10 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label={t.cancel}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {t.ytSearchBtn}
          </button>
        </form>

        {/* Curated Zero-Quota Channel Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveChannelId('');
              setActiveQuery('');
              setSearchInput('');
            }}
            className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              !activeChannelId && !activeQuery
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t.ytAllChannelsChip}
          </button>
          {CURATED_YOUTUBE_CHANNELS.map((ch) => {
            const selected = activeChannelId === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setActiveQuery('');
                  setActiveChannelId(ch.id);
                }}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selected
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Embedded In-App Player */}
      {activeVideo && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-4 space-y-2.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {t.ytNowPlayingLabel}
              </p>
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                {activeVideo.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeVideo.channelTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveVideo(null)}
              aria-label={t.cancel}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <YouTubeEmbed
            videoId={activeVideo.id}
            title={activeVideo.title}
            autoplay
          />
        </div>
      )}

      {/* Video Feed Grid / Clear Error Banner */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <p className="text-sm font-medium">{t.ytLoadingLabel}</p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-2xl p-5 sm:p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed max-w-lg mx-auto break-words">
            {error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                void loadFeed({
                  query: activeQuery,
                  channelId: activeChannelId,
                  bypassCache: true,
                })
              }
              className="min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              {t.ytRefreshBtn}
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="min-h-[40px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t.ytAllChannelsChip}
              </button>
            )}
          </div>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2">
          <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {t.ytNoVideosTitle}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {t.ytNoVideosDesc}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((video) => {
            const isPlaying = activeVideo?.id === video.id;
            const dateLabel = formatVideoDate(video.publishedAt);
            return (
              <button
                key={video.id}
                type="button"
                onClick={() => setActiveVideo(video)}
                className={`text-left bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-all hover:shadow-md group ${
                  isPlaying
                    ? 'border-emerald-500 ring-2 ring-emerald-500/25'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="relative w-full aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/30 transition-colors flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-rose-600/95 group-hover:bg-rose-500 text-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-105">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </span>
                  </div>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-950/75 text-white text-[10px] font-semibold">
                    {feedSource === 'api' ? 'YouTube' : 'RSS'}
                  </span>
                </div>

                <div className="p-3.5 space-y-1">
                  <h4 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                    {video.title}
                  </h4>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate font-medium">{video.channelTitle}</span>
                    {dateLabel && (
                      <span className="shrink-0 tabular-nums text-[11px]">
                        {dateLabel}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
