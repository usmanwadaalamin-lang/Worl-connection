import { useState } from 'react';
import { ArrowUpRight, BrainCircuit, Loader2, Send } from 'lucide-react';
import { UserProfile } from '../types/social';
import { Avatar } from './Avatar';
import { queryDeepThink } from '../lib/thinkApi';
import { Translations } from '../lib/i18n';

interface DeepThinkPanelProps {
  users: UserProfile[];
  currentUserId: string;
  t: Translations;
  onToggleFollow: (userId: string) => void;
  onOpenDeepThinkChat: () => void;
}

export function DeepThinkPanel({
  users,
  currentUserId,
  t,
  onToggleFollow,
  onOpenDeepThinkChat,
}: DeepThinkPanelProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestions = users.filter((u) => u.id !== currentUserId);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await queryDeepThink({
        mode: 'chat',
        prompt: trimmed,
      });
      setAnswer(result.answer);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not reach the reasoning engine.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="hidden xl:flex flex-col gap-5 sticky top-6">
      {/* High Thinking Quick Studio */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t.deepThinkTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenDeepThinkChat}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 whitespace-nowrap"
          >
            <span>{t.fullChat}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {t.deepThinkPanelDesc}
        </p>

        <form onSubmit={handleAsk} className="mt-3.5 space-y-2.5">
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.askDeepThinkPlaceholder}
            aria-label={t.deepThinkTitle}
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="w-full min-h-[42px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.thinkingShort}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{t.askHighThinkingBtn}</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
            {error}
          </p>
        )}

        {answer && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800 max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              {t.answerHeader}
            </p>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {answer}
            </p>
          </div>
        )}
      </div>

      {/* People Discovery */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
          {t.peopleOnAlAmana}
        </h2>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {suggestions.length === 0 ? (
            <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
              {t.noSearchResultsHint}
            </p>
          ) : (
            suggestions.map((person) => (
              <div
                key={person.id}
                className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    name={person.name}
                    src={person.avatarUrl}
                    size="sm"
                    online={person.isOnline}
                  />
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {person.handle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFollow(person.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    person.following
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {person.following ? t.followingBtn : t.followBtn}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
