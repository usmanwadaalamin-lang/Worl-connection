import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export const MAX_SHORT_VIDEO_SECONDS = 60;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const CHUNK_RAW_BYTES = 440_000;

export interface ProcessedPostMedia {
  mediaType: 'image' | 'video';
  mimeType: string;
  blob: Blob;
  posterDataUrl: string;
  durationSec: number;
  width: number;
  height: number;
}

const mediaUrlCache = new Map<string, string>();
const inflightMediaLoads = new Map<string, Promise<string>>();

function bytesToBase64(bytes: Uint8Array): string {
  const blockSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += blockSize) {
    const slice = bytes.subarray(i, i + blockSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function renderPosterDataUrl(
  source: HTMLImageElement | HTMLVideoElement,
  srcWidth: number,
  srcHeight: number,
): string {
  const maxEdge = 480;
  const scale = Math.min(1, maxEdge / Math.max(1, srcWidth, srcHeight));
  const w = Math.max(1, Math.round(srcWidth * scale));
  const h = Math.max(1, Math.round(srcHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, w, h);

  for (const q of [0.72, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL('image/jpeg', q);
    if (dataUrl.length <= 100_000) return dataUrl;
  }
  return '';
}

export async function processImageForPost(
  file: File,
): Promise<ProcessedPostMedia> {
  if (!file.type.startsWith('image/')) {
    throw new Error('INVALID_MEDIA');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('INVALID_MEDIA'));
      el.src = objectUrl;
    });

    const natW = Math.max(1, img.naturalWidth || img.width || 1);
    const natH = Math.max(1, img.naturalHeight || img.height || 1);
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(natW, natH));
    const width = Math.min(4096, Math.max(1, Math.round(natW * scale)));
    const height = Math.min(4096, Math.max(1, Math.round(natH * scale)));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('INVALID_MEDIA');
    }
    ctx.drawImage(img, 0, 0, width, height);

    let chosenBlob: Blob | null = null;
    for (const q of [0.85, 0.72, 0.58, 0.45]) {
      const candidate = await canvasToBlob(canvas, 'image/jpeg', q);
      if (candidate && candidate.size <= 420_000) {
        chosenBlob = candidate;
        break;
      }
      if (candidate && (!chosenBlob || candidate.size < chosenBlob.size)) {
        chosenBlob = candidate;
      }
    }

    if (!chosenBlob || chosenBlob.size > MAX_UPLOAD_BYTES) {
      throw new Error('VIDEO_TOO_LARGE');
    }

    const posterDataUrl = renderPosterDataUrl(img, natW, natH);

    return {
      mediaType: 'image',
      mimeType: 'image/jpeg',
      blob: chosenBlob,
      posterDataUrl,
      durationSec: 0,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeVideoMimeType(file: File): string {
  const raw = (file.type || '').toLowerCase().split(';')[0].trim();
  if (
    raw === 'video/mp4' ||
    raw === 'video/webm' ||
    raw === 'video/quicktime'
  ) {
    return raw;
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.webm')) return 'video/webm';
  if (lowerName.endsWith('.mov')) return 'video/quicktime';
  if (lowerName.endsWith('.mp4') || lowerName.endsWith('.m4v')) {
    return 'video/mp4';
  }
  if (raw.startsWith('video/')) return 'video/mp4';
  return '';
}

async function captureVideoPoster(
  objectUrl: string,
  duration: number,
  width: number,
  height: number,
): Promise<string> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('timeout')), 4000);
      video.onloadeddata = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('error'));
      };
    });

    const seekTarget = Math.min(0.4, Math.max(0, duration * 0.2));
    if (seekTarget > 0.05) {
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 1200);
        video.onseeked = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        try {
          video.currentTime = seekTarget;
        } catch {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    }

    return renderPosterDataUrl(video, width, height);
  } catch {
    return '';
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

async function compressShortVideo(
  objectUrl: string,
  durationSec: number,
  srcWidth: number,
  srcHeight: number,
  onProgress?: (pct: number) => void,
): Promise<{ blob: Blob; mimeType: string; width: number; height: number }> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('VIDEO_TOO_LARGE');
  }

  const preferredMimes = [
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  const supportedMime = preferredMimes.find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  if (!supportedMime) {
    throw new Error('VIDEO_TOO_LARGE');
  }

  const maxEdge = 480;
  const scale = Math.min(1, maxEdge / Math.max(1, srcWidth, srcHeight));
  const outW = Math.max(2, Math.round((srcWidth * scale) / 2) * 2);
  const outH = Math.max(2, Math.round((srcHeight * scale) / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.captureStream !== 'function') {
    throw new Error('VIDEO_TOO_LARGE');
  }

  const video = document.createElement('video');
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = false;
  video.volume = 0.001;
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error('VIDEO_TOO_LARGE')),
        5000,
      );
      video.oncanplay = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('VIDEO_TOO_LARGE'));
      };
    });

    const canvasStream = canvas.captureStream(24);
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

    const capFn = (
      video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      }
    ).captureStream ||
      (
        video as HTMLVideoElement & {
          mozCaptureStream?: () => MediaStream;
        }
      ).mozCaptureStream;
    if (typeof capFn === 'function') {
      try {
        const videoStream = capFn.call(video);
        for (const audioTrack of videoStream.getAudioTracks()) {
          tracks.push(audioTrack);
        }
      } catch {
        // Proceed with video-only track if audio capture is restricted
      }
    }

    const combinedStream = new MediaStream(tracks);
    const targetBps = Math.min(
      950_000,
      Math.max(350_000, Math.floor((8_000_000 * 8) / Math.max(1, durationSec))),
    );
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: supportedMime,
      videoBitsPerSecond: targetBps,
    });

    const recordedChunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    const donePromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const cleanMime = supportedMime.startsWith('video/mp4')
          ? 'video/mp4'
          : 'video/webm';
        resolve(new Blob(recordedChunks, { type: cleanMime }));
      };
      recorder.onerror = () => reject(new Error('VIDEO_TOO_LARGE'));
    });

    let rafId = 0;
    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, outW, outH);
      if (durationSec > 0) {
        onProgress?.(
          Math.min(99, Math.round((video.currentTime / durationSec) * 100)),
        );
      }
      if (!video.paused && !video.ended) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    recorder.start(250);
    try {
      await video.play();
    } catch {
      video.muted = true;
      await video.play();
    }
    rafId = window.requestAnimationFrame(drawFrame);

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
      window.setTimeout(resolve, (durationSec + 2) * 1000);
    });

    window.cancelAnimationFrame(rafId);
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    for (const track of combinedStream.getTracks()) {
      track.stop();
    }

    const blob = await donePromise;
    onProgress?.(100);

    if (blob.size <= 0 || blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('VIDEO_TOO_LARGE');
    }

    return {
      blob,
      mimeType: blob.type || 'video/webm',
      width: outW,
      height: outH,
    };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

