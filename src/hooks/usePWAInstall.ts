import { useState, useEffect } from 'react';

export type PlatformCategory = 'apple' | 'android' | 'pc';

export interface DevicePlatformInfo {
  category: PlatformCategory;
  name: string;
  os: string;
  browser: string;
  isApple: boolean;
  isAndroid: boolean;
  isPC: boolean;
  supportsNativePrompt: boolean;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function detectDevicePlatform(): DevicePlatformInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      category: 'pc',
      name: 'Computador / PC',
      os: 'Web',
      browser: 'Navegador',
      isApple: false,
      isAndroid: false,
      isPC: true,
      supportsNativePrompt: false
    };
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  // Browser detection
  let browser = 'Navegador';
  if (/edg/.test(ua)) browser = 'Microsoft Edge';
  else if (/samsungbrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/chrome|crios/.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/.test(ua) && !/chrome|crios/.test(ua)) browser = 'Safari';

  // Apple detection (iPhone, iPad, iPod, or Mac)
  const isIOS = /iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && navigator.maxTouchPoints > 1);
  const isMac = /macintosh|mac os x/.test(ua);

  if (isIOS) {
    return {
      category: 'apple',
      name: 'Apple (iPhone / iPad)',
      os: 'iOS',
      browser,
      isApple: true,
      isAndroid: false,
      isPC: false,
      supportsNativePrompt: false // iOS Safari doesn't support beforeinstallprompt
    };
  }

  if (isMac && browser === 'Safari') {
    return {
      category: 'apple',
      name: 'Apple (Mac Safari)',
      os: 'macOS',
      browser,
      isApple: true,
      isAndroid: false,
      isPC: false,
      supportsNativePrompt: false
    };
  }

  // Android detection
  if (/android/.test(ua)) {
    return {
      category: 'android',
      name: 'Android',
      os: 'Android',
      browser,
      isApple: false,
      isAndroid: true,
      isPC: false,
      supportsNativePrompt: true
    };
  }

  // PC / Desktop (Windows, Linux, Mac com Chrome/Edge, ChromeOS)
  let osName = 'Windows';
  if (/win/.test(platform) || /windows/.test(ua)) osName = 'Windows';
  else if (/linux/.test(platform) || /linux/.test(ua)) osName = 'Linux';
  else if (/cros/.test(ua)) osName = 'ChromeOS';
  else if (isMac) osName = 'macOS';

  return {
    category: 'pc',
    name: `PC (${osName})`,
    os: osName,
    browser,
    isApple: isMac,
    isAndroid: false,
    isPC: true,
    supportsNativePrompt: true
  };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<DevicePlatformInfo>(detectDevicePlatform());

  useEffect(() => {
    setPlatformInfo(detectDevicePlatform());

    // Check standalone mode (already installed or running as standalone PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'manual_tutorial'> => {
    if (!deferredPrompt) {
      return 'manual_tutorial';
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      console.warn('Install prompt error, falling back to manual tutorial:', err);
      return 'manual_tutorial';
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    platformInfo,
    isIOS: platformInfo.category === 'apple',
    install,
    deferredPrompt
  };
}
