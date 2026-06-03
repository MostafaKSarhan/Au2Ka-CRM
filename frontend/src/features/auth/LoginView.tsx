import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import { Shield, Key, Phone, Lock } from 'lucide-react';

export function LoginView() {
  const login = useAuthStore((state) => state.login);
  const { lang, setLang, t } = useTranslation();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { mobileNumber, password });
      login(res.data.token, res.data.user);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message === 'Invalid mobile or password' ? t('invalidLogin') : t('loginError'));
    } finally {
      setLoading(false);
    }
  }

  function prefillCredentials(role: 'admin' | 'reception' | 'tech') {
    if (role === 'admin') {
      setMobileNumber('0500000001');
      setPassword('admin123');
    } else if (role === 'reception') {
      setMobileNumber('0500000002');
      setPassword('reception123');
    } else if (role === 'tech') {
      setMobileNumber('0500000003');
      setPassword('tech123');
    }
  }

  const isRtl = lang === 'ar';

  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-background px-4" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-2xl relative overflow-hidden">
        {/* Glow Background Accent */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-accent/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Language Toggler */}
        <button
          type="button"
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 hover:text-white px-2.5 py-1.5 cursor-pointer transition z-10`}
        >
          🌐 {lang === 'ar' ? 'English' : 'العربية'}
        </button>

        <div className="text-center relative">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Shield size={28} />
          </div>
          <h2 className="mt-4 text-4xl font-black tracking-wider text-white">Au<span className="text-primary">2</span>Ka</h2>
          <p className="mt-2 text-xs text-zinc-400 font-medium">{t('loginHeader')}</p>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 text-center font-semibold">
            {errorMsg}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('mobileNumber')}</label>
            <div className="relative">
              <span className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-zinc-500`}>
                <Phone size={16} />
              </span>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="0500000001"
                className={`w-full rounded bg-zinc-900 border border-zinc-800 py-2.5 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-primary text-left`}
                style={{ direction: 'ltr' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('passwordLabel')}</label>
            <div className="relative">
              <span className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-zinc-500`}>
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded bg-zinc-900 border border-zinc-800 py-2.5 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-primary text-left`}
                style={{ direction: 'ltr' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary hover:bg-primary-hover py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? t('loading') : t('loginBtn')}
          </button>
        </form>

        {/* Quick Testing Credentials Panel */}
        <div className="border-t border-zinc-800 pt-5 space-y-2">
          <p className="text-center text-xs font-medium text-zinc-500 flex items-center justify-center gap-1">
            <Key size={12} /> {lang === 'ar' ? 'اضغط لتعبئة حساب تجريبي سريع:' : 'Tap to fill test credentials:'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => prefillCredentials('admin')}
              className="rounded bg-zinc-900 border border-zinc-800/80 px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
            >
              {t('role_ADMIN').split(' ')[0]}
            </button>
            <button
              onClick={() => prefillCredentials('reception')}
              className="rounded bg-zinc-900 border border-zinc-800/80 px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
            >
              {t('receptionShort')}
            </button>
            <button
              onClick={() => prefillCredentials('tech')}
              className="rounded bg-zinc-900 border border-zinc-800/80 px-2 py-1.5 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-700 transition cursor-pointer"
            >
              {t('technicianShort')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
