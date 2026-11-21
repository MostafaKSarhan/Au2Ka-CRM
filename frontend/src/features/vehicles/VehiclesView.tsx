import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { VehicleFileView } from '../vehicleFile/VehicleFileView';
import { Search, Car, User, PlusCircle, FolderOpen } from 'lucide-react';

const POPULAR_BRANDS = [
  'تويوتا', 'هيونداي', 'كيا', 'نيسان', 'فورد',
  'لكزس', 'مرسيدس', 'بي إم دبليو', 'أودي', 'هوندا',
  'شيفروليه', 'جي إم سي', 'مازدا'
];

export function VehiclesView() {
  const { lang, t } = useTranslation();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showAddModal, setShowAddModal] = useState(false);
  const [fileVehicleId, setFileVehicleId] = useState<string | null>(null);

  // Forms
  const [form, setForm] = useState({
    customerId: '',
    brand: POPULAR_BRANDS[0],
    customBrand: '',
    model: '',
    plateNumber: '',
    mileage: ''
  });
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadVehicles();
  }, [search, page]);

  useEffect(() => {
    if (showAddModal) {
      loadCustomers();
    }
  }, [showAddModal]);

  async function loadVehicles() {
    try {
      setLoading(true);
      const res = await api.get(`/vehicles?search=${search}&page=${page}&limit=10`);
      setVehicles(res.data.vehicles || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const res = await api.get('/customers?limit=100');
      setCustomers(res.data.customers || []);
      if (res.data.customers?.length > 0) {
        setForm(f => ({ ...f, customerId: res.data.customers[0].id }));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    const finalBrand = isCustomBrand ? form.customBrand.trim() : form.brand;
    if (!finalBrand) {
      setErrorMsg(lang === 'ar' ? 'يرجى تحديد أو كتابة ماركة السيارة' : 'Please select or type the vehicle brand');
      return;
    }

    try {
      await api.post('/vehicles', {
        customerId: form.customerId,
        brand: finalBrand,
        model: form.model,
        plateNumber: form.plateNumber,
        mileage: Number(form.mileage)
      });
      setShowAddModal(false);
      setForm({ customerId: '', brand: POPULAR_BRANDS[0], customBrand: '', model: '', plateNumber: '', mileage: '' });
      setIsCustomBrand(false);
      loadVehicles();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || (lang === 'ar' ? 'فشل حفظ بيانات السيارة' : 'Failed to save vehicle details'));
    }
  }

  const isRtl = lang === 'ar';

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('vehiclesTitle')}</h1>
          <p className="text-sm text-zinc-400">{t('vehiclesSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition cursor-pointer"
        >
          <PlusCircle size={16} /> {t('addVehicle')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-zinc-400`}>
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder={t('searchVehicle')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={`w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none`}
        />
      </div>

      {/* Vehicles Grid */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
          <Car size={32} className="mb-2 text-zinc-700" />
          <p>{t('noVehicles')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className={`glass-panel rounded-xl p-5 space-y-4 flex flex-col justify-between ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="flex items-start gap-4">
                <div className={`rounded-lg bg-primary/10 p-3 text-primary-text ${isRtl ? 'ml-2' : 'mr-2'}`}>
                  <Car size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{v.brand} {v.model}</h3>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {isRtl ? `رقم اللوحة: ${v.plateNumber}` : `Plate Number: ${v.plateNumber}`}
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-800/80 pt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <User size={14} className={isRtl ? 'ml-1' : 'mr-1'} />
                  <span>{v.customer?.fullName || (isRtl ? 'مالك غير معروف' : 'Unknown Owner')}</span>
                </div>
                <div className="text-zinc-500 font-medium font-mono">
                  {isRtl ? `${v.mileage.toLocaleString('ar-EG')} كم` : `${v.mileage.toLocaleString('en-US')} km`}
                </div>
              </div>

              {/* M3 — opens the vehicle's lifetime file */}
              <button
                onClick={() => setFileVehicleId(v.id)}
                className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 text-xs font-bold text-zinc-300 transition hover:border-primary/40 hover:text-white"
              >
                <FolderOpen size={14} /> {t('vf_openFile')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination footer */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">
            {isRtl ? `الصفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              {isRtl ? 'السابق' : 'Previous'}
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="rounded bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              {isRtl ? 'التالي' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add Vehicle */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel rounded-xl p-6 space-y-4">
            <h2 className={`text-xl font-bold text-white border-b border-zinc-800 pb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
              {t('addVehicle')}
            </h2>
            {errorMsg && <p className={`text-xs text-red-500 ${isRtl ? 'text-right' : 'text-left'}`}>{errorMsg}</p>}
            <form onSubmit={handleAddVehicle} className={`space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('selectCustomer')}</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.mobileNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('vehicleBrand')}</label>
                  <select
                    value={isCustomBrand ? 'CUSTOM' : form.brand}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'CUSTOM') {
                        setIsCustomBrand(true);
                      } else {
                        setIsCustomBrand(false);
                        setForm({ ...form, brand: val });
                      }
                    }}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white focus:outline-none"
                  >
                    {POPULAR_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value="CUSTOM">{isRtl ? 'أخرى (إدخال يدوي)' : 'Other (Manual Entry)'}</option>
                  </select>

                  {isCustomBrand && (
                    <input
                      type="text"
                      required
                      value={form.customBrand}
                      onChange={(e) => setForm({ ...form, customBrand: e.target.value })}
                      placeholder={isRtl ? 'اكتب ماركة السيارة هنا...' : 'Type vehicle brand here...'}
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white mt-2 focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('vehicleModel')}</label>
                  <input
                    type="text"
                    required
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. X5"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('plateNumber')}</label>
                <input
                  type="text"
                  required
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  placeholder="e.g. ABC 1234"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('mileage')}</label>
                <input
                  type="number"
                  required
                  value={form.mileage}
                  onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                  placeholder="e.g. 84000"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover cursor-pointer"
                >
                  {isRtl ? 'حفظ السيارة' : 'Save Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fileVehicleId && (
        <VehicleFileView vehicleId={fileVehicleId} onClose={() => setFileVehicleId(null)} />
      )}
    </div>
  );
}
