import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { Translations } from '../lib/i18n';
import { PWAInstallState } from '../lib/usePWAInstall';

interface PWAInstallBannerProps {
  pwa: PWAInstallState;
  t: Translations;
  compact?: boolean;
}

export function PWAInstallBanner({
  pwa,
  t,
  compact = false,
}: PWAInstallBannerProps) {
  const handleInstallClick = () => {
    void pwa.promptInstall();
  };

  return (
    <>
      {pwa.showInstallBanner && (
        <div
          role="region"
          aria-label={t.installAppTitle}
          className={
            compact
              ? 'w-full rounded-2xl bg-slate-900 text-white border border-emerald-500/30 p-3.5 shadow-md flex items-center justify-between gap-3'
              : 'mx-3 sm:mx-6 lg:mx-0 mt-2 lg:mt-0 rounded-2xl bg-slate-900 text-white border border-emerald-500/30 p-3 sm:px-4 sm:py-3 shadow-sm flex items-center justify-between gap-3'
          }
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="World Connection"
              className="w-10 h-10 rounded-xl border border-emerald-500/30 shrink-0 object-cover"
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-white truncate">
                {t.installAppTitle}
              </p>
              <p className="text-xs text-slate-300 line-clamp-2">
                {pwa.isIos && !pwa.canPromptNative
                  ? t.installAppIosHint
                  : t.installAppSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.installAppBtn}</span>
            </button>

            <button
              type="button"
              onClick={pwa.dismissBanner}
              aria-label={t.dismissInstallLabel}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {pwa.showIosInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.installIosModalTitle}
        >
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="World Connection"
                  className="w-11 h-11 rounded-xl border border-emerald-500/30 shrink-0"
                />
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    {t.installIosModalTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.appName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={pwa.closeIosInstructions}
                aria-label={t.cancel}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Share className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t.installIosStep1Title}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {t.installIosStep1Desc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-1.5">
                    <PlusSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t.installIosStep2Title}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {t.installIosStep2Desc}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Safari · iPhone / iPad</span>
              </span>
              <button
                type="button"
                onClick={pwa.closeIosInstructions}
                className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
              >
                {t.installIosGotItBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
