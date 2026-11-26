export type RoomInviteKind = 'group' | 'channel';

export interface PendingRoomInvite {
  kind: RoomInviteKind;
  id: string;
}

const VALID_ROOM_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const SHORT_LINK_CACHE_PREFIX = 'wc_short_invite_v1';
const inflightShortenRequests = new Map<string, Promise<string>>();

export function buildRoomInviteLink(
  kind: RoomInviteKind,
  roomId: string,
): string {
  if (typeof window === 'undefined') return '';
  const prefix = kind === 'group' ? 'g' : 'c';
  return `${window.location.origin}/${prefix}/${encodeURIComponent(roomId)}`;
}

export function getCachedShortInviteLink(
  kind: RoomInviteKind,
  roomId: string,
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `${SHORT_LINK_CACHE_PREFIX}:${window.location.origin}:${kind}:${roomId}`;
    const cached = localStorage.getItem(key);
    if (
      cached &&
      /^https:\/\/(tinyurl\.com|is\.gd)\/[a-zA-Z0-9_-]{3,40}$/.test(cached)
    ) {
      return cached;
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export async function shortenRoomInviteLink(
  kind: RoomInviteKind,
  roomId: string,
): Promise<{ url: string; shortened: boolean }> {
  const fallbackUrl = buildRoomInviteLink(kind, roomId);
  if (typeof window === 'undefined' || !VALID_ROOM_ID_RE.test(roomId)) {
    return { url: fallbackUrl, shortened: false };
  }

  const cached = getCachedShortInviteLink(kind, roomId);
  if (cached) {
    return { url: cached, shortened: true };
  }

  const cacheKey = `${SHORT_LINK_CACHE_PREFIX}:${window.location.origin}:${kind}:${roomId}`;
  const existing = inflightShortenRequests.get(cacheKey);
  if (existing) {
    const url = await existing;
    return {
      url,
      shortened: /^https:\/\/(tinyurl\.com|is\.gd)\//.test(url),
    };
  }

  const reqPromise = (async (): Promise<string> => {
    try {
      const res = await fetch('/api/shorten-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          roomId,
          origin: window.location.origin,
        }),
      });
      if (!res.ok) return fallbackUrl;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return fallbackUrl;
      const data = (await res.json()) as {
        shortUrl?: unknown;
        shortened?: unknown;
      };
      if (
        typeof data.shortUrl === 'string' &&
        data.shortened === true &&
        /^https:\/\/(tinyurl\.com|is\.gd)\/[a-zA-Z0-9_-]{3,40}$/.test(
          data.shortUrl,
        )
      ) {
        try {
          localStorage.setItem(cacheKey, data.shortUrl);
        } catch {
          // Ignore storage quota errors
        }
        return data.shortUrl;
      }
      return fallbackUrl;
    } catch {
      return fallbackUrl;
    } finally {
      inflightShortenRequests.delete(cacheKey);
    }
  })();

  inflightShortenRequests.set(cacheKey, reqPromise);
  const url = await reqPromise;
  return {
    url,
    shortened: /^https:\/\/(tinyurl\.com|is\.gd)\//.test(url),
  };
}

export function parsePendingRoomInviteFromUrl(): PendingRoomInvite | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);

    const pathMatch = url.pathname.match(/^\/(g|c)\/([a-zA-Z0-9_-]{1,128})\/?$/);
    if (pathMatch) {
      const kind: RoomInviteKind = pathMatch[1] === 'g' ? 'group' : 'channel';
      const id = pathMatch[2];
      window.history.replaceState({}, '', '/' + url.search + url.hash);
      return { kind, id };
    }

    const joinGroup = url.searchParams.get('joinGroup')?.trim() ?? '';
    if (joinGroup && VALID_ROOM_ID_RE.test(joinGroup)) {
      url.searchParams.delete('joinGroup');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return { kind: 'group', id: joinGroup };
    }

    const joinChannel = url.searchParams.get('joinChannel')?.trim() ?? '';
    if (joinChannel && VALID_ROOM_ID_RE.test(joinChannel)) {
      url.searchParams.delete('joinChannel');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return { kind: 'channel', id: joinChannel };
    }
  } catch {
    return null;
  }
  return null;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for restricted iframe contexts
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrCopyInviteLink(params: {
  title: string;
  text: string;
  url: string;
}): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: params.title,
        text: params.text,
        url: params.url,
      });
      return 'shared';
    } catch {
      // User dismissed or share blocked in iframe -> fall back to clipboard copy
    }
  }
  await copyTextToClipboard(params.url);
  return 'copied';
}