export async function processShortVideoForPost(
  file: File,
  onCompressProgress?: (pct: number) => void,
): Promise<ProcessedPostMedia> {
  const mimeType = normalizeVideoMimeType(file);
  if (!mimeType) {
    throw new Error('INVALID_MEDIA');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{
      duration: number;
      width: number;
      height: number;
    }>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const timeout = window.setTimeout(
        () => reject(new Error('INVALID_MEDIA')),
        8000,
      );
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const width = Math.min(4096, Math.max(1, video.videoWidth || 720));
        const height = Math.min(4096, Math.max(1, video.videoHeight || 1280));
        video.removeAttribute('src');
        resolve({ duration, width, height });
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('INVALID_MEDIA'));
      };
      video.src = objectUrl;
    });

    if (meta.duration <= 0) {
      throw new Error('INVALID_MEDIA');
    }
    if (meta.duration > MAX_SHORT_VIDEO_SECONDS) {
      throw new Error('VIDEO_TOO_LONG');
    }

    const durationSec = Math.max(
      1,
      Math.min(MAX_SHORT_VIDEO_SECONDS, Math.round(meta.duration)),
    );
    const posterDataUrl = await captureVideoPoster(
      objectUrl,
      meta.duration,
      meta.width,
      meta.height,
    );

    if (file.size <= MAX_UPLOAD_BYTES) {
      return {
        mediaType: 'video',
        mimeType,
        blob: file,
        posterDataUrl,
        durationSec,
        width: meta.width,
        height: meta.height,
      };
    }

    const compressed = await compressShortVideo(
      objectUrl,
      meta.duration,
      meta.width,
      meta.height,
      onCompressProgress,
    );

    return {
      mediaType: 'video',
      mimeType: compressed.mimeType,
      blob: compressed.blob,
      posterDataUrl,
      durationSec,
      width: compressed.width,
      height: compressed.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadPostMedia(params: {
  authorId: string;
  media: ProcessedPostMedia;
  onProgress?: (pct: number) => void;
}): Promise<string> {
  const { authorId, media, onProgress } = params;
  const buffer = await media.blob.arrayBuffer();
  const totalBytes = buffer.byteLength;
  if (totalBytes <= 0 || totalBytes > MAX_UPLOAD_BYTES) {
    throw new Error('VIDEO_TOO_LARGE');
  }

  const allBytes = new Uint8Array(buffer);
  const slices: string[] = [];
  for (let offset = 0; offset < allBytes.length; offset += CHUNK_RAW_BYTES) {
    const slice = allBytes.subarray(
      offset,
      Math.min(allBytes.length, offset + CHUNK_RAW_BYTES),
    );
    slices.push(bytesToBase64(slice));
  }

  const chunkCount = slices.length;
  if (chunkCount < 1 || chunkCount > 30) {
    throw new Error('VIDEO_TOO_LARGE');
  }

  const mediaRef = doc(collection(db, 'media'));
  const mediaId = mediaRef.id;
  onProgress?.(5);

  try {
    await setDoc(mediaRef, {
      authorId,
      mediaType: media.mediaType,
      mimeType: media.mimeType,
      chunkCount,
      totalBytes,
      durationSec: media.durationSec,
      width: media.width,
      height: media.height,
      visibility: 'public',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `media/${mediaId}`);
  }

  let completed = 0;
  const concurrency = 2;
  for (let i = 0; i < slices.length; i += concurrency) {
    const batch = slices.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (chunkData, offsetIdx) => {
        const index = i + offsetIdx;
        const chunkRef = doc(db, 'media', mediaId, 'chunks', `c_${index}`);
        try {
          await setDoc(chunkRef, {
            mediaId,
            authorId,
            index,
            data: chunkData,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `media/${mediaId}/chunks/c_${index}`,
          );
        }
        completed += 1;
        onProgress?.(Math.min(99, Math.round(5 + (completed / chunkCount) * 95)));
      }),
    );
  }

  // Pre-seed in-memory URL cache so the author's own feed plays immediately
  const cachedBlobUrl = URL.createObjectURL(media.blob);
  mediaUrlCache.set(mediaId, cachedBlobUrl);
  onProgress?.(100);
  return mediaId;
}

export async function loadPostMediaUrl(
  mediaId: string,
  fallbackMimeType?: string,
): Promise<string> {
  const existing = mediaUrlCache.get(mediaId);
  if (existing) return existing;

  const inflight = inflightMediaLoads.get(mediaId);
  if (inflight) return inflight;

  const task = (async () => {
    const metaSnap = await getDoc(doc(db, 'media', mediaId));
    const mimeType = metaSnap.exists()
      ? String(metaSnap.data().mimeType || fallbackMimeType || 'video/mp4')
      : fallbackMimeType || 'video/mp4';

    const chunksSnap = await getDocs(
      query(
        collection(db, 'media', mediaId, 'chunks'),
        where('mediaId', '==', mediaId),
      ),
    );

    const ordered = chunksSnap.docs
      .map((d) => ({
        index: Number(d.data().index ?? 0),
        data: String(d.data().data ?? ''),
      }))
      .filter((c) => c.data.length > 0)
      .sort((a, b) => a.index - b.index);

    if (ordered.length === 0) {
      throw new Error('Media unavailable');
    }

    const parts: BlobPart[] = ordered.map((c) => {
      const bytes = base64ToBytes(c.data);
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      return copy.buffer;
    });
    const blob = new Blob(parts, { type: mimeType });
    const url = URL.createObjectURL(blob);
    mediaUrlCache.set(mediaId, url);
    return url;
  })().finally(() => {
    inflightMediaLoads.delete(mediaId);
  });

  inflightMediaLoads.set(mediaId, task);
  return task;
}

export async function deletePostMediaBestEffort(mediaId: string): Promise<void> {
  try {
    const chunksSnap = await getDocs(
      query(
        collection(db, 'media', mediaId, 'chunks'),
        where('mediaId', '==', mediaId),
      ),
    );
    await Promise.all(
      chunksSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})),
    );
    await deleteDoc(doc(db, 'media', mediaId)).catch(() => {});
  } catch {
    // Ignore best-effort cleanup errors
  }
}

export function formatMediaDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
