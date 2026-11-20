import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Wrench, BadgeCheck, FileText, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';

interface Notification {
  id: string;
  type: 'JOB_CARD' | 'SUBSCRIPTION' | 'DOCUMENT' | 'SYSTEM';
  titleAr: string;
  titleEn: string;
  bodyAr: string | null;
  bodyEn: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, React.ElementType> = {
  JOB_CARD: Wrench,
  SUBSCRIPTION: BadgeCheck,
  DOCUMENT: FileText,
  SYSTEM: Info,
};

const TONES: Record<string, string> = {
  JOB_CARD: 'text-primary bg-primary/10',
  SUBSCRIPTION: 'text-emerald-400 bg-emerald-500/10',
  DOCUMENT: 'text-amber-400 bg-amber-500/10',
  SYSTEM: 'text-sky-400 bg-sky-500/10',
};

/** The in-system alert inbox (M6), shown in the top bar for every role. */
export function NotificationBell() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    load();
    // Light polling keeps the badge current without a socket connection.
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function load() {
    try {
      const res = await api.get('/messaging/notifications', { params: { limit: '20' } });
      setItems(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {
      // A failing poll must stay silent — the bell is not the main task.
    }
  }

  async function markRead(id: string) {
    try {
      await api.post(`/messaging/notifications/${id}/read`, {});
      load();
    } catch {
      /* ignore */
    }
  }

  async function markAll() {
    setLoading(true);
    try {
      await api.post('/messaging/notifications/read-all', {});
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 transition hover:text-white"
        aria-label={t('notifications')}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl ${
            isAr ? 'start-0' : 'end-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2.5">
            <span className="text-sm font-bold text-white">{t('notifications')}</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={loading}
                className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-zinc-400 transition hover:text-white"
              >
                <Check size={12} /> {t('notif_markAll')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-10 text-center text-xs text-zinc-500">{t('notif_empty')}</p>
            ) : (
              items.map(n => {
                const Icon = ICONS[n.type] || Info;
                return (
                  <button
                    key={n.id}
                    onClick={() => !n.readAt && markRead(n.id)}
                    className={`flex w-full cursor-pointer items-start gap-2.5 border-b border-zinc-900 px-3 py-2.5 text-start transition hover:bg-zinc-900/60 ${
                      n.readAt ? 'opacity-60' : ''
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${TONES[n.type]}`}>
                      <Icon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-white">
                        {isAr ? n.titleAr : n.titleEn}
                      </span>
                      {(isAr ? n.bodyAr : n.bodyEn) && (
                        <span className="mt-0.5 block line-clamp-2 text-[11px] text-zinc-500">
                          {isAr ? n.bodyAr : n.bodyEn}
                        </span>
                      )}
                      <span className="mt-1 block font-mono text-[10px] text-zinc-600" dir="ltr">
                        {new Date(n.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                      </span>
                    </span>
                    {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
