import { useCallback, useEffect, useState } from 'react';
import {
  playNotificationChime,
  setupNotificationAudioUnlock,
  showDeviceNotification,
} from './notifications';

const NOTIF_PREF_KEY = 'wc_notifications_enabled_v1';
const SOUND_PREF_KEY = 'wc_notification_sound_v1';
const BANNER_DISMISS_KEY = 'wc_notif_banner_dismissed_until_v1';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type BrowserNotificationPermission =
  | NotificationPermission
  | 'unsupported';

function getPermissionState(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function readBoolPref(key: string, defaultVal: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // Ignore storage errors
  }
  return defaultVal;
}

function isBannerSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(BANNER_DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export interface WebNotificationsState {
  supported: boolean;
  permission: BrowserNotificationPermission;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  showEnableBanner: boolean;
  enableNotifications: (welcome?: {
    title: string;
    body: string;
  }) => Promise<'granted' | 'denied' | 'default' | 'unsupported'>;
  toggleNotifications: (welcome?: {
    title: string;
    body: string;
  }) => Promise<'granted' | 'denied' | 'default' | 'unsupported' | 'disabled'>;
  toggleSound: () => void;
  dismissBanner: () => void;
  triggerAlert: (params: {
    title: string;
    body: string;
    tag?: string;
    chatTarget?: string;
    suppressTrayBanner?: boolean;
    onForegroundClick?: () => void;
  }) => void;
}

export function useWebNotifications(): WebNotificationsState {
  const [permission, setPermission] = useState<BrowserNotificationPermission>(
    () => getPermissionState(),
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () =>
      getPermissionState() === 'granted' && readBoolPref(NOTIF_PREF_KEY, true),
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    readBoolPref(SOUND_PREF_KEY, true),
  );
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() =>
    isBannerSnoozed(),
  );

  useEffect(() => {
    const cleanupAudio = setupNotificationAudioUnlock();

    const syncPermission = () => {
      const next = getPermissionState();
      setPermission(next);
      if (next === 'denied' || next === 'unsupported') {
        setNotificationsEnabled(false);
      } else if (next === 'granted') {
        setNotificationsEnabled(readBoolPref(NOTIF_PREF_KEY, true));
      }
    };

    document.addEventListener('visibilitychange', syncPermission);
    window.addEventListener('focus', syncPermission);
    return () => {
      cleanupAudio();
      document.removeEventListener('visibilitychange', syncPermission);
      window.removeEventListener('focus', syncPermission);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(
        BANNER_DISMISS_KEY,
        String(Date.now() + DISMISS_MS),
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const enableNotifications = useCallback(
    async (welcome?: { title: string; body: string }) => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPermission('unsupported');
        return 'unsupported' as const;
      }

      let result: NotificationPermission = Notification.permission;
      if (result !== 'granted') {
        try {
          result = await Notification.requestPermission();
        } catch {
          result = Notification.permission;
        }
      }

      setPermission(result);
      if (result === 'granted') {
        setNotificationsEnabled(true);
        try {
          localStorage.setItem(NOTIF_PREF_KEY, 'true');
        } catch {
          // Ignore storage errors
        }
        if (soundEnabled) {
          playNotificationChime();
        }
        if (welcome) {
          void showDeviceNotification({
            title: welcome.title,
            body: welcome.body,
            tag: 'world-connection-welcome',
          });
        }
      } else {
        setNotificationsEnabled(false);
      }
      return result;
    },
    [soundEnabled],
  );

  const toggleNotifications = useCallback(
    async (welcome?: { title: string; body: string }) => {
      if (permission === 'unsupported') return 'unsupported' as const;

      if (notificationsEnabled && permission === 'granted') {
        setNotificationsEnabled(false);
        try {
          localStorage.setItem(NOTIF_PREF_KEY, 'false');
        } catch {
          // Ignore storage errors
        }
        return 'disabled' as const;
      }

      return enableNotifications(welcome);
    },
    [enableNotifications, notificationsEnabled, permission],
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_PREF_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      if (next) {
        playNotificationChime();
      }
      return next;
    });
  }, []);

  const triggerAlert = useCallback(
    (params: {
      title: string;
      body: string;
      tag?: string;
      chatTarget?: string;
      suppressTrayBanner?: boolean;
      onForegroundClick?: () => void;
    }) => {
      if (soundEnabled) {
        playNotificationChime();
      }
      if (
        !params.suppressTrayBanner &&
        notificationsEnabled &&
        permission === 'granted'
      ) {
        void showDeviceNotification({
          title: params.title,
          body: params.body,
          tag: params.tag,
          chatTarget: params.chatTarget,
          onForegroundClick: params.onForegroundClick,
        });
      }
    },
    [notificationsEnabled, permission, soundEnabled],
  );

  const supported = permission !== 'unsupported';
  const showEnableBanner =
    supported && permission === 'default' && !bannerDismissed;

  return {
    supported,
    permission,
    notificationsEnabled,
    soundEnabled,
    showEnableBanner,
    enableNotifications,
    toggleNotifications,
    toggleSound,
    dismissBanner,
    triggerAlert,
  };
}
