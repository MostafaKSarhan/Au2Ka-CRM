import React, { useEffect, useState } from 'react';
import { DatabaseBackup, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { SectionHeader, PrimaryButton, GhostButton, Banner } from './ui';

interface BackupInfo {
  database: string;
  host: string;
  counts: {
    users: number;
    customers: number;
    vehicles: number;
    jobCards: number;
    branches: number;
    parts: number;
    vehicleModels: number;
  };
  generatedAt: string;
}

export function BackupTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadInfo();
  }, []);

  async function loadInfo() {
    setLoading(true);
    try {
      const res = await api.get('/backup/info');
      setInfo(res.data);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setMsg('');
    try {
      const res = await api.get('/backup/download', { responseType: 'blob' });

      // The server may answer with a JSON error even though we asked for a blob.
      if (res.data.type === 'application/json') {
        const text = await res.data.text();
        throw { response: { data: JSON.parse(text) } };
      }

      const disposition = res.headers['content-disposition'] || '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const fileName = match ? match[1] : `au2ka-backup-${Date.now()}.sql`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMsg('✅ ' + t('md_backupDownloaded'));
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_backupFailed')));
    } finally {
      setDownloading(false);
    }
  }

  const rows: Array<[string, number]> = info
    ? [
        [t('md_countUsers'), info.counts.users],
        [t('md_countBranches'), info.counts.branches],
        [t('md_countCustomers'), info.counts.customers],
        [t('md_countVehicles'), info.counts.vehicles],
        [t('md_countJobCards'), info.counts.jobCards],
        [t('md_countModels'), info.counts.vehicleModels],
        [t('md_countParts'), info.counts.parts],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={DatabaseBackup}
          title={t('md_backup')}
          subtitle={t('md_backupHint')}
          action={
            <GhostButton onClick={loadInfo} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> {t('md_refresh')}
            </GhostButton>
          }
        />

        <Banner message={msg} />

        {loading && !info ? (
          <p className="py-6 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : info ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[11px] font-semibold text-zinc-500">{t('md_databaseName')}</p>
                <p className="font-mono text-sm text-white">{info.database}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-[11px] font-semibold text-zinc-500">{t('md_databaseHost')}</p>
                <p className="font-mono text-sm text-white">{info.host}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                  <p className="text-[11px] text-zinc-500">{label}</p>
                  <p className="text-lg font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            <PrimaryButton onClick={handleDownload} disabled={downloading} className="w-full">
              <Download size={17} />
              {downloading ? t('md_backupPreparing') : t('md_downloadBackup')}
            </PrimaryButton>
          </>
        ) : null}
      </div>

      <div className="glass-panel rounded-xl p-5">
        <div className="mb-3 flex items-center gap-2 text-emerald-400">
          <ShieldCheck size={18} />
          <h3 className="text-sm font-bold">{t('md_restoreTitle')}</h3>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-zinc-400">{t('md_restoreHint')}</p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-black/40 p-3 text-left text-[11px] text-zinc-400" dir="ltr">
{`mysql -u <user> -p ${info?.database || '<database>'} < au2ka-backup-....sql`}
        </pre>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
          {t('md_restoreNote')}
        </p>
      </div>
    </div>
  );
}
