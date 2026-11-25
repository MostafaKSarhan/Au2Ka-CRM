import React, { useEffect, useState } from 'react';
import {
  MessageSquare, Send, RefreshCw, X, Search, CheckCheck, AlertTriangle, BellOff, Play,
} from 'lucide-react';
import { api } from '../../lib/api';
import { dateTimeLocal } from '../../lib/datetime';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  TextInput, Select, PrimaryButton, GhostButton, IconButton, Banner, TableShell,
} from '../admin/ui';

interface OutboundMessage {
  id: string;
  channel: 'WHATSAPP' | 'INTERNAL';
  recipientName: string | null;
  recipientNumber: string | null;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  sendLink: string | null;
  template: { code: string; nameAr: string; nameEn: string } | null;
  jobCard: { id: string; jobNumber: string } | null;
  createdBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

interface Stats {
  counts: { pending: number; sent: number; failed: number; cancelled: number };
  optedOut: number;
}

export function MessagesView() {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'ADMIN';

  const [messages, setMessages] = useState<OutboundMessage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [search, status, page]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;

      const [listRes, statsRes] = await Promise.all([
        api.get('/messaging/messages', { params }),
        api.get('/messaging/messages/stats'),
      ]);
      setMessages(listRes.data.messages || []);
      setTotalPages(listRes.data.pagination?.pages || 1);
      setStats(statsRes.data);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  /** Opens WhatsApp with the message ready, then records it as dispatched. */
  async function handleSend(m: OutboundMessage) {
    if (m.sendLink) window.open(m.sendLink, '_blank', 'noopener');
    try {
      await api.post(`/messaging/messages/${m.id}/sent`, {});
      setMsg('✅ ' + t('msg_marked'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function handleAction(m: OutboundMessage, action: 'retry' | 'cancel') {
    try {
      await api.post(`/messaging/messages/${m.id}/${action}`, {});
      setMsg('✅ ' + (action === 'retry' ? t('msg_requeued') : t('msg_cancelled')));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function runQueue() {
    try {
      const res = await api.post('/messaging/messages/run', {});
      const { queue, alerts } = res.data;
      setMsg(
        `✅ ${t('msg_queueRan')} — ${queue.delivered} ${t('msg_delivered')} · ${
          alerts.subscriptions + alerts.documents
        } ${t('msg_alertsRaised')}`,
      );
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  const statusStyles: Record<string, string> = {
    PENDING: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    SENT: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    FAILED: 'border-red-500/25 bg-red-500/10 text-red-400',
    CANCELLED: 'border-zinc-700 bg-zinc-800/60 text-zinc-500',
  };

  const statusLabels: Record<string, string> = {
    PENDING: t('msg_statusPending'),
    SENT: t('msg_statusSent'),
    FAILED: t('msg_statusFailed'),
    CANCELLED: t('msg_statusCancelled'),
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('messages')}</h1>
          <p className="text-sm text-zinc-400">{t('msg_subtitle')}</p>
        </div>
        {isAdmin && (
          <GhostButton onClick={runQueue}>
            <Play size={15} /> {t('msg_runQueue')}
          </GhostButton>
        )}
      </div>

      <Banner message={msg} />

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat icon={Send} label={t('msg_statusPending')} value={stats.counts.pending} tone="amber" />
          <Stat icon={CheckCheck} label={t('msg_statusSent')} value={stats.counts.sent} tone="emerald" />
          <Stat icon={AlertTriangle} label={t('msg_statusFailed')} value={stats.counts.failed} tone="red" />
          <Stat icon={X} label={t('msg_statusCancelled')} value={stats.counts.cancelled} tone="zinc" />
          <Stat icon={BellOff} label={t('msg_optedOut')} value={stats.optedOut} tone="zinc" />
        </div>
      )}

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
            <TextInput
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('msg_search')}
              className="ps-9"
            />
          </div>
          <Select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('sub_allStatuses')}</option>
            <option value="PENDING">{t('msg_statusPending')}</option>
            <option value="SENT">{t('msg_statusSent')}</option>
            <option value="FAILED">{t('msg_statusFailed')}</option>
            <option value="CANCELLED">{t('msg_statusCancelled')}</option>
          </Select>
        </div>

        <TableShell
          headers={[t('msg_recipient'), t('msg_template'), t('msg_body'), t('msg_when'), t('md_status'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={messages.length === 0}
          empty={t('msg_none')}
        >
          {messages.map(m => (
            <tr key={m.id} className="border-b border-zinc-900 align-top transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5">
                <span className="font-semibold text-white">{m.recipientName || '—'}</span>
                {m.recipientNumber && (
                  <span className="block font-mono text-[11px] text-zinc-600" dir="ltr">
                    {m.recipientNumber}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-xs text-zinc-400">
                {m.template ? (isAr ? m.template.nameAr : m.template.nameEn) : t('msg_freeText')}
                {m.jobCard && (
                  <span className="block font-mono text-[10px] text-primary-text">{m.jobCard.jobNumber}</span>
                )}
              </td>
              <td className="max-w-[260px] px-3 py-2.5">
                {/* النص مطويّ على سطرين. بدون سطر «عرض الكامل» لا شيء يدل
                    على أنه قابل للفتح، فكان الموظف يظن أن الرسالة هي هذا
                    القدر المقصوص. */}
                <button
                  onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  title={m.body}
                  className={`cursor-pointer whitespace-pre-line text-start text-[11px] leading-relaxed text-zinc-400 ${
                    expanded === m.id ? '' : 'line-clamp-2'
                  }`}
                >
                  {m.body}
                </button>
                {m.body.length > 70 && (
                  <button
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                    className="mt-0.5 block cursor-pointer text-[10px] font-bold text-primary-text transition hover:text-white"
                  >
                    {expanded === m.id ? t('msg_collapse') : t('msg_showFull')}
                  </button>
                )}
                {m.lastError && (
                  <span className="mt-1 block text-[10px] font-bold text-red-400">{m.lastError}</span>
                )}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500" dir="ltr">
                {dateTimeLocal(m.sentAt || m.scheduledAt)}
                {m.attempts > 0 && (
                  <span className="block text-[10px] text-zinc-600">
                    {t('msg_attempts')}: {m.attempts}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${statusStyles[m.status]}`}>
                  {statusLabels[m.status]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  {m.status === 'PENDING' && m.channel === 'WHATSAPP' && (
                    <button
                      onClick={() => handleSend(m)}
                      className="flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-emerald-700"
                      title={t('msg_sendHint')}
                    >
                      <Send size={12} /> {t('msg_send')}
                    </button>
                  )}
                  {(m.status === 'FAILED' || m.status === 'CANCELLED') && (
                    <IconButton onClick={() => handleAction(m, 'retry')} title={t('msg_retry')}>
                      <RefreshCw size={15} />
                    </IconButton>
                  )}
                  {m.status === 'PENDING' && (
                    <IconButton tone="danger" onClick={() => handleAction(m, 'cancel')} title={t('msg_cancel')}>
                      <X size={15} />
                    </IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </TableShell>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <GhostButton disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('cu_previous')}
            </GhostButton>
            <span className="text-xs text-zinc-500">
              {page} / {totalPages}
            </span>
            <GhostButton disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              {t('cu_next')}
            </GhostButton>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] leading-relaxed text-zinc-500">
        <MessageSquare size={14} className="mt-0.5 shrink-0 text-primary-text" />
        {t('msg_scopeNote')}
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'red' | 'zinc';
}) {
  const tones: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    zinc: 'text-zinc-400 bg-zinc-700/30',
  };
  return (
    <div className="glass-panel flex items-center gap-3 rounded-xl p-4">
      <span className={`rounded-lg p-2.5 ${tones[tone]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
