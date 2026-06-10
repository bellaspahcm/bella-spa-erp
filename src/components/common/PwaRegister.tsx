'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform?: string;
  }>;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && 'userChoice' in event;
}

function isIOSInstallCandidate() {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(userAgent);
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isAppleMobile && !isStandalone;
}

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIOS] = useState<boolean>(() => isIOSInstallCandidate());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isLocalDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]' ||
      process.env.NODE_ENV !== 'production';

    const clearLocalPwaCache = async () => {
      if (!('serviceWorker' in navigator)) return;

      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('bella-spa-erp'))
            .map((cacheName) => caches.delete(cacheName))
        );
      }
    };

    let handleWindowLoad: (() => void) | undefined;

    // 1. Register the Service Worker only in production. In local/dev, remove
    // any old PWA cache so Next dev never serves stale interface chunks.
    if ('serviceWorker' in navigator) {
      handleWindowLoad = () => {
        if (isLocalDev) {
          clearLocalPwaCache().catch((error) => {
            console.error('[PWA] Failed to clear local service worker cache:', error);
          });
          return;
        }

        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
      };

      window.addEventListener('load', handleWindowLoad);
    }

    let iosTimer: ReturnType<typeof setTimeout> | undefined;

    // 2. Detect if the device is iOS (Safari doesn't support beforeinstallprompt)
    if (isIOS) {
      // Show the iOS "Add to Home Screen" instructions after 5 seconds of loading the app
      iosTimer = setTimeout(() => {
        const hasDismissed = localStorage.getItem('pwa_ios_banner_dismissed');
        if (!hasDismissed) {
          setShowBanner(true);
        }
      }, 5000);
    }

    // 3. Listen for Android/Chrome custom install prompt (A2HS)
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      if (!isBeforeInstallPromptEvent(e)) return;
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Check if user dismissed it before
      const hasDismissed = localStorage.getItem('pwa_install_banner_dismissed');
      if (!hasDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for successful install
    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed!');
      setShowBanner(false);
      setDeferredPrompt(null);
      toast.success('Cài đặt ứng dụng Bella Spa ERP thành công!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (handleWindowLoad) {
        window.removeEventListener('load', handleWindowLoad);
      }
      if (iosTimer) {
        clearTimeout(iosTimer);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isIOS]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (isIOS) {
      localStorage.setItem('pwa_ios_banner_dismissed', 'true');
    } else {
      localStorage.setItem('pwa_install_banner_dismissed', 'true');
    }
    toast.info('Bạn có thể tự cài đặt PWA bất kỳ lúc nào từ thanh địa chỉ trình duyệt.');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-[360px] md:left-auto md:right-6 md:translate-x-0 md:w-[380px] z-[9999] p-5 rounded-2xl border border-pink-200/50 bg-white/90 dark:bg-zinc-900/90 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5">
      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-900/30 text-pink-500 flex items-center justify-center flex-shrink-0 shadow-inner">
          <Download size={22} />
        </div>
        
        <div className="flex-grow pr-4">
          <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
            Cài đặt Bella Spa ERP
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            {isIOS 
              ? 'Để cài đặt trên iPhone, nhấn vào biểu tượng chia sẻ ⇧ ở chân Safari rồi chọn "Thêm vào màn hình chính" (Add to Home Screen).' 
              : 'Cài đặt ứng dụng trực tiếp lên màn hình điện thoại để thao tác nhanh hơn, nhận ca tức thì và làm việc offline.'
            }
          </p>
          
          {!isIOS && (
            <button
              onClick={handleInstallClick}
              className="mt-3 px-4 py-2 w-full text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:scale-95 transition-all duration-200 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-pink-500/20 dark:shadow-none"
            >
              <Download size={14} />
              Cài đặt ứng dụng ngay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
