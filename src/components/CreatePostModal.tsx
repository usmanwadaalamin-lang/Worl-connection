import { useState } from 'react';
import { BrainCircuit, Loader2, X } from 'lucide-react';
import { queryDeepThink } from '../lib/thinkApi';
import { Translations } from '../lib/i18n';

interface CreatePostModalProps {
  isOpen: boolean;
  authorName: string;
  t: Translations;
  onClose: () => void;
  onPublish: (text: string) => void;
}

export function CreatePostModal({
  isOpen,
  authorName,
  t,
  onClose,
  onPublish,
}: CreatePostModalProps) {
  const [text, setText] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [showHelper, setShowHelper] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onPublish(trimmed);
    setText('');
    setDraftPrompt('');
    setShowHelper(false);
    setDraftError(null);
    onClose();
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
        err instanceof Error ? err.message : 'Unable to generate draft right now.',
      );
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-xl">
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
            onClick={onClose}
            aria-label={t.cancel}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePublish} className="mt-4 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={t.postPlaceholder}
            aria-label={t.postPlaceholder}
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
          />

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
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
            >
              {t.publish}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
