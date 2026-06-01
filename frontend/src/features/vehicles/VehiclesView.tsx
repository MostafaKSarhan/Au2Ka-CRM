import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Search, Car, User, PlusCircle } from 'lucide-react';

const POPULAR_BRANDS = [
  'تويوتا', 'هيونداي', 'كيا', 'نيسان', 'فورد',
  'لكزس', 'مرسيدس', 'بي إم دبليو', 'أودي', 'هوندا',
  'شيفروليه', 'جي إم سي', 'مازدا'
];

export function VehiclesView() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showAddModal, setShowAddModal] = useState(false);

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
      setErrorMsg('يرجى تحديد أو كتابة ماركة السيارة');
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
      setErrorMsg(err.response?.data?.message || 'فشل حفظ بيانات السيارة');
    }
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">قاعدة بيانات السيارات</h1>
          <p className="text-sm text-zinc-400">البحث ومتابعة جميع السيارات المسجلة بورشة الصيانة.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition cursor-pointer"
        >
          <PlusCircle size={16} /> تسجيل سيارة جديدة
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 right-3 flex items-center text-zinc-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="البحث برقم اللوحة، نوع السيارة أو الموديل..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pr-10 pl-4 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
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
          <p>لا توجد سيارات مطابقة للبحث.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <div key={v.id} className="glass-panel rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary ml-2">
                  <Car size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{v.brand} {v.model}</h3>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">رقم اللوحة: {v.plateNumber}</p>
                </div>
              </div>

              <div className="border-t border-zinc-800/80 pt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <User size={14} className="ml-1" />
                  <span>{v.customer?.fullName || 'مالك غير معروف'}</span>
                </div>
                <div className="text-zinc-500 font-medium font-mono">
                  {v.mileage.toLocaleString('ar-EG')} كم
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination footer */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">الصفحة {page} من {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              السابق
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="rounded bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add Vehicle */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">تسجيل سيارة جديدة</h2>
            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">اختر العميل (المالك)</label>
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
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">نوع السيارة</label>
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
                    <option value="CUSTOM">أخرى (إدخال يدوي)</option>
                  </select>

                  {isCustomBrand && (
                    <input
                      type="text"
                      required
                      value={form.customBrand}
                      onChange={(e) => setForm({ ...form, customBrand: e.target.value })}
                      placeholder="اكتب ماركة السيارة هنا..."
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white mt-2 focus:outline-none"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">الموديل</label>
                  <input
                    type="text"
                    required
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="مثال: X5"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">رقم اللوحة</label>
                <input
                  type="text"
                  required
                  value={form.plateNumber}
                  onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
                  placeholder="مثال: د ب أ 77"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">العداد الممشى الحالي (كم)</label>
                <input
                  type="number"
                  required
                  value={form.mileage}
                  onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                  placeholder="مثال: 84000"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover cursor-pointer"
                >
                  حفظ السيارة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
