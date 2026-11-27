import { extractReadableError } from './thinkApi';

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  thumbnailUrl: string;
  description?: string;
  source: 'api' | 'rss';
}

export interface YouTubeChannelPreset {
  id: string;
  label: string;
}

export const CURATED_YOUTUBE_CHANNELS: YouTubeChannelPreset[] = [
  { id: 'UCZXbvNkOqOKGdaiV82_3zAQ', label: 'BBC News Hausa' },
  { id: 'UC8butISFwT-Wl7EV0hUK0BQ', label: 'freeCodeCamp' },
  { id: 'UCsooa4yRKGN_zEE8iknghZA', label: 'TED-Ed' },
  { id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', label: 'Google Developers' },
];

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{20,28}$/;
const CACHE_PREFIX = 'wc_yt_cache_v1:';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]}]+/gi;

export function extractYouTubeVideoIdFromUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim().replace(/[.,!?;:]+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  let candidate = '';

  if (host === 'youtu.be') {
    candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
      candidate = parsed.searchParams.get('v') || '';
    } else if (
      segments.length >= 2 &&
      (segments[0] === 'shorts' ||
        segments[0] === 'embed' ||
        segments[0] === 'live' ||
        segments[0] === 'v')
    ) {
      candidate = segments[1] || '';
    } else {
      candidate = parsed.searchParams.get('v') || '';
    }
  } else {
    return null;
  }

  return VIDEO_ID_RE.test(candidate) ? candidate : null;
}

export function extractYouTubeVideoIds(text: string, limit = 2): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(URL_IN_TEXT_RE);
  if (!matches || matches.length === 0) return [];

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const rawUrl of matches) {
    const id = extractYouTubeVideoIdFromUrl(rawUrl);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
      if (ids.length >= limit) break;
    }
  }
  return ids;
}

export function extractYouTubeChannelId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (CHANNEL_ID_RE.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,28})/i);
  if (match && CHANNEL_ID_RE.test(match[1])) {
    return match[1];
  }
  return null;
}

