let sharedAudioCtx: AudioContext | null = null;
let audioUnlockAttached = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

export function setupNotificationAudioUnlock(): () => void {
  if (typeof window === 'undefined' || audioUnlockAttached) {
    return () => {};
  }
  audioUnlockAttached = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  return () => {
    audioUnlockAttached = false;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export function playNotificationChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const scheduleTone = (
      freqStart: number,
      freqEnd: number,
      startOffset: number,
      duration: number,
      peakGain: number,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, now + startOffset);
      osc.frequency.exponentialRampToValueAtTime(
        freqEnd,
        now + startOffset + duration,
      );

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(
        peakGain,
        now + startOffset + 0.015,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + startOffset + duration,
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.01);
    };

    scheduleTone(880, 932.33, 0, 0.11, 0.14);
    scheduleTone(1174.66, 1318.51, 0.09, 0.16, 0.16);
  } catch {
    // Ignore audio context restriction errors
  }
}

export interface DeviceNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  chatTarget?: string;
  onForegroundClick?: () => void;
}

export async function showDeviceNotification(
  options: DeviceNotificationOptions,
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  const notifOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
  } = {
    body: options.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: options.tag || 'world-connection-alert',
    renotify: true,
    vibrate: [160, 80, 160],
    data: { chatTarget: options.chatTarget || '' },
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 800)),
      ]);
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(options.title, notifOptions);
        return true;
      }
    } catch {
      // Fall back to window Notification below
    }
  }

  try {
    const notif = new Notification(options.title, notifOptions);
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus restriction
      }
      notif.close();
      options.onForegroundClick?.();
    };
    return true;
  } catch {
    return false;
  }
}
