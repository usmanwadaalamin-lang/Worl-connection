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
  Send,
  Share2,
} from 'lucide-react';
import { CommentItem, Post, UserProfile } from '../types/social';
import { Avatar } from './Avatar';
import { queryDeepThink } from '../lib/thinkApi';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatFirestoreTime } from '../lib/firestoreSocial';
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
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [liked, setLiked] = useState(post.liked);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(Boolean(post.analysis));

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
        err instanceof Error ? err.message : 'Unable to analyze post right now.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const avatarSrc = author?.avatarUrl || post.authorAvatarUrl;

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
          <div className="flex items-baseline justify-between gap-2">
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
          </div>

          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
            {post.text}
          </p>

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
    </article>
  );
}
