import { Bell, X } from 'lucide-react';
import { Translations } from '../lib/i18n';
import { WebNotificationsState } from '../lib/useWebNotifications';

interface NotificationPromptBannerProps {
  notif: WebNotificationsState;
  t: Translations;
  onShowToast?: (msg: string) => void;
}

export function NotificationPromptBanner({
  notif,
  t,
  onShowToast,
}: NotificationPromptBannerProps) {
  if (!notif.showEnableBanner) return null;

  const handleEnable = async () => {
    const result = await notif.enableNotifications({
      title: t.appName,
      body: t.notifWelcomeBody,
    });
    if (result === 'granted') {
      onShowToast?.(t.notifEnabledToast);
    } else if (result === 'denied') {
      onShowToast?.(t.notifBlockedToast);
    }
  };

  return (
    <div
      role="region"
      aria-label={t.enableNotificationsBtn}
      className="mx-3 sm:mx-6 lg:mx-0 mt-2 lg:mt-0 rounded-2xl bg-emerald-950/95 text-white border border-emerald-500/35 p-3 sm:px-4 sm:py-3 shadow-sm flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/25 border border-emerald-400/30 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-white truncate">
            {t.enableNotificationsTitle}
          </p>
          <p className="text-xs text-emerald-100/85 line-clamp-2">
            {t.enableNotificationsDesc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => void handleEnable()}
          className="min-h-[38px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>{t.enableNotificationsBtn}</span>
        </button>

        <button
          type="button"
          onClick={notif.dismissBanner}
          aria-label={t.dismissNotifLabel}
          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-emerald-200/80 hover:text-white hover:bg-emerald-900/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
