import { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { extractReadableError, queryDeepThink } from '../lib/thinkApi';
import { Translations } from '../lib/i18n';
import { PostMediaAttachment } from '../lib/firestoreSocial';
import {
  formatMediaDuration,
  ProcessedPostMedia,
  processImageForPost,
  processShortVideoForPost,
  uploadPostMedia,
} from '../lib/mediaPosts';

interface CreatePostModalProps {
  isOpen: boolean;
  authorId: string;
  authorName: string;
  initialMediaPick?: 'image' | 'video' | null;
  t: Translations;
  onClose: () => void;
  onPublish: (text: string, media?: PostMediaAttachment) => Promise<void> | void;
}

export function CreatePostModal({
  isOpen,
  authorId,
  authorName,
  initialMediaPick = null,
  t,
  onClose,
  onPublish,
}: CreatePostModalProps) {
  const [text, setText] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [showHelper, setShowHelper] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [selectedMedia, setSelectedMedia] =
    useState<ProcessedPostMedia | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [compressProgress, setCompressProgress] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const triggeredInitialPickRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      triggeredInitialPickRef.current = false;
      return;
    }
    if (initialMediaPick && !triggeredInitialPickRef.current) {
      triggeredInitialPickRef.current = true;
      const timer = window.setTimeout(() => {
        if (initialMediaPick === 'image') {
          imageInputRef.current?.click();
        } else if (initialMediaPick === 'video') {
          videoInputRef.current?.click();
        }
      }, 120);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, initialMediaPick]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const clearSelectedMedia = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedMedia(null);
    setPreviewUrl(null);
    setMediaError(null);
    setCompressProgress(null);
  };

  const resetAndClose = () => {
    if (publishing || processingMedia) return;
    clearSelectedMedia();
    setText('');
    setDraftPrompt('');
    setShowHelper(false);
    setDraftError(null);
    setUploadProgress(null);
    onClose();
  };

  const mapMediaError = (err: unknown): string => {
    const code = err instanceof Error ? err.message : '';
    if (code === 'VIDEO_TOO_LONG') return t.videoTooLongErr;
    if (code === 'VIDEO_TOO_LARGE') return t.videoTooLargeErr;
    if (code === 'INVALID_MEDIA') return t.invalidMediaErr;
    return err instanceof Error && err.message ? err.message : t.invalidMediaErr;
  };

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || processingMedia || publishing) return;

    clearSelectedMedia();
    setProcessingMedia(true);
    setMediaError(null);
    try {
      const processed = await processImageForPost(file);
      const url = URL.createObjectURL(processed.blob);
      setSelectedMedia(processed);
      setPreviewUrl(url);
    } catch (err) {
      setMediaError(mapMediaError(err));
    } finally {
      setProcessingMedia(false);
    }
  };

  const handlePickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || processingMedia || publishing) return;

    clearSelectedMedia();
    setProcessingMedia(true);
    setMediaError(null);
    setCompressProgress(null);
    try {
      const processed = await processShortVideoForPost(file, (pct) => {
        setCompressProgress(pct);
      });
      const url = URL.createObjectURL(processed.blob);
      setSelectedMedia(processed);
      setPreviewUrl(url);
    } catch (err) {
      setMediaError(mapMediaError(err));
    } finally {
      setProcessingMedia(false);
      setCompressProgress(null);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !selectedMedia) || publishing || processingMedia) return;

    setPublishing(true);
    setMediaError(null);
    try {
      let attachment: PostMediaAttachment | undefined;
      if (selectedMedia) {
        setUploadProgress(0);
        const mediaId = await uploadPostMedia({
          authorId,
          media: selectedMedia,
          onProgress: (pct) => setUploadProgress(pct),
        });
        attachment = {
          mediaId,
          mediaType: selectedMedia.mediaType,
          mediaMimeType: selectedMedia.mimeType,
          mediaPoster: selectedMedia.posterDataUrl,
          mediaDuration: selectedMedia.durationSec,
          mediaWidth: selectedMedia.width,
          mediaHeight: selectedMedia.height,
        };
      }

      await onPublish(trimmed, attachment);
      clearSelectedMedia();
      setText('');
      setDraftPrompt('');
      setShowHelper(false);
      setDraftError(null);
      setUploadProgress(null);
      onClose();
    } catch (err) {
      setMediaError(mapMediaError(err));
    } finally {
      setPublishing(false);
    }
  };

  const handleDraftWithThinking = async () => {
    const query = draftPrompt.trim() || text.trim();
    if (!query) return;

    setDrafting(true);
    setDraftError(null);

    try {
      const result = await queryDeepThink({
        mode: 'draft_post',
        prompt: `Write or refine a thoughtful social post based on this idea: ${query}`,
      });
      setText(result.answer);
    } catch (err) {
      setDraftError(
        extractReadableError(err, 'Unable to generate draft right now.'),
      );
    } finally {
      setDrafting(false);
    }
  };

  const canPublish =
    Boolean(text.trim() || selectedMedia) && !publishing && !processingMedia;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id="create-post-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {t.newPostTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.postingAs} {authorName}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={publishing || processingMedia}
            aria-label={t.cancel}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handlePublish(e)} className="mt-4 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={t.postPlaceholder}
            aria-label={t.postPlaceholder}
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-y"
          />

          {/* Photo & Short Video Attachment Buttons */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            onChange={(e) => void handlePickPhoto(e)}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            onChange={(e) => void handlePickVideo(e)}
            className="hidden"
          />

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={processingMedia || publishing}
                className="min-h-[44px] px-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>{t.photoBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={processingMedia || publishing}
                className="min-h-[44px] px-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 text-blue-800 dark:text-blue-300 text-xs sm:text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>{t.shortVideoBtn}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-0.5">
              {t.shortVideoDurationHint}
            </p>
          </div>

          {mediaError && (
            <div className="rounded-xl p-3 text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {mediaError}
            </div>
          )}

          {processingMedia && (
            <div className="rounded-xl p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>
                  {compressProgress !== null
                    ? `${t.compressingVideoLabel} ${compressProgress}%`
                    : t.compressingVideoLabel}
                </span>
              </div>
              {compressProgress !== null && (
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-200"
                    style={{ width: `${compressProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {selectedMedia && previewUrl && (
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700">
              {selectedMedia.mediaType === 'image' ? (
                <img
                  src={previewUrl}
                  alt={t.photoBtn}
                  className="w-full max-h-[300px] object-contain mx-auto bg-slate-950"
                />
              ) : (
                <video
                  src={previewUrl}
                  poster={selectedMedia.posterDataUrl || undefined}
                  controls
                  playsInline
                  muted
                  className="w-full max-h-[300px] object-contain mx-auto bg-black"
                />
              )}

              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                <span className="px-2.5 py-1 rounded-full bg-slate-950/75 text-white text-[11px] font-semibold backdrop-blur-xs inline-flex items-center gap-1">
                  {selectedMedia.mediaType === 'video' ? (
                    <>
                      <Video className="w-3 h-3 text-emerald-400" />
                      <span>{formatMediaDuration(selectedMedia.durationSec)}</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-3 h-3 text-emerald-400" />
                      <span>{t.photoBtn}</span>
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={clearSelectedMedia}
                  disabled={publishing}
                  aria-label={t.removeMediaBtn}
                  className="pointer-events-auto min-h-[34px] px-2.5 rounded-full bg-slate-950/80 hover:bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.removeMediaBtn}</span>
                </button>
              </div>
            </div>
          )}

          {publishing && uploadProgress !== null && (
            <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.uploadingMediaLabel}</span>
                </span>
                <span className="tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowHelper((prev) => !prev)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline py-1"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>{showHelper ? t.hideDraftHelper : t.showDraftHelper}</span>
            </button>

            {showHelper && (
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    placeholder={t.draftPromptPlaceholder}
                    className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleDraftWithThinking}
                    disabled={drafting || (!draftPrompt.trim() && !text.trim())}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    {drafting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t.thinkingBtn}</span>
                      </>
                    ) : (
                      <span>{t.draftPostBtn}</span>
                    )}
                  </button>
                </div>
                {draftError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {draftError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              disabled={publishing || processingMedia}
              className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!canPublish}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap inline-flex items-center gap-2"
            >
              {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{t.publish}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
