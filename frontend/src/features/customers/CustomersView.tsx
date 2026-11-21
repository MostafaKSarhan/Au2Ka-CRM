import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { Search, UserPlus, Phone, BookOpen, PlusCircle, Car, BadgeCheck } from 'lucide-react';

const POPULAR_BRANDS = [
  'تويوتا', 'هيونداي', 'كيا', 'نيسان', 'فورد',
  'لكزس', 'مرسيدس', 'بي إم دبليو', 'أودي', 'هوندا',
  'شيفروليه', 'جي إم سي', 'مازدا'
];

export function CustomersView() {
  const { lang, t } = useTranslation();
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
      setErrorMsg(lang === 'ar' ? 'يرجى تحديد أو كتابة ماركة السيارة' : 'Please select or write the vehicle brand');
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
      setErrorMsg(err.response?.data?.message || (lang === 'ar' ? 'حدث خطأ أثناء حفظ بيانات العميل والسيارة' : 'Error occurred while saving customer and vehicle details'));
    }
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    const finalBrand = isSingleCustomBrand ? vehForm.customBrand.trim() : vehForm.brand;
    if (!finalBrand) {
      setErrorMsg(lang === 'ar' ? 'يرجى تحديد أو كتابة ماركة السيارة' : 'Please select or write the vehicle brand');
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
      setErrorMsg(err.response?.data?.message || (lang === 'ar' ? 'فشل حفظ بيانات السيارة' : 'Failed to save vehicle details'));
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
    RECEIVED: t('status_RECEIVED'),
    INSPECTION: t('status_INSPECTION'),
    WAITING_APPROVAL: t('status_WAITING_APPROVAL'),
    IN_PROGRESS: t('status_IN_PROGRESS'),
    COMPLETED: t('status_COMPLETED'),
    DELIVERED: t('status_DELIVERED')
  };

  const isRtl = lang === 'ar';

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('customersTitle')}</h1>
          <p className="text-sm text-zinc-400">{t('customersSubtitle')}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition cursor-pointer"
        >
          <UserPlus size={16} /> {t('addCustomer')}
        </button>
      </div>

      {/* Filter and Search */}
      <div className="relative">
        <span className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-zinc-400`}>
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder={t('searchCustomer')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={`w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none`}
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
            <p>{t('noCustomers')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm text-zinc-300">
              <thead className="bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className={`px-6 py-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('fullName')}</th>
                  <th className={`px-6 py-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('mobileNumber')}</th>
                  <th className={`px-6 py-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('vehiclesCountLabel')}</th>
                  <th className={`px-6 py-4 ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'تاريخ التسجيل' : 'Registration Date'}</th>
                  <th className={`px-6 py-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-transparent">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/30 transition">
                    <td className={`px-6 py-4 font-medium text-white ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {c.fullName}
                        <SubscriberBadge subscription={c.subscriptions?.[0]} isRtl={isRtl} t={t} />
                      </div>
                    </td>
                    <td className={`px-6 py-4 font-mono ${isRtl ? 'text-right' : 'text-left'}`}>{c.mobileNumber}</td>
                    <td className={`px-6 py-4 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {c.vehicles?.length || 0} {isRtl ? 'سيارات مسجلة' : 'Vehicles'}
                    </td>
                    <td className={`px-6 py-4 ${isRtl ? 'text-right' : 'text-left'}`}>{new Date(c.createdAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                    <td className={`px-6 py-4 ${isRtl ? 'text-left' : 'text-right'}`}>
                      <button
                        onClick={() => viewCustomerDetails(c)}
                        className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-white transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen size={12} /> {isRtl ? 'عرض التفاصيل والسجل' : 'View Details & History'}
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
            <p className="text-xs text-zinc-400">
              {isRtl ? `الصفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
              >
                {isRtl ? 'السابق' : 'Previous'}
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="rounded bg-zinc-800 px-3 py-1 text-xs text-white hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
              >
                {isRtl ? 'التالي' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Customer + Vehicle Wizard */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl glass-panel rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className={`text-xl font-bold text-white border-b border-zinc-800 pb-2 ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? 'تسجيل عميل وسيارة جديدة (معاً)' : 'Register Customer & Vehicle'}
            </h2>
            {errorMsg && <p className={`text-xs text-red-500 font-semibold ${isRtl ? 'text-right' : 'text-left'}`}>{errorMsg}</p>}
            <form onSubmit={handleAddCustomerAndVehicle} className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
              
              {/* Part 1: Customer Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-primary-text">{isRtl ? 'أولاً: معلومات العميل' : '1. Customer Information'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('fullName')}</label>
                    <input
                      type="text"
                      required
                      value={custForm.fullName}
                      onChange={(e) => setCustForm({ ...custForm, fullName: e.target.value })}
                      placeholder="e.g. Abdullah Salem"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('mobileNumber')}</label>
                    <input
                      type="text"
                      required
                      value={custForm.mobileNumber}
                      onChange={(e) => setCustForm({ ...custForm, mobileNumber: e.target.value })}
                      placeholder="e.g. 96650000000"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none text-left font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('notesLabel')}</label>
                  <input
                    type="text"
                    value={custForm.notes}
                    onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })}
                    placeholder={isRtl ? 'ملاحظات اختيارية عن العميل...' : 'Optional notes about customer...'}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Part 2: Vehicle Info */}
              <div className="space-y-4 border-t border-zinc-800 pt-4">
                <h3 className="text-sm font-bold text-accent">{isRtl ? 'ثانياً: معلومات السيارة' : '2. Vehicle Information'}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('vehicleBrand')}</label>
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
                      <option value="CUSTOM">{isRtl ? 'أخرى (إدخال يدوي)' : 'Other (Manual Entry)'}</option>
                    </select>

                    {isCustomBrand && (
                      <input
                        type="text"
                        required
                        value={custForm.customBrand}
                        onChange={(e) => setCustForm({ ...custForm, customBrand: e.target.value })}
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
                      value={custForm.model}
                      onChange={(e) => setCustForm({ ...custForm, model: e.target.value })}
                      placeholder="e.g. Camry"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('plateNumber')}</label>
                    <input
                      type="text"
                      required
                      value={custForm.plateNumber}
                      onChange={(e) => setCustForm({ ...custForm, plateNumber: e.target.value })}
                      placeholder="e.g. ABC 1234"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('mileage')}</label>
                    <input
                      type="number"
                      required
                      value={custForm.mileage}
                      onChange={(e) => setCustForm({ ...custForm, mileage: e.target.value })}
                      placeholder="e.g. 150000"
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded bg-primary px-5 py-2 text-sm text-white hover:bg-primary-hover font-semibold cursor-pointer"
                >
                  {isRtl ? 'حفظ العميل والسيارة معاً' : 'Save Customer & Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Customer Details */}
      {showDetailModal && selectedCustomer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl glass-panel rounded-xl p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-white">
                  {selectedCustomer.fullName}
                  <SubscriberBadge
                    subscription={selectedCustomer.subscriptions?.find((s: any) => s.status === 'ACTIVE')}
                    isRtl={isRtl}
                    t={t}
                  />
                </h2>
                <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1 font-mono">
                  <Phone size={14} /> {selectedCustomer.mobileNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                {t('zoomedClose').replace('✕ ', '')}
              </button>
            </div>

            {/* Registered Vehicles */}
            <div className={`space-y-3 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-zinc-300">{t('vehiclesCountLabel')}</h3>
                <button
                  onClick={() => setShowAddVehicleModal(true)}
                  className="text-xs text-primary-text hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle size={14} /> {isRtl ? 'إضافة سيارة للعميل' : 'Add Vehicle for Customer'}
                </button>
              </div>

              {selectedCustomer.vehicles?.length === 0 ? (
                <p className="text-xs text-zinc-500 bg-zinc-900/40 p-4 rounded border border-zinc-800">{isRtl ? 'لا توجد سيارات مسجلة لهذا العميل حالياً.' : 'No vehicles registered for this customer yet.'}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedCustomer.vehicles.map((v: any) => (
                    <div key={v.id} className="p-3 bg-zinc-900/60 rounded border border-zinc-800 flex items-center gap-3">
                      <Car className="text-primary-text" size={20} />
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <p className="text-sm font-semibold text-white">{v.brand} {v.model}</p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {isRtl ? `رقم اللوحة: ${v.plateNumber} | العداد: ${v.mileage} كم` : `Plate: ${v.plateNumber} | Mileage: ${v.mileage} km`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Job Cards */}
            <div className={`space-y-3 ${isRtl ? 'text-right' : 'text-left'}`}>
              <h3 className="text-sm font-semibold text-zinc-300">{isRtl ? 'سجل كروت استقبال السيارات السابقة' : 'Past Job Cards History'}</h3>
              {selectedCustomer.jobCards?.length === 0 ? (
                <p className="text-xs text-zinc-500 bg-zinc-900/40 p-4 rounded border border-zinc-800">{isRtl ? 'لا توجد سجلات سابقة.' : 'No past maintenance records found.'}</p>
              ) : (
                <div className="divide-y divide-zinc-800 bg-zinc-900/40 rounded border border-zinc-800">
                  {selectedCustomer.jobCards.map((j: any) => (
                    <div key={j.id} className="p-3 flex justify-between items-center">
                      <div className={isRtl ? 'text-right' : 'text-left'}>
                        <p className="text-xs font-semibold text-white font-mono">{j.jobNumber}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel rounded-xl p-6 space-y-4">
            <h2 className={`text-xl font-bold text-white ${isRtl ? 'text-right' : 'text-left'}`}>
              {isRtl ? `إضافة سيارة للعميل: ${selectedCustomer?.fullName}` : `Add Vehicle for: ${selectedCustomer?.fullName}`}
            </h2>
            {errorMsg && <p className={`text-xs text-red-500 ${isRtl ? 'text-right' : 'text-left'}`}>{errorMsg}</p>}
            <form onSubmit={handleAddVehicle} className={`space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('vehicleBrand')}</label>
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
                    <option value="CUSTOM">{isRtl ? 'أخرى (إدخال يدوي)' : 'Other (Manual Entry)'}</option>
                  </select>

                  {isSingleCustomBrand && (
                    <input
                      type="text"
                      required
                      value={vehForm.customBrand}
                      onChange={(e) => setVehForm({ ...vehForm, customBrand: e.target.value })}
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
                    value={vehForm.model}
                    onChange={(e) => setVehForm({ ...vehForm, model: e.target.value })}
                    placeholder="e.g. Camry"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('plateNumber')}</label>
                <input
                  type="text"
                  required
                  value={vehForm.plateNumber}
                  onChange={(e) => setVehForm({ ...vehForm, plateNumber: e.target.value })}
                  placeholder="e.g. ABC 1234"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('mileage')}</label>
                <input
                  type="number"
                  required
                  value={vehForm.mileage}
                  onChange={(e) => setVehForm({ ...vehForm, mileage: e.target.value })}
                  placeholder="e.g. 150000"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
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
    </div>
  );
}

/**
 * "Subscriber" badge (M1) — shows the plan and what is left on it, so the
 * receptionist can see the customer's entitlement before opening a job card.
 */
function SubscriberBadge({
  subscription,
  isRtl,
  t,
}: {
  subscription: any;
  isRtl: boolean;
  t: (key: string) => string;
}) {
  if (!subscription) return null;

  const remaining = Math.max(0, subscription.freeVisitsTotal - subscription.freeVisitsUsed);
  const discount = Number(subscription.discountPercent);
  const planName = isRtl ? subscription.plan?.nameAr : subscription.plan?.nameEn;

  // Show what the customer is entitled to next: a remaining free visit if any,
  // otherwise the discount that will be applied instead.
  const detail =
    remaining > 0
      ? `${remaining} ${t('sub_visitsLeftShort')}`
      : discount > 0
        ? `${t('sub_badgeDiscount')} ${discount}%`
        : '';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400"
      title={`${planName || ''}${detail ? ' — ' + detail : ''}`}
    >
      <BadgeCheck size={12} />
      {t('sub_badge')}
      {detail && <span className="font-normal text-emerald-300/80">· {detail}</span>}
    </span>
  );
}
