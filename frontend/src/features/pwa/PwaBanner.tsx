import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { captureInstallPrompt, isStandalone, promptInstall, watchConnection } from '../../lib/pwa';
import { useTranslation } from '../../store/LanguageContext';

const DISMISS_KEY = 'au2ka_install_dismissed';

/**
 * M11 — the install invitation and the offline notice.
 *
 * Both live in one small strip so the workshop screens keep their space.
 */
export function PwaBanner() {
  const { t } = useTranslation();

  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    captureInstallPrompt(setCanInstall);
    return watchConnection(setOnline);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // A browser with storage blocked simply gets asked again next time.
    }
  }

  async function install() {
    const accepted = await promptInstall();
    if (accepted) setCanInstall(false);
  }

  // Being offline matters more than installing, so it wins the strip.
  if (!online) {
    return (
      <div className="no-print flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-[11px] font-bold text-amber-400">
        <WifiOff size={13} />
        {t('pwa_offline')}
      </div>
    );
  }

  if (!canInstall || dismissed || isStandalone()) return null;

  return (
    <div className="no-print flex items-center justify-between gap-3 bg-primary/10 px-4 py-2">
      <span className="text-[11px] font-semibold text-zinc-300">{t('pwa_installHint')}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={install}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white transition hover:bg-primary-hover"
        >
          <Download size={12} /> {t('pwa_install')}
        </button>
        <button
          onClick={dismiss}
          className="cursor-pointer p-1 text-zinc-500 transition hover:text-white"
          aria-label={t('close')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