export function getYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  if (!VIDEO_ID_RE.test(videoId)) return '';
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
  });
  if (autoplay) {
    params.set('autoplay', '1');
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

interface CachedFeedPayload {
  savedAt: number;
  videos: YouTubeVideoItem[];
  source: 'api' | 'rss';
}

function readCachedFeed(key: string): CachedFeedPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedFeedPayload>;
    if (
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt < CACHE_TTL_MS &&
      Array.isArray(parsed.videos)
    ) {
      return {
        savedAt: parsed.savedAt,
        videos: parsed.videos,
        source: parsed.source === 'api' ? 'api' : 'rss',
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function writeCachedFeed(
  key: string,
  videos: YouTubeVideoItem[],
  source: 'api' | 'rss',
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedFeedPayload = {
      savedAt: Date.now(),
      videos,
      source,
    };
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export type YouTubeApiNoticeKind =
  | 'none'
  | 'no_key_using_rss'
  | 'api_not_enabled_using_rss'
  | 'quota_using_rss';

export interface YouTubeFeedResult {
  videos: YouTubeVideoItem[];
  source: 'api' | 'rss';
  fromCache: boolean;
  noticeKind: YouTubeApiNoticeKind;
  noticeDetail?: string;
}

function decodeHtmlEntitiesClient(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getBrowserYouTubeApiKey(): string {
  const ytKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_YOUTUBE_API_KEY
      ? String(import.meta.env.VITE_YOUTUBE_API_KEY)
      : '';
  const geminiKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY
      ? String(import.meta.env.VITE_GEMINI_API_KEY)
      : '';
  return (ytKey || geminiKey).trim().replace(/^["']|["']$/g, '');
}

async function fetchRssFallback(params: {
  channelId?: string;
  query?: string;
}): Promise<YouTubeVideoItem[]> {
  const search = new URLSearchParams();
  if (params.channelId) search.set('channelId', params.channelId);
  if (params.query) search.set('q', params.query);
  const qs = search.toString();
  const res = await fetch(`/api/youtube${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const text = await res.text().catch(() => '');
  let payload: { videos?: unknown; error?: unknown } = {};
  try {
    payload = text ? (JSON.parse(text) as { videos?: unknown; error?: unknown }) : {};
  } catch {
    payload = {};
  }
  if (!res.ok) {
    throw new Error(
      extractReadableError(payload, `Unable to load YouTube channel feed (HTTP ${res.status}).`),
    );
  }
  return Array.isArray(payload.videos) ? (payload.videos as YouTubeVideoItem[]) : [];
}

async function fetchViaYouTubeDataApiV3(params: {
  apiKey: string;
  query?: string;
}): Promise<{
  videos: YouTubeVideoItem[];
  noticeKind: YouTubeApiNoticeKind;
  noticeDetail?: string;
}> {
  const endpoint = params.query
    ? `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
        part: 'snippet',
        type: 'video',
        videoEmbeddable: 'true',
        safeSearch: 'moderate',
        maxResults: '12',
        q: params.query,
        key: params.apiKey,
      }).toString()}`
    : `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({
        part: 'snippet',
        chart: 'mostPopular',
        maxResults: '12',
        key: params.apiKey,
      }).toString()}`;

  const res = await fetch(endpoint, { method: 'GET' });
  const data = (await res.json().catch(() => ({}))) as {
    items?: Array<{
      id?: string | { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        channelId?: string;
        publishedAt?: string;
        description?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
    error?: {
      code?: number;
      message?: string;
      errors?: Array<{ reason?: string; message?: string }>;
    };
  };

  if (!res.ok) {
    const reasons = (data.error?.errors || []).map((e) => (e.reason || '').toLowerCase());
    const msg = extractReadableError(data, `YouTube API HTTP ${res.status}`);
    const lower = msg.toLowerCase();
    if (
      res.status === 429 ||
      reasons.some((r) => r.includes('quota') || r.includes('ratelimit')) ||
      lower.includes('quota')
    ) {
      return {
        videos: [],
        noticeKind: 'quota_using_rss',
        noticeDetail: msg,
      };
    }
    return {
      videos: [],
      noticeKind: 'api_not_enabled_using_rss',
      noticeDetail: msg,
    };
  }

  const videos: YouTubeVideoItem[] = [];
  for (const item of data.items || []) {
    const rawId = typeof item.id === 'string' ? item.id : item.id?.videoId || '';
    if (!VIDEO_ID_RE.test(rawId) || !item.snippet?.title) continue;
    const thumb =
      item.snippet.thumbnails?.high?.url ||
      item.snippet.thumbnails?.medium?.url ||
      item.snippet.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${rawId}/hqdefault.jpg`;

    videos.push({
      id: rawId,
      title: decodeHtmlEntitiesClient(item.snippet.title),
      channelTitle: decodeHtmlEntitiesClient(item.snippet.channelTitle || 'YouTube'),
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt || '',
      thumbnailUrl: thumb,
      description: decodeHtmlEntitiesClient(item.snippet.description || '').slice(0, 240),
      source: 'api',
    });
  }

  return {
    videos,
    noticeKind: 'none',
  };
}

export async function fetchYouTubeVideos(options: {
  query?: string;
  channelId?: string;
  bypassCache?: boolean;
}): Promise<YouTubeFeedResult> {
  const query = (options.query || '').trim();
  const channelId = (options.channelId || '').trim();
  const cacheKey = `${channelId || 'all'}:${query.toLowerCase()}`;

  if (!options.bypassCache) {
    const cached = readCachedFeed(cacheKey);
    if (cached) {
      return {
        videos: cached.videos,
        source: cached.source,
        fromCache: true,
        noticeKind: 'none',
      };
    }
  }

  // Channel ID requests always use the zero-quota public RSS feed endpoint.
  if (channelId) {
    const rssVideos = await fetchRssFallback({ channelId, query });
    writeCachedFeed(cacheKey, rssVideos, 'rss');
    return {
      videos: rssVideos,
      source: 'rss',
      fromCache: false,
      noticeKind: 'none',
    };
  }

  const apiKey = getBrowserYouTubeApiKey();
  if (apiKey) {
    try {
      const apiRes = await fetchViaYouTubeDataApiV3({ apiKey, query });
      if (apiRes.noticeKind === 'none' && apiRes.videos.length > 0) {
        writeCachedFeed(cacheKey, apiRes.videos, 'api');
        return {
          videos: apiRes.videos,
          source: 'api',
          fromCache: false,
          noticeKind: 'none',
        };
      }
      const rssVideos = await fetchRssFallback({ query });
      if (rssVideos.length > 0) {
        writeCachedFeed(cacheKey, rssVideos, 'rss');
      }
      return {
        videos: rssVideos,
        source: 'rss',
        fromCache: false,
        noticeKind: apiRes.noticeKind,
        noticeDetail: apiRes.noticeDetail,
      };
    } catch (err) {
      const rssVideos = await fetchRssFallback({ query });
      return {
        videos: rssVideos,
        source: 'rss',
        fromCache: false,
        noticeKind: 'api_not_enabled_using_rss',
        noticeDetail: extractReadableError(err),
      };
    }
  }

  const rssVideos = await fetchRssFallback({ query });
  if (rssVideos.length > 0) {
    writeCachedFeed(cacheKey, rssVideos, 'rss');
  }
  return {
    videos: rssVideos,
    source: 'rss',
    fromCache: false,
    noticeKind: 'no_key_using_rss',
  };
}
