import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Search, UserPlus, Phone, BookOpen, PlusCircle, Car } from 'lucide-react';

const POPULAR_BRANDS = [
  'تويوتا', 'هيونداي', 'كيا', 'نيسان', 'فورد',
  'لكزس', 'مرسيدس', 'بي إم دبليو', 'أودي', 'هوندا',
  'شيفروليه', 'جي إم سي', 'مازدا'
];

export function CustomersView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Unified Creation Form (Customer + Vehicle)
  const [custForm, setCustForm] = useState({
    fullName: '',
    mobileNumber: '',
    notes: '',
    // Vehicle details
    brand: POPULAR_BRANDS[0],
    customBrand: '',
    model: '',
    plateNumber: '',
    mileage: '',
  });

  const [isCustomBrand, setIsCustomBrand] = useState(false);

  // Single Vehicle Add Form (inside details modal)
  const [vehForm, setVehForm] = useState({
    brand: POPULAR_BRANDS[0],
    customBrand: '',
    model: '',
    plateNumber: '',
    mileage: ''
  });
  const [isSingleCustomBrand, setIsSingleCustomBrand] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [search, page]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const res = await api.get(`/customers?search=${search}&page=${page}&limit=10`);
      setCustomers(res.data.customers || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCustomerAndVehicle(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    const finalBrand = isCustomBrand ? custForm.customBrand.trim() : custForm.brand;
    if (!finalBrand) {
      setErrorMsg('يرجى تحديد أو كتابة ماركة السيارة');
      return;
    }

    try {
      // 1. Create Customer
      const customerRes = await api.post('/customers', {
        fullName: custForm.fullName,
        mobileNumber: custForm.mobileNumber,
        notes: custForm.notes,
      });

      const customerId = customerRes.data.customer.id;

      // 2. Create Vehicle
      await api.post('/vehicles', {
        customerId,
        brand: finalBrand,
        model: custForm.model,
        plateNumber: custForm.plateNumber,
        mileage: Number(custForm.mileage)
      });

      setShowAddModal(false);
      // Reset Form
      setCustForm({
        fullName: '',
        mobileNumber: '',
        notes: '',
        brand: POPULAR_BRANDS[0],
        customBrand: '',
        model: '',
        plateNumber: '',
        mileage: '',
      });
      setIsCustomBrand(false);
      loadCustomers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'حدث خطأ أثناء حفظ بيانات العميل والسيارة');
    }
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    const finalBrand = isSingleCustomBrand ? vehForm.customBrand.trim() : vehForm.brand;
    if (!finalBrand) {
      setErrorMsg('يرجى تحديد أو كتابة ماركة السيارة');
      return;
    }

    try {
      await api.post('/vehicles', {
        customerId: selectedCustomer.id,
        brand: finalBrand,
        model: vehForm.model,
        plateNumber: vehForm.plateNumber,
        mileage: Number(vehForm.mileage)
      });
      setShowAddVehicleModal(false);
      setVehForm({ brand: POPULAR_BRANDS[0], customBrand: '', model: '', plateNumber: '', mileage: '' });
      setIsSingleCustomBrand(false);
      const res = await api.get(`/customers/${selectedCustomer.id}`);
      setSelectedCustomer(res.data.customer);
      loadCustomers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل حفظ بيانات السيارة');
    }
  }

  async function viewCustomerDetails(customer: any) {
    try {
      const res = await api.get(`/customers/${customer.id}`);
      setSelectedCustomer(res.data.customer);
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
    }
  }

  const statusLabels: Record<string, string> = {
    RECEIVED: 'تم الاستلام',
    INSPECTION: 'قيد الفحص',
    WAITING_APPROVAL: 'انتظار الموافقة',
    IN_PROGRESS: 'تحت الإصلاح',
    COMPLETED: 'تم الإصلاح',
    DELIVERED: 'تم التسليم'
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">دليل العملاء والسيارات</h1>
          <p className="text-sm text-zinc-400">إدارة ملفات العملاء وتسجيل مركباتهم في خطوة واحدة مبسطة.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition cursor-pointer"
        >
          <UserPlus size={16} /> تسجيل عميل وسيارة جديدة
        </button>
      </div>

      {/* Filter and Search */}
      <div className="relative">
        <span className="absolute inset-y-0 right-3 flex items-center text-zinc-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="البحث باسم العميل أو رقم الجوال..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pr-10 pl-4 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Customer List */}
      <div className="glass-panel overflow-hidden rounded-xl">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-zinc-500">
            <p>لا يوجد عملاء مسجلين حالياً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-zinc-300">
              <thead className="bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-6 py-4">اسم العميل</th>
                  <th className="px-6 py-4">رقم الجوال</th>
                  <th className="px-6 py-4">السيارات المسجلة</th>
                  <th className="px-6 py-4">تاريخ التسجيل</th>
                  <th className="px-6 py-4 text-left">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-transparent">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/30 transition">
                    <td className="px-6 py-4 font-medium text-white">{c.fullName}</td>
                    <td className="px-6 py-4 font-mono">{c.mobileNumber}</td>
                    <td className="px-6 py-4">
                      {c.vehicles?.length || 0} سيارات مسجلة
                    </td>
                    <td className="px-6 py-4">{new Date(c.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td className="px-6 py-4 text-left">
                      <button
                        onClick={() => viewCustomerDetails(c)}
                        className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-white transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen size={12} /> عرض التفاصيل والسجل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 bg-zinc-900/30">
            <p className="text-xs text-zinc-400">الصفحة {page} من {totalPages}</p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                السابق
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Customer + Vehicle Wizard */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-panel rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white border-b border-zinc-800 pb-2">تسجيل عميل وسيارة جديدة (معاً)</h2>
            {errorMsg && <p className="text-xs text-red-500 font-semibold">{errorMsg}</p>}
            <form onSubmit={handleAddCustomerAndVehicle} className="space-y-6">
              
              {/* Part 1: Customer Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary">أولاً: معلومات العميل</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">اسم العميل كامل</label>
                    <input
                      type="text"
                      required
                      value={custForm.fullName}
                      onChange={(e) => setCustForm({ ...custForm, fullName: e.target.value })}
                      placeholder="مثال: عبدالله سالم"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">رقم الجوال</label>
                    <input
                      type="text"
                      required
                      value={custForm.mobileNumber}
                      onChange={(e) => setCustForm({ ...custForm, mobileNumber: e.target.value })}
                      placeholder="مثال: +96650000000"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none text-left font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">ملاحظات العميل</label>
                  <input
                    type="text"
                    value={custForm.notes}
                    onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
                    placeholder="ملاحظات اختيارية عن العميل..."
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Part 2: Vehicle Info */}
              <div className="space-y-4 border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-bold text-accent">ثانياً: معلومات السيارة</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">نوع السيارة (الشركة المصنعة)</label>
                    <select
                      value={isCustomBrand ? 'CUSTOM' : custForm.brand}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'CUSTOM') {
                          setIsCustomBrand(true);
                        } else {
                          setIsCustomBrand(false);
                          setCustForm({ ...custForm, brand: val });
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
                        value={custForm.customBrand}
                        onChange={(e) => setCustForm({ ...custForm, customBrand: e.target.value })}
                        placeholder="اكتب ماركة السيارة هنا..."
                        className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white mt-2 focus:outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">الموديل (الطراز)</label>
                    <input
                      type="text"
                      required
                      value={custForm.model}
                      onChange={(e) => setCustForm({ ...custForm, model: e.target.value })}
                      placeholder="مثال: كامري"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">رقم اللوحة</label>
                    <input
                      type="text"
                      required
                      value={custForm.plateNumber}
                      onChange={(e) => setCustForm({ ...custForm, plateNumber: e.target.value })}
                      placeholder="مثال: أ ب ج 1234"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">العداد الممشى الحالي (كم)</label>
                    <input
                      type="number"
                      required
                      value={custForm.mileage}
                      onChange={(e) => setCustForm({ ...custForm, mileage: e.target.value })}
                      placeholder="مثال: 150000"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded bg-primary px-5 py-2 text-sm text-white hover:bg-primary-hover font-semibold cursor-pointer"
                >
                  حفظ العميل والسيارة معاً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Customer Details */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-panel rounded-xl p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedCustomer.fullName}</h2>
                <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1 font-mono">
                  <Phone size={14} /> {selectedCustomer.mobileNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕ إغلاق
              </button>
            </div>

            {/* Registered Vehicles */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-zinc-300">السيارات المسجلة</h3>
                <button
                  onClick={() => setShowAddVehicleModal(true)}
                  className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={14} /> إضافة سيارة للعميل
                </button>
              </div>

              {selectedCustomer.vehicles?.length === 0 ? (
                <p className="text-xs text-zinc-500 bg-zinc-900/40 p-4 rounded border border-zinc-800">لا توجد سيارات مسجلة لهذا العميل حالياً.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedCustomer.vehicles.map((v: any) => (
                    <div key={v.id} className="p-3 bg-zinc-900/60 rounded border border-zinc-800 flex items-center gap-3">
                      <Car className="text-primary" size={20} />
                      <div>
                        <p className="text-sm font-semibold text-white">{v.brand} {v.model}</p>
                        <p className="text-xs text-zinc-400 font-mono">رقم اللوحة: {v.plateNumber} | العداد: {v.mileage} كم</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Job Cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">سجل كروت استقبال السيارات السابقة</h3>
              {selectedCustomer.jobCards?.length === 0 ? (
                <p className="text-xs text-zinc-500 bg-zinc-900/40 p-4 rounded border border-zinc-800">لا توجد سجلات سابقة.</p>
              ) : (
                <div className="divide-y divide-zinc-800 bg-zinc-900/40 rounded border border-zinc-800">
                  {selectedCustomer.jobCards.map((j: any) => (
                    <div key={j.id} className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold text-white">{j.jobNumber}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{j.customerComplaint}</p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        j.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        j.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {statusLabels[j.status] || j.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Vehicle */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">إضافة سيارة للعميل: {selectedCustomer?.fullName}</h2>
            {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">نوع السيارة</label>
                  <select
                    value={isSingleCustomBrand ? 'CUSTOM' : vehForm.brand}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'CUSTOM') {
                        setIsSingleCustomBrand(true);
                      } else {
                        setIsSingleCustomBrand(false);
                        setVehForm({ ...vehForm, brand: val });
                      }
                    }}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white focus:outline-none"
                  >
                    {POPULAR_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    <option value="CUSTOM">أخرى (إدخال يدوي)</option>
                  </select>

                  {isSingleCustomBrand && (
                    <input
                      type="text"
                      required
                      value={vehForm.customBrand}
                      onChange={(e) => setVehForm({ ...vehForm, customBrand: e.target.value })}
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
                    value={vehForm.model}
                    onChange={(e) => setVehForm({ ...vehForm, model: e.target.value })}
                    placeholder="مثال: كامري"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">رقم اللوحة</label>
                <input
                  type="text"
                  required
                  value={vehForm.plateNumber}
                  onChange={(e) => setVehForm({ ...vehForm, plateNumber: e.target.value })}
                  placeholder="مثال: أ ب ج 1234"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">العداد الممشى (كم)</label>
                <input
                  type="number"
                  required
                  value={vehForm.mileage}
                  onChange={(e) => setVehForm({ ...vehForm, mileage: e.target.value })}
                  placeholder="مثال: 150000"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
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
