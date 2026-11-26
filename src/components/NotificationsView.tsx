import { CheckCheck, Heart, MessageCircle, UserPlus } from 'lucide-react';
import { NotificationItem, UserProfile } from '../types/social';
import { Avatar } from './Avatar';
import { Translations } from '../lib/i18n';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  users: UserProfile[];
  t: Translations;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}

export function NotificationsView({
  notifications,
  users,
  t,
  onMarkAllRead,
  onMarkRead,
}: NotificationsViewProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-600 fill-current" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-blue-600" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getLocalizedMessage = (item: NotificationItem) => {
    if (item.type === 'like') return t.notifLiked;
    if (item.type === 'follow') return t.notifFollowed;
    if (item.type === 'comment') return t.notifCommented;
    return item.message;
  };

  return (
    <section
      aria-label={t.notificationsTitle}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
            {t.notificationsTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {unreadCount > 0
              ? `${unreadCount} ${t.unreadUpdatesWord}`
              : t.allCaughtUp}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{t.markAllRead}</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.noNotifications}
          </div>
        ) : (
          notifications.map((item) => {
            const actorProfile = users.find(
              (u) => u.name.toLowerCase() === item.actor.toLowerCase(),
            );
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onMarkRead(item.id)}
                className={`w-full text-left px-5 py-4 flex items-center gap-3.5 transition-colors min-h-[64px] ${
                  item.read
                    ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar
                    name={item.actor}
                    src={actorProfile?.avatarUrl}
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.actor}
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-400">
                      · {getLocalizedMessage(item)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {item.time}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {getIcon(item.type)}
                  {!item.read && (
                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                      {t.notifNew}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
