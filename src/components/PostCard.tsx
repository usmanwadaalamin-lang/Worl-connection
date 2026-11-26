import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  BrainCircuit,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Send,
  Share2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { CommentItem, Post, UserProfile } from '../types/social';
import { Avatar } from './Avatar';
import { extractReadableError, queryDeepThink } from '../lib/thinkApi';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatFirestoreTime } from '../lib/firestoreSocial';
import { formatMediaDuration, loadPostMediaUrl } from '../lib/mediaPosts';
import { Translations } from '../lib/i18n';

interface PostCardProps {
  post: Post;
  author?: UserProfile;
  currentUserId: string;
  currentUserName: string;
  t: Translations;
  onToggleLike: (post: Post, currentlyLiked: boolean) => Promise<void>;
  onAddComment: (post: Post, text: string) => Promise<void>;
  onSaveAnalysis: (postId: string, analysis: string) => Promise<void>;
  onShare: (post: Post) => void;
  onDeletePost?: (post: Post) => Promise<void>;
}

export function PostCard({
  post,
  author,
  currentUserId,
  currentUserName,
  t,
  onToggleLike,
  onAddComment,
  onSaveAnalysis,
  onShare,
  onDeletePost,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [liked, setLiked] = useState(post.liked);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(Boolean(post.analysis));

  const [resolvedMediaUrl, setResolvedMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Automatically load full-resolution image for photo posts (or use poster immediately)
  useEffect(() => {
    if (post.mediaType !== 'image' || !post.mediaId) return;
    let cancelled = false;
    loadPostMediaUrl(post.mediaId, post.mediaMimeType)
      .then((url) => {
        if (!cancelled) setResolvedMediaUrl(url);
      })
      .catch(() => {
        // Keep poster fallback if chunk fetch fails
      });
    return () => {
      cancelled = true;
    };
  }, [post.mediaId, post.mediaType, post.mediaMimeType]);

  useEffect(() => {
    const likePath = `posts/${post.id}/likes/${currentUserId}`;
    const unsubscribe = onSnapshot(
      doc(db, 'posts', post.id, 'likes', currentUserId),
      (snap) => {
        setLiked(snap.exists());
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, likePath);
      },
    );
    return () => unsubscribe();
  }, [post.id, currentUserId]);

  useEffect(() => {
    if (!commentsOpen) return;
    const commentsPath = `posts/${post.id}/comments`;
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      where('postId', '==', post.id),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Array<CommentItem & { ms: number }> = snapshot.docs.map(
          (docSnap) => {
            const data = docSnap.data();
            const { label, ms } = formatFirestoreTime(data.createdAt);
            return {
              id: docSnap.id,
              authorId: String(data.authorId ?? ''),
              authorName: String(data.authorName ?? 'Member'),
              authorHandle: String(data.authorHandle ?? '@member'),
              text: String(data.text ?? ''),
              createdAt: label,
              ms,
            };
          },
        );
        items.sort((a, b) => a.ms - b.ms);
        setComments(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, commentsPath);
      },
    );

    return () => unsubscribe();
  }, [commentsOpen, post.id]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentInput.trim();
    if (!trimmed || submittingComment) return;
    setSubmittingComment(true);
    try {
      await onAddComment(post, trimmed);
      setCommentInput('');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAnalyzePost = async () => {
    if (post.analysis) {
      setShowAnalysis((prev) => !prev);
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    setShowAnalysis(true);

    try {
      const result = await queryDeepThink({
        mode: 'analyze_post',
        context: `Author: ${post.user} (${post.handle})`,
        prompt: `Analyze and expand thoughtfully on this social post for community readers (respond in the same language as the post):\n\n"${post.text}"`,
      });
      await onSaveAnalysis(post.id, result.answer);
    } catch (err) {
      setAnalysisError(
        extractReadableError(err, 'Unable to analyze post right now.'),
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePlayShortVideo = async () => {
    if (!post.mediaId || mediaLoading) return;
    setMediaLoading(true);
    setMediaLoadError(false);
    try {
      const url = await loadPostMediaUrl(post.mediaId, post.mediaMimeType);
      setResolvedMediaUrl(url);
    } catch {
      setMediaLoadError(true);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeletePost || deleting) return;
    setDeleting(true);
    try {
      await onDeletePost(post);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const avatarSrc = author?.avatarUrl || post.authorAvatarUrl;
  const displayImageSrc = resolvedMediaUrl || post.mediaPoster || '';
  const isOwner = post.authorId === currentUserId;

  return (
    <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 transition-colors">
      <div className="flex items-start gap-3.5">
        <Avatar
          name={post.user}
          src={avatarSrc}
          size="md"
          online={author?.isOnline}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
              <span className="font-display font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                {post.user}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {post.handle}
              </span>
              <span
                aria-hidden="true"
                className="text-xs text-slate-400 dark:text-slate-500"
              >
                ·
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                {post.createdAt}
              </span>
            </div>

            {isOwner && onDeletePost && (
              <div className="shrink-0">
                {confirmDelete ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleConfirmDelete()}
                      disabled={deleting}
                      className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 disabled:opacity-50"
                    >
                      {t.confirmDeletePostBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium"
                    >
                      {t.cancel}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    aria-label={t.deletePostBtn}
                    title={t.deletePostBtn}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {post.text && (
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
              {post.text}
            </p>
          )}

          {/* Photo Attachment */}
          {post.mediaType === 'image' && displayImageSrc && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <img
                  src={displayImageSrc}
                  alt={post.text || `${post.user} photo`}
                  className="w-full max-h-[440px] object-cover hover:opacity-95 transition-opacity"
                  loading="lazy"
                />
              </button>
            </div>
          )}

          {/* Short Video Attachment */}
          {post.mediaType === 'video' && (
            <div className="mt-3 rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/70 dark:border-slate-800 relative">
              {resolvedMediaUrl ? (
                <video
                  src={resolvedMediaUrl}
                  poster={post.mediaPoster || undefined}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full max-h-[480px] object-contain mx-auto bg-black"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => void handlePlayShortVideo()}
                  disabled={mediaLoading}
                  className="relative w-full min-h-[240px] max-h-[440px] flex items-center justify-center bg-slate-900 group overflow-hidden"
                >
                  {post.mediaPoster ? (
                    <img
                      src={post.mediaPoster}
                      alt={post.text || `${post.user} video`}
                      className="w-full max-h-[440px] object-cover opacity-85 group-hover:opacity-75 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-60 bg-gradient-to-br from-slate-800 to-slate-950" />
                  )}

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/25">
                    <span className="w-14 h-14 rounded-full bg-emerald-600/95 group-hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-105">
                      {mediaLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      )}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-950/75 text-white text-xs font-semibold backdrop-blur-xs">
                      {mediaLoading
                        ? t.loadingVideoLabel
                        : mediaLoadError
                          ? t.invalidMediaErr
                          : t.tapToPlayVideo}
                    </span>
                  </div>

                  {typeof post.mediaDuration === 'number' &&
                    post.mediaDuration > 0 && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/75 text-white text-[11px] font-semibold backdrop-blur-xs inline-flex items-center gap-1">
                        <Video className="w-3 h-3 text-emerald-400" />
                        <span>{formatMediaDuration(post.mediaDuration)}</span>
                      </span>
                    )}
                </button>
              )}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => void onToggleLike(post, liked)}
                aria-pressed={liked}
                aria-label={liked ? 'Unlike post' : 'Like post'}
                className={`min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  liked
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Heart
                  className={`w-[18px] h-[18px] ${liked ? 'fill-current' : ''}`}
                />
                <span className="tabular-nums">{post.likes}</span>
              </button>

              <button
                type="button"
                onClick={() => setCommentsOpen((prev) => !prev)}
                aria-expanded={commentsOpen}
                aria-label={t.commentsTitle}
                className={`min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  commentsOpen
                    ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                <span className="tabular-nums">{post.commentsCount}</span>
              </button>

              <button
                type="button"
                onClick={() => onShare(post)}
                aria-label={t.share}
                className="min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Share2 className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">{t.share}</span>
              </button>
            </div>

            {post.text.trim().length > 0 && (
              <button
                type="button"
                onClick={() => void handleAnalyzePost()}
                disabled={analyzing}
                className={`min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  showAnalysis
                    ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BrainCircuit className="w-4 h-4" />
                )}
                <span>
                  {post.analysis
                    ? showAnalysis
                      ? t.hideInsight
                      : t.deepThink
                    : t.deepThink}
                </span>
              </button>
            )}
          </div>

          {showAnalysis && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>{t.deepThinkInsightHeader}</span>
              </div>
              {analyzing && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t.analyzingPost}
                </p>
              )}
              {analysisError && (
                <div className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                  {analysisError}
                </div>
              )}
              {post.analysis && (
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {post.analysis}
                </p>
              )}
            </div>
          )}

          {commentsOpen && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {t.commentsTitle} ({post.commentsCount})
              </div>

              {comments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t.noComments}
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {comment.authorName}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {comment.createdAt}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-slate-300 break-words">
                        {comment.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={handleSubmitComment}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={`${t.commentAsPrefix} ${currentUserName}...`}
                  aria-label={t.commentsTitle}
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || submittingComment}
                  className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>{t.send}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && displayImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label={t.cancel}
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={displayImageSrc}
            alt={post.text || `${post.user} photo`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88dvh] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </article>
  );
}
