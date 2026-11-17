/**
 * M11 — registering the service worker and watching the connection.
 *
 * The worker is only registered in a production build: in development it
 * would serve stale modules and make every change look like it did nothing.
 */

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration must never break the app itself.
    });
  });
}

export type ConnectionListener = (online: boolean) => void;

/** Calls back whenever the browser gains or loses its connection. */
export function watchConnection(listener: ConnectionListener): () => void {
  const onOnline = () => listener(true);
  const onOffline = () => listener(false);

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/** The install prompt Chrome fires, held until the user asks for it. */
let deferredPrompt: any = null;

export function captureInstallPrompt(onAvailable: (available: boolean) => void) {
  window.addEventListener('beforeinstallprompt', event => {
    // Chrome shows its own bar unless we take the event.
    event.preventDefault();
    deferredPrompt = event;
    onAvailable(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onAvailable(false);
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  // The event can only be used once.
  deferredPrompt = null;
  return choice?.outcome === 'accepted';
}

/** True when the app is already running from the home screen. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS reports this on navigator rather than through a media query.
    (window.navigator as any).standalone === true
  );
}
