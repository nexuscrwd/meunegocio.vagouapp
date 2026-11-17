import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return isStandaloneMedia || isIosStandalone;
}

function checkIsIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOSDevice =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOSDevice) return false;
  const isNonSafariIOS = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  return !isNonSafariIOS;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [isIOS] = useState<boolean>(() => checkIsIOSSafari());

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;

    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  return {
    isInstalled,
    isInstallable: Boolean(deferredPrompt) && !isInstalled,
    isIOS: isIOS && !isInstalled,
    triggerInstall,
  };
}
