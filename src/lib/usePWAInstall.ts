import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_STORAGE_KEY = 'wc_pwa_banner_dismissed_until_v1';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const matchStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const navStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return matchStandalone || navStandalone;
}

function checkIsIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  const isIpadOs =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleMobile || isIpadOs;
}

function isBannerSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export interface PWAInstallState {
  isStandalone: boolean;
  isIos: boolean;
  canPromptNative: boolean;
  showInstallBanner: boolean;
  showIosInstructions: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'ios-guide' | 'unavailable'>;
  dismissBanner: () => void;
  closeIosInstructions: () => void;
  openIosInstructions: () => void;
}

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() =>
    checkIsStandalone(),
  );
  const [isIos] = useState<boolean>(() => checkIsIosDevice());
  const [dismissed, setDismissed] = useState<boolean>(() => isBannerSnoozed());
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowIosInstructions(false);
    };

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const handleDisplayChange = () => {
      if (checkIsStandalone()) {
        setIsStandalone(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayChange);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    setShowIosInstructions(false);
    try {
      localStorage.setItem(
        DISMISS_STORAGE_KEY,
        String(Date.now() + DISMISS_DURATION_MS),
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const promptInstall = useCallback(async () => {
    if (isStandalone) return 'unavailable' as const;

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
        }
        return choice.outcome;
      } catch {
        setDeferredPrompt(null);
        return 'unavailable' as const;
      }
    }

    if (isIos) {
      setShowIosInstructions(true);
      return 'ios-guide' as const;
    }

    return 'unavailable' as const;
  }, [deferredPrompt, isIos, isStandalone]);

  const canPromptNative = Boolean(deferredPrompt);
  const showInstallBanner =
    !isStandalone && !dismissed && (canPromptNative || isIos);

  return {
    isStandalone,
    isIos,
    canPromptNative,
    showInstallBanner,
    showIosInstructions,
    promptInstall,
    dismissBanner,
    closeIosInstructions: () => setShowIosInstructions(false),
    openIosInstructions: () => setShowIosInstructions(true),
  };
}
