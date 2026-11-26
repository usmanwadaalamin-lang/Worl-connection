import { useState } from 'react';
import {
  ExternalLink,
  Megaphone,
  Pause,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { SponsoredPost } from '../types/social';
import { Translations } from '../lib/i18n';

interface SponsoredPostModalProps {
  isOpen: boolean;
  ads: SponsoredPost[];
  t: Translations;
  onClose: () => void;
  onCreateAd: (params: {
    businessName: string;
    headline: string;
    text: string;
    ctaLabel: string;
    actionUrl: string;
  }) => Promise<void>;
  onToggleStatus: (
    adId: string,
    nextStatus: 'active' | 'paused',
  ) => Promise<void>;
  onDeleteAd: (adId: string) => Promise<void>;
}

export function SponsoredPostModal({
  isOpen,
  ads,
  t,
  onClose,
  onCreateAd,
  onToggleStatus,
  onDeleteAd,
}: SponsoredPostModalProps) {
  const [businessName, setBusinessName] = useState('');
  const [headline, setHeadline] = useState('');
  const [text, setText] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Tuntuɓi a WhatsApp');
  const [actionUrl, setActionUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const cleanBiz = businessName.trim();
    const cleanHeadline = headline.trim();
    const cleanText = text.trim();
    const cleanUrl = actionUrl.trim();

    if (!cleanBiz || !cleanHeadline || !cleanText) {
      setError(`${t.businessNameLabel}, ${t.adHeadlineLabel}, ${t.adBodyLabel}`);
      return;
    }
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
      setError(t.errInvalidUrl);
      return;
    }

    setSubmitting(true);
    try {
      await onCreateAd({
        businessName: cleanBiz,
        headline: cleanHeadline,
        text: cleanText,
        ctaLabel: ctaLabel.trim() || 'Duba Yanzu',
        actionUrl: cleanUrl,
      });
      setBusinessName('');
      setHeadline('');
      setText('');
      setActionUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish ad.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.sponsoredModalTitle}
    >
      <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {t.sponsoredModalTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t.sponsoredModalSub}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="rounded-xl p-3 text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ad-business"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                >
                  {t.businessNameLabel}
                </label>
                <input
                  id="ad-business"
                  type="text"
                  maxLength={80}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Kano Tech / Boutique"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="ad-headline"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                >
                  {t.adHeadlineLabel}
                </label>
                <input
                  id="ad-headline"
                  type="text"
                  maxLength={120}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Ragi na 20% a wannan makon!"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ad-body"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                {t.adBodyLabel}
              </label>
              <textarea
                id="ad-body"
                rows={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Bayyana kaya ko hidimar da ake tallatawa..."
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ad-cta"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                >
                  {t.ctaLabelField}
                </label>
                <input
                  id="ad-cta"
                  type="text"
                  maxLength={40}
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="ad-url"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
                >
                  {t.actionUrlLabel}
                </label>
                <input
                  id="ad-url"
                  type="url"
                  maxLength={512}
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="https://wa.me/2348000000000"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {submitting ? t.saving : t.publishAdBtn}
              </button>
            </div>
          </form>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t.manageSponsoredBtn} ({ads.length})
            </h3>

            {ads.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.noSponsoredAds}
              </p>
            ) : (
              <div className="space-y-2.5">
                {ads.map((ad) => {
                  const active = ad.status === 'active';
                  const busy = busyId === ad.id;
                  return (
                    <div
                      key={ad.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                              {ad.businessName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                active
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {active ? t.adStatusActive : t.adStatusPaused}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                            {ad.headline}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusyId(ad.id);
                              try {
                                await onToggleStatus(
                                  ad.id,
                                  active ? 'paused' : 'active',
                                );
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            title={active ? t.pauseAdBtn : t.resumeAdBtn}
                            aria-label={active ? t.pauseAdBtn : t.resumeAdBtn}
                            className="min-h-[38px] px-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1"
                          >
                            {active ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            <span>{active ? t.pauseAdBtn : t.resumeAdBtn}</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusyId(ad.id);
                              try {
                                await onDeleteAd(ad.id);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            title={t.deleteAdBtn}
                            aria-label={t.deleteAdBtn}
                            className="min-h-[38px] min-w-[38px] rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {ad.text}
                      </p>

                      {ad.actionUrl && /^https?:\/\//i.test(ad.actionUrl) && (
                        <a
                          href={ad.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline break-all"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span>{ad.actionUrl}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
