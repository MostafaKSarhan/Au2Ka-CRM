import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, Printer } from 'lucide-react';
import { useTranslation } from '../../store/LanguageContext';
import { API_ORIGIN } from '../../lib/apiOrigin';
import { VehicleFileContent } from './VehicleFileContent';
import type { VehicleFile } from './VehicleFileContent';

/**
 * The customer's read-only vehicle file, reached by the share link (M3).
 * It never requires a login, so it uses a bare axios call rather than the
 * authenticated client.
 */
export function PublicVehicleFile({ token }: { token: string }) {
  const { lang, setLang, t } = useTranslation();
  const [file, setFile] = useState<VehicleFile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_ORIGIN}/api/v1/public/vehicle-file/${encodeURIComponent(token)}`)
      .then(res => setFile(res.data))
      .catch(err => setError(err.response?.data?.message || t('vf_linkInvalid')))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div
      className="min-h-screen bg-background p-4 text-zinc-100"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="no-print flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/20 p-2 text-primary-text">
              <Shield size={20} />
            </span>
            <span className="text-xl font-black tracking-wider">
              Au<span className="text-primary-text">2</span>Ka
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:text-white"
            >
              <Printer size={14} /> {t('vf_print')}
            </button>
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:text-white"
            >
              🌐 {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </header>

        {loading ? (
          <p className="py-20 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-sm font-bold text-red-400">{error}</p>
            <p className="mt-2 text-xs text-zinc-500">{t('vf_linkInvalidHint')}</p>
          </div>
        ) : file ? (
          <VehicleFileContent file={file} readOnly />
        ) : null}
      </div>
    </div>
  );
}
