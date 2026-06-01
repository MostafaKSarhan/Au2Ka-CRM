import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Search, PlusCircle, Wrench, Clock, CheckCircle, UploadCloud, User, FileText, Eye, Receipt, Printer, Share2, UserPlus, Car as CarIcon } from 'lucide-react';
import { UPLOADS_BASE_URL } from '../../lib/api';
import html2canvas from 'html2canvas';

const STATUS_COLUMNS = [
  { id: 'RECEIVED', label: 'تم الاستلام', color: 'text-zinc-400 bg-zinc-800/40 border-zinc-800' },
  { id: 'INSPECTION', label: 'قيد الفحص', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  { id: 'WAITING_APPROVAL', label: 'انتظار الموافقة', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  { id: 'IN_PROGRESS', label: 'تحت الإصلاح', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'COMPLETED', label: 'تم الإصلاح', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  { id: 'DELIVERED', label: 'تم التسليم', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['INSPECTION'],
  INSPECTION: ['RECEIVED', 'WAITING_APPROVAL'],
  WAITING_APPROVAL: ['INSPECTION', 'IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_APPROVAL', 'COMPLETED'],
  COMPLETED: ['IN_PROGRESS', 'DELIVERED'],
  DELIVERED: ['COMPLETED']
};

const statusLabels: Record<string, string> = {
  RECEIVED: 'تم الاستلام',
  INSPECTION: 'قيد الفحص',
  WAITING_APPROVAL: 'انتظار الموافقة',
  IN_PROGRESS: 'تحت الإصلاح',
  COMPLETED: 'تم الإصلاح',
  DELIVERED: 'تم التسليم'
};

function isVideoFile(filePath: string) {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  return videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
}

export function JobCardsView() {
  const { user } = useAuthStore();
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Creation Form
  const [form, setForm] = useState({
    customerId: '',
    vehicleId: '',
    customerComplaint: '',
    initialInspection: '',
    requiredRepairs: '',
    estimatedCost: '',
    technicianName: '',
    notes: '',
  });

  // Inline new customer/vehicle forms inside Add Modal
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ fullName: '', mobileNumber: '', notes: '' });
  const [newVehicleForm, setNewVehicleForm] = useState({ brand: '', model: '', plateNumber: '', mileage: '' });
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineMsg, setInlineMsg] = useState('');

  // Edit / Status Forms
  const [editForm, setEditForm] = useState<any>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [showZoomedQR, setShowZoomedQR] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);

  useEffect(() => {
    loadJobCards();
  }, [search]);

  useEffect(() => {
    if (showAddModal) {
      loadCustomers();
      loadTechnicians();
      // Auto-fill technician name if the logged-in user is a technician
      if (user?.role === 'TECHNICIAN') {
        setForm(f => ({ ...f, technicianName: `${user.firstName} ${user.lastName}` }));
      }
    }
  }, [showAddModal]);

  useEffect(() => {
    if (form.customerId) {
      loadCustomerVehicles(form.customerId);
    } else {
      setVehicles([]);
    }
  }, [form.customerId]);

  async function loadJobCards() {
    try {
      setLoading(true);
      const res = await api.get(`/job-cards?search=${search}&limit=100`);
      setJobCards(res.data.jobCards || []);
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

  async function loadCustomerVehicles(customerId: string) {
    try {
      const res = await api.get(`/customers/${customerId}`);
      const list = res.data.customer?.vehicles || [];
      setVehicles(list);
      if (list.length > 0) {
        setForm(f => ({ ...f, vehicleId: list[0].id }));
      } else {
        setForm(f => ({ ...f, vehicleId: '' }));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadTechnicians() {
    try {
      const res = await api.get('/users/technicians');
      setTechnicians(res.data.technicians || []);
    } catch (e) {
      console.error(e);
    }
  }

  // Create new customer inline and select them automatically
  async function handleCreateCustomerInline(e: React.FormEvent) {
    e.preventDefault();
    setInlineMsg('');
    if (!newCustomerForm.fullName.trim() || !newCustomerForm.mobileNumber.trim()) {
      setInlineMsg('الاسم ورقم الجوال مطلوبان.');
      return;
    }
    setInlineLoading(true);
    try {
      const res = await api.post('/customers', newCustomerForm);
      const createdCustomer = res.data.customer;
      await loadCustomers();
      setForm(f => ({ ...f, customerId: createdCustomer.id, vehicleId: '' }));
      setVehicles([]);
      setNewCustomerForm({ fullName: '', mobileNumber: '', notes: '' });
      setShowNewCustomerForm(false);
      setInlineMsg(`✅ تم إضافة العميل "${createdCustomer.fullName}" بنجاح`);
    } catch (err: any) {
      setInlineMsg('❌ ' + (err.response?.data?.message || 'فشل إضافة العميل'));
    } finally {
      setInlineLoading(false);
    }
  }

  // Create new vehicle inline for selected customer
  async function handleCreateVehicleInline(e: React.FormEvent) {
    e.preventDefault();
    setInlineMsg('');
    if (!form.customerId) {
      setInlineMsg('يرجى اختيار العميل أولاً قبل إضافة سيارة.');
      return;
    }
    if (!newVehicleForm.brand || !newVehicleForm.model || !newVehicleForm.plateNumber) {
      setInlineMsg('المارك والموديل ورقم اللوحة مطلوبة.');
      return;
    }
    setInlineLoading(true);
    try {
      const res = await api.post('/vehicles', {
        customerId: form.customerId,
        brand: newVehicleForm.brand,
        model: newVehicleForm.model,
        plateNumber: newVehicleForm.plateNumber,
        mileage: Number(newVehicleForm.mileage) || 0,
      });
      const createdVehicle = res.data.vehicle;
      await loadCustomerVehicles(form.customerId);
      setForm(f => ({ ...f, vehicleId: createdVehicle.id }));
      setNewVehicleForm({ brand: '', model: '', plateNumber: '', mileage: '' });
      setShowNewVehicleForm(false);
      setInlineMsg(`✅ تم إضافة السيارة "${createdVehicle.brand} ${createdVehicle.model}" بنجاح`);
    } catch (err: any) {
      setInlineMsg('❌ ' + (err.response?.data?.message || 'فشل إضافة السيارة'));
    } finally {
      setInlineLoading(false);
    }
  }

  async function handleAddJob(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!form.vehicleId) {
      setErrorMsg('العميل المختار ليس لديه سيارات مسجلة. يرجى تسجيل سيارة للعميل أولاً.');
      return;
    }

    try {
      await api.post('/job-cards', {
        ...form,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined
      });
      setShowAddModal(false);
      setShowNewCustomerForm(false);
      setShowNewVehicleForm(false);
      setInlineMsg('');
      setForm({
        customerId: '',
        vehicleId: '',
        customerComplaint: '',
        initialInspection: '',
        requiredRepairs: '',
        estimatedCost: '',
        technicianName: '',
        notes: '',
      });
      loadJobCards();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل فتح كرت الاستقبال');
    }
  }

  async function viewJobDetails(job: any) {
    try {
      const res = await api.get(`/job-cards/${job.id}`);
      const fullJob = res.data.jobCard;
      setSelectedJob(fullJob);
      setQrScanned(localStorage.getItem(`qr_scanned_${fullJob.id}`) === 'true');
      setEditForm({
        customerComplaint: fullJob.customerComplaint,
        initialInspection: fullJob.initialInspection || '',
        requiredRepairs: fullJob.requiredRepairs || '',
        estimatedCost: fullJob.estimatedCost ? Number(fullJob.estimatedCost) : '',
        approvalStatus: fullJob.approvalStatus,
        technicianName: fullJob.technicianName || '',
        notes: fullJob.notes || '',
        isVehiclePhotographed: fullJob.isVehiclePhotographed || false,
        isDataCompleted: localStorage.getItem(`job_data_complete_${fullJob.id}`) === 'true',
        additionalServices: fullJob.additionalServices || '',
      });
      setShowDetailModal(true);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleUpdateJobDetails(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await api.put(`/job-cards/${selectedJob.id}`, {
        customerComplaint: editForm.customerComplaint,
        initialInspection: editForm.initialInspection,
        requiredRepairs: editForm.requiredRepairs,
        approvalStatus: editForm.approvalStatus,
        technicianName: editForm.technicianName,
        notes: editForm.notes,
        isVehiclePhotographed: !!editForm.isVehiclePhotographed,
        estimatedCost: editForm.estimatedCost ? Number(editForm.estimatedCost) : null,
        additionalServices: editForm.additionalServices || '',
      });
      localStorage.setItem(`job_data_complete_${selectedJob.id}`, editForm.isDataCompleted ? 'true' : 'false');
      setSelectedJob(res.data.jobCard);
      loadJobCards();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل تحديث البيانات');
    }
  }

  async function handleTransitionStatus(targetStatus: string) {
    setErrorMsg('');
    if (selectedJob?.status === 'WAITING_APPROVAL' && targetStatus === 'IN_PROGRESS') {
      const isQrScanned = localStorage.getItem(`qr_scanned_${selectedJob.id}`) === 'true';
      if (!isQrScanned) {
        setErrorMsg('⚠️ خطوة إجبارية: يجب أولاً عرض الرمز (QR Code) أو إرساله للعميل لتوثيق الموافقة الفورية قبل بدء العمل!');
        return;
      }
    }
    try {
      const res = await api.put(`/job-cards/${selectedJob.id}`, {
        status: targetStatus
      });
      setSelectedJob(res.data.jobCard);
      loadJobCards();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'حالة الانتقال غير مسموح بها حالياً');
    }
  }

  function markQRAsScanned() {
    if (selectedJob) {
      localStorage.setItem(`qr_scanned_${selectedJob.id}`, 'true');
      setQrScanned(true);
    }
  }

  async function getBase64Image(imgUrl: string): Promise<string> {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to get Base64 of image', e);
      throw e;
    }
  }

  async function downloadInvoiceAsImage() {
    const element = document.getElementById('printable-invoice-layout');
    if (!element) {
      alert('خطأ: لم يتم العثور على تصميم الكارت للطباعة!');
      return;
    }

    const qrImage = element.querySelector('img[alt="WhatsApp QR Code"]') as HTMLImageElement;
    let originalSrc = '';
    let isQrModified = false;

    try {
      if (qrImage && qrImage.src) {
        originalSrc = qrImage.src;
        const base64Data = await getBase64Image(qrImage.src);
        qrImage.src = base64Data;
        isQrModified = true;
      }
    } catch (e) {
      console.warn('CORS check failed on QR Image. Temporarily hiding it to allow capture without SecurityError.', e);
      if (qrImage) {
        qrImage.style.display = 'none';
      }
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // high quality
        useCORS: true,
        allowTaint: false, // must be false to avoid security errors when calling toDataURL
        backgroundColor: '#ffffff',
        width: element.offsetWidth,
        height: element.offsetHeight,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight
      });

      // Restore QR Image
      if (qrImage) {
        if (isQrModified && originalSrc) {
          qrImage.src = originalSrc;
        }
        qrImage.style.display = '';
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `card-${selectedJob?.jobNumber || 'invoice'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e: any) {
      // Restore on error as well
      if (qrImage) {
        if (isQrModified && originalSrc) {
          qrImage.src = originalSrc;
        }
        qrImage.style.display = '';
      }
      console.error('Failed to convert HTML to image', e);
      alert('فشل تصدير الكارت كصورة: ' + (e.message || e.toString()));
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg('');
    setUploadLoading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        await api.post(`/job-cards/${selectedJob.id}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      const res = await api.get(`/job-cards/${selectedJob.id}`);
      setSelectedJob(res.data.jobCard);
      setEditForm((prev: any) => ({ ...prev, isVehiclePhotographed: true }));
      loadJobCards();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'فشل تحميل الملفات');
    } finally {
      setUploadLoading(false);
    }
  }

  // Generate WhatsApp Message Text & Link
  function getWhatsAppShareLink() {
    if (!selectedJob) return '';
    const savedPhone = localStorage.getItem('whatsappNumber') || '201015657091';
    
    // Parse additional services for the text message
    let servicesText = '';
    try {
      if (selectedJob.additionalServices) {
        const services = JSON.parse(selectedJob.additionalServices);
        if (services.length > 0) {
          servicesText = '\n• الخدمات الإضافية:\n' + services.map((s: any) => `  - ${s.name}: ${s.price} ريال`).join('\n');
        }
      }
    } catch(e) {}

    const baseCost = Number(selectedJob.estimatedCost) || 0;
    let servicesTotal = 0;
    try {
      if (selectedJob.additionalServices) {
        servicesTotal = JSON.parse(selectedJob.additionalServices).reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0);
      }
    } catch(e) {}
    const grandTotal = baseCost + servicesTotal;
    const costText = `${grandTotal} ريال (أساسي: ${baseCost} ريال + إضافي: ${servicesTotal} ريال)`;

    let approvalMessage = 'موافق على الإصلاح ومكتمل 👍';
    if (selectedJob.status === 'WAITING_APPROVAL') {
      approvalMessage = `أنا العميل (${selectedJob.customer?.fullName})، أؤكد بموجب هذه الرسالة موافقتي الكاملة على البدء في أعمال الصيانة والتكلفة الإجمالية المذكورة أعلاه. ✅`;
    }

    const text = `مرحباً من ورشة Au2Ka 🚗\n\nإليك تفاصيل كرت استقبال السيارة:\n• رقم كرت العمل: ${selectedJob.jobNumber}\n• العميل: ${selectedJob.customer?.fullName}\n• السيارة: ${selectedJob.vehicle?.brand} ${selectedJob.vehicle?.model}\n• رقم اللوحة: ${selectedJob.vehicle?.plateNumber}\n• العداد: ${selectedJob.vehicle?.mileage} كم\n• الشكوى: ${selectedJob.customerComplaint}\n• الفحص الأولي: ${selectedJob.initialInspection || 'لا يوجد'}\n• الإصلاحات المطلوبة: ${selectedJob.requiredRepairs || 'لا يوجد'}${servicesText}\n• التكلفة الكلية: ${costText}\n\n• قرار الاعتماد:\n${approvalMessage}\n\nشكراً لتعاملكم معنا!`;
    return `https://api.whatsapp.com/send?phone=${savedPhone}&text=${encodeURIComponent(text)}`;
  }

  function getQRCodeUrl() {
    const link = getWhatsAppShareLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(link)}`;
  }

  const activeWhatsappNumber = localStorage.getItem('whatsappNumber') || '201015657091';

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">كروت استقبال السيارات قيد العمل</h1>
          <p className="text-sm text-zinc-400">متابعة سير صيانة السيارات بالورشة من الاستلام وحتى التسليم.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition cursor-pointer"
        >
          <PlusCircle size={16} /> فتح كرت استقبال سيارة
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 right-3 flex items-center text-zinc-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="البحث برقم كرت العمل، اسم العميل، أو رقم اللوحة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pr-10 pl-4 text-sm text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Kanban Column Layout */}
      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => {
            const colJobs = jobCards.filter((j) => j.status === col.id);
            return (
              <div key={col.id} className="flex flex-col min-w-[220px] max-w-full space-y-3 bg-zinc-950/30 rounded-xl p-3 border border-zinc-900">
                <div className="flex items-center justify-between px-1">
                  <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono font-medium">{colJobs.length}</span>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto min-h-[300px] max-h-[500px] scrollbar-thin">
                  {colJobs.length === 0 ? (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-zinc-900 text-center text-xs text-zinc-700">
                      لا يوجد كروت
                    </div>
                  ) : (
                    colJobs.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => viewJobDetails(job)}
                        className="glass-card hover:border-zinc-700/60 p-4 rounded-lg cursor-pointer space-y-3 border border-zinc-800/50 hover:bg-zinc-800/10 transition text-right"
                      >
                        <div>
                          <p className="text-xs font-bold text-white tracking-wider font-mono">{job.jobNumber}</p>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{job.customerComplaint}</p>
                        </div>

                        <div className="border-t border-zinc-800 pt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{job.vehicle?.brand} {job.vehicle?.model}</span>
                          <span className="font-mono">{job.vehicle?.plateNumber}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Open Job Card */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl glass-panel rounded-xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">فتح كرت استقبال سيارة جديد</h2>
              <button type="button" onClick={() => { setShowAddModal(false); setShowNewCustomerForm(false); setShowNewVehicleForm(false); setInlineMsg(''); }} className="text-zinc-400 hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            {/* Inline status messages */}
            {inlineMsg && (
              <p className={`text-xs font-semibold px-3 py-2 rounded ${inlineMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{inlineMsg}</p>
            )}
            {errorMsg && <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded">{errorMsg}</p>}

            {/* ─── Customer Section ─── */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
              <label className="text-sm font-bold text-zinc-300 flex items-center gap-2"><User size={15} className="text-primary" /> اختر العميل</label>

              <select
                value={showNewCustomerForm ? '__add_new__' : form.customerId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__add_new__') {
                    setShowNewCustomerForm(true);
                    setShowNewVehicleForm(false);
                    setInlineMsg('');
                  } else {
                    setShowNewCustomerForm(false);
                    setForm({ ...form, customerId: val });
                    setInlineMsg('');
                  }
                }}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="__add_new__" className="text-emerald-400">➕ إضافة عميل جديد</option>
                <option value="">-- اختر العميل الموجود --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} — {c.mobileNumber}</option>
                ))}
              </select>

              {showNewCustomerForm && (
                <form onSubmit={handleCreateCustomerInline} className="space-y-3 border-t border-zinc-800 pt-3">
                  <p className="text-xs text-amber-400 font-semibold">📝 بيانات العميل الجديد</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">الاسم الكامل *</label>
                      <input
                        type="text"
                        required
                        value={newCustomerForm.fullName}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                        placeholder="مثال: أحمد محمد"
                        className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">رقم الجوال *</label>
                      <input
                        type="text"
                        required
                        value={newCustomerForm.mobileNumber}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, mobileNumber: e.target.value })}
                        placeholder="مثال: 0501234567"
                        className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">ملاحظات (اختياري)</label>
                    <input
                      type="text"
                      value={newCustomerForm.notes}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                      placeholder="أي ملاحظة إضافية..."
                      className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={inlineLoading}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-sm font-bold text-white transition disabled:opacity-50 cursor-pointer"
                    >
                      {inlineLoading ? 'جاري الحفظ...' : '✓ حفظ العميل الجديد واختياره'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerForm(false)}
                      className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-bold text-zinc-300 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ─── Vehicle Section ─── */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
              <label className="text-sm font-bold text-zinc-300 flex items-center gap-2"><CarIcon size={15} className="text-primary" /> اختر السيارة</label>

              {!form.customerId && !showNewVehicleForm && (
                <p className="text-xs text-zinc-500 italic">اختر عميلاً أولاً لعرض سياراته.</p>
              )}

              {form.customerId && (
                <select
                  value={showNewVehicleForm ? '__add_new__' : form.vehicleId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__add_new__') {
                      setShowNewVehicleForm(true);
                      setShowNewCustomerForm(false);
                      setInlineMsg('');
                    } else {
                      setShowNewVehicleForm(false);
                      setForm({ ...form, vehicleId: val });
                      setInlineMsg('');
                    }
                  }}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white focus:outline-none focus:border-primary"
                >
                <option value="__add_new__" className="text-emerald-400">➕ إضافة سيارة جديدة</option>
                <option value="">-- اختر السيارة --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.plateNumber}</option>
                ))}
                </select>
              )}

              {showNewVehicleForm && (
                <form onSubmit={handleCreateVehicleInline} className="space-y-3 border-t border-zinc-800 pt-3">
                  <p className="text-xs text-amber-400 font-semibold">🚗 بيانات السيارة الجديدة</p>
                  {!form.customerId && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">⚠️ يجب اختيار العميل أولاً قبل إضافة السيارة</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">المارك (الشركة) *</label>
                      <input
                        type="text"
                        required
                        value={newVehicleForm.brand}
                        onChange={(e) => setNewVehicleForm({ ...newVehicleForm, brand: e.target.value })}
                        placeholder="مثال: Toyota"
                        className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">الموديل *</label>
                      <input
                        type="text"
                        required
                        value={newVehicleForm.model}
                        onChange={(e) => setNewVehicleForm({ ...newVehicleForm, model: e.target.value })}
                        placeholder="مثال: Camry 2022"
                        className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">رقم اللوحة *</label>
                      <input
                        type="text"
                        required
                        value={newVehicleForm.plateNumber}
                        onChange={(e) => setNewVehicleForm({ ...newVehicleForm, plateNumber: e.target.value })}
                        placeholder="مثال: أ ب ت 1234"
                        className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">قراءة العداد (كم)</label>
                      <input
                        type="number"
                        value={newVehicleForm.mileage}
                        onChange={(e) => setNewVehicleForm({ ...newVehicleForm, mileage: e.target.value })}
                        placeholder="مثال: 85000"
                        className="w-full rounded bg-zinc-800 border border-zinc-700 p-2 text-sm text-white focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={inlineLoading || !form.customerId}
                      className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-sm font-bold text-white transition disabled:opacity-50 cursor-pointer"
                    >
                      {inlineLoading ? 'جاري الحفظ...' : '✓ حفظ السيارة الجديدة واختيارها'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewVehicleForm(false)}
                      className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-bold text-zinc-300 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ─── Main Job Details ─── */}
            <form onSubmit={handleAddJob} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">مشكلة السيارة حسب كلام العميل *</label>
                <textarea
                  required
                  value={form.customerComplaint}
                  onChange={(e) => setForm({ ...form, customerComplaint: e.target.value })}
                  placeholder="وصف المشاكل والأعطال التي أبلغ عنها العميل..."
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white h-20 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">التكلفة التقريبية (ريال)</label>
                  <input
                    type="number"
                    value={form.estimatedCost}
                    onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                    placeholder="مثال: 1500"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    الفني المسؤول
                    {user?.role === 'TECHNICIAN' && (
                      <span className="mr-2 text-[10px] text-amber-400 font-normal">(مُعبَّأ تلقائياً من حسابك)</span>
                    )}
                  </label>
                  {user?.role === 'TECHNICIAN' ? (
                    <input
                      type="text"
                      readOnly
                      value={form.technicianName}
                      className="w-full rounded bg-zinc-900/50 border border-zinc-800 p-2 text-sm text-amber-300 font-semibold focus:outline-none cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={form.technicianName}
                      onChange={(e) => setForm({ ...form, technicianName: e.target.value })}
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      <option value="">-- اختر الفني المسؤول --</option>
                      {technicians.map((t: any) => (
                        <option key={t.id} value={`${t.firstName} ${t.lastName}`}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                      <option value="__custom__" disabled>─────────────</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setShowNewCustomerForm(false); setShowNewVehicleForm(false); setInlineMsg(''); }}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover cursor-pointer"
                >
                  حفظ وفتح الكرت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Job Card Detailed Viewer */}
      {showDetailModal && selectedJob && (() => {
        let servicesList: Array<{ name: string; price: number }> = [];
        try {
          if (editForm.additionalServices) {
            servicesList = JSON.parse(editForm.additionalServices);
          }
        } catch (e) {}
        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl glass-panel rounded-xl p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-zinc-500 font-mono">تفاصيل كرت الاستقبال</span>
                <h2 className="text-2xl font-bold text-white mt-0.5 font-mono">{selectedJob.jobNumber}</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Invoice Button Trigger */}
                {(selectedJob.status === 'WAITING_APPROVAL' || selectedJob.status === 'COMPLETED' || selectedJob.status === 'DELIVERED') && (
                  <button
                    onClick={() => { setShowInvoiceModal(true); setShowDetailModal(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded transition cursor-pointer ml-4"
                  >
                    <Receipt size={14} /> {selectedJob.status === 'WAITING_APPROVAL' ? 'معاينة واعتماد الفاتورة' : 'إصدار الفاتورة الإلكترونية'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  ✕ إغلاق
                </button>
              </div>
            </div>

            {/* Quick Summary Row (RTL aligned) */}
            <div className="grid gap-3 sm:grid-cols-3 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-right">
              <div>
                <p className="text-[10px] uppercase font-semibold text-zinc-500">معلومات العميل</p>
                <p className="text-sm font-bold text-white mt-0.5">{selectedJob.customer?.fullName}</p>
                <p className="text-xs text-zinc-400 font-mono">{selectedJob.customer?.mobileNumber}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-zinc-500">معلومات السيارة</p>
                <p className="text-sm font-bold text-white mt-0.5">{selectedJob.vehicle?.brand} {selectedJob.vehicle?.model}</p>
                <p className="text-xs text-zinc-400 font-mono">اللوحة: {selectedJob.vehicle?.plateNumber}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-zinc-500">حالة الكرت الحالية</p>
                <span className="inline-block rounded px-2.5 py-0.5 text-xs font-bold bg-zinc-800 text-zinc-300 mt-1">
                  {statusLabels[selectedJob.status] || selectedJob.status}
                </span>
              </div>
            </div>

            {/* Allowed Transitions Control Panel */}
            <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-3">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">نقل حالة العمل (المسار المسموح)</h3>
              {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
              <div className="flex flex-wrap gap-2">
                {ALLOWED_TRANSITIONS[selectedJob.status]?.map((nextSt) => (
                  <button
                    key={nextSt}
                    onClick={() => handleTransitionStatus(nextSt)}
                    className="px-3.5 py-1.5 bg-primary text-xs font-semibold text-white rounded hover:bg-primary-hover transition cursor-pointer"
                  >
                    تغيير الحالة إلى: {statusLabels[nextSt]}
                  </button>
                )) || (
                  <p className="text-xs text-zinc-500">تم الانتهاء وتسليم المركبة (الحالة النهائية).</p>
                )}
              </div>
            </div>

            {/* Main forms grids */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Fields Updater form */}
              <form onSubmit={handleUpdateJobDetails} className="space-y-4 text-right">
                <h3 className="text-sm font-bold text-zinc-300 border-b border-zinc-800 pb-2">تحديث بيانات النموذج ورقة الاستقبال</h3>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">1. مشكلة السيارة حسب كلام العميل</label>
                  <textarea
                    value={editForm.customerComplaint}
                    onChange={(e) => setEditForm({ ...editForm, customerComplaint: e.target.value })}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">2. الفحص الأولي يعبئه الفني</label>
                    <textarea
                      value={editForm.initialInspection}
                      onChange={(e) => setEditForm({ ...editForm, initialInspection: e.target.value })}
                      placeholder="نتائج الفحص والتشخيص المبدئي للسيارة..."
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white h-20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">3. الأعمال المطلوبة الإصلاح</label>
                    <textarea
                      value={editForm.requiredRepairs}
                      onChange={(e) => setEditForm({ ...editForm, requiredRepairs: e.target.value })}
                      placeholder="الأعمال والقطع وخطوات الإصلاح..."
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white h-20 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">التكلفة التقريبية (ريال)</label>
                    <input
                      type="number"
                      value={editForm.estimatedCost}
                      onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })}
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">موافقة العميل (موافقة الإصلاح)</label>
                    <select
                      value={editForm.approvalStatus}
                      onChange={(e) => setEditForm({ ...editForm, approvalStatus: e.target.value })}
                      className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                    >
                      <option value="PENDING">انتظار موافقة العميل</option>
                      <option value="APPROVED">موافق على الإصلاح</option>
                      <option value="REJECTED">مرفوض من العميل</option>
                    </select>
                  </div>
                </div>

                {/* Additional Services List Builder */}
                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                    <h4 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      ⚙️ تفاصيل الخدمات والقطع الإضافية بالفاتورة
                    </h4>
                    <span className="text-[10px] font-black text-emerald-500 font-mono">
                      إجمالي الخدمات: {servicesList.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0)} ريال
                    </span>
                  </div>

                  {/* Existing services display */}
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {servicesList.length === 0 ? (
                      <p className="text-[10px] text-zinc-500 text-center py-2">لا توجد خدمات إضافية مضافة بعد.</p>
                    ) : (
                      servicesList.map((srv, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-zinc-900/50 p-2 rounded border border-zinc-800 text-xs">
                          <span className="text-zinc-300 font-semibold">{srv.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white font-mono">{srv.price} ريال</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = servicesList.filter((_, i) => i !== idx);
                                setEditForm({ ...editForm, additionalServices: JSON.stringify(updated) });
                              }}
                              className="text-red-400 hover:text-red-300 font-bold px-1.5 cursor-pointer"
                              title="حذف البند"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Service Controls */}
                  <div className="grid grid-cols-3 gap-2 items-end border-t border-zinc-900 pt-3">
                    <div className="col-span-2">
                      <label className="block text-[9px] text-zinc-500 mb-1">اسم الخدمة أو القطعة المضافة</label>
                      <input
                        type="text"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="مثال: فلتر مكيف أصلي"
                        className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 mb-1">السعر (ريال)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                          placeholder="80"
                          className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newServiceName.trim()) return;
                            const priceVal = Number(newServicePrice) || 0;
                            const updated = [...servicesList, { name: newServiceName.trim(), price: priceVal }];
                            setEditForm({ ...editForm, additionalServices: JSON.stringify(updated) });
                            setNewServiceName('');
                            setNewServicePrice('');
                          }}
                          className="rounded bg-emerald-600 hover:bg-emerald-700 px-3.5 text-xs text-white font-bold transition shrink-0 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 space-y-4">
                  <h4 className="text-xs font-bold text-zinc-200 border-b border-zinc-900 pb-2 flex items-center gap-1.5">
                    <User size={14} className="text-primary" /> بيانات الفني المسؤول وتأكيد الاستلام
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">اسم الفني المسؤول</label>
                      <input
                        type="text"
                        value={editForm.technicianName || ''}
                        onChange={(e) => setEditForm({ ...editForm, technicianName: e.target.value })}
                        className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                        placeholder="مثال: المهندس داود"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">تاريخ الدخول</label>
                      <input
                        type="text"
                        disabled
                        value={selectedJob ? new Date(selectedJob.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'long' }) : ''}
                        className="w-full rounded bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-zinc-500 font-bold focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-900">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editForm.isVehiclePhotographed}
                        onChange={(e) => setEditForm({ ...editForm, isVehiclePhotographed: e.target.checked })}
                        className="rounded border-zinc-800 bg-zinc-900 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      تم تصوير السيارة بالكامل قبل بدء العمل بالورشة
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editForm.isDataCompleted}
                        onChange={(e) => setEditForm({ ...editForm, isDataCompleted: e.target.checked })}
                        className="rounded border-zinc-800 bg-zinc-900 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                      />
                      تم تسجيل البيانات كاملة وتدقيقها
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">ملاحظات إضافية</label>
                  <textarea
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                    placeholder="ملاحظات فنية أو إدارية أخرى..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded bg-zinc-800 hover:bg-zinc-700 py-2 text-xs font-bold text-white transition cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </form>

              {/* Photo upload and activity log */}
              <div className="space-y-6 text-right">
                {/* Photo/Video Uploader */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-300 border-b border-zinc-800 pb-2">تأكيد الاستلام وصور/فيديوهات هيكل السيارة</h3>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-zinc-800 cursor-pointer hover:bg-zinc-900/30 transition">
                      <UploadCloud size={20} className="text-zinc-500 mb-1" />
                      <span className="text-[11px] text-zinc-400">
                        {uploadLoading ? 'جاري رفع الملفات...' : 'تم تصوير السيارة قبل العمل (اختر صور/فيديوهات لرفعها)'}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {(!selectedJob.photos || selectedJob.photos.length === 0) ? (
                    <p className="text-xs text-zinc-500">لا توجد صور أو فيديوهات مرفقة لكشف استلام السيارة.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(selectedJob.photos || []).map((p: any) => {
                        const isVid = isVideoFile(p.filePath);
                        return (
                          <div key={p.id} className="relative rounded overflow-hidden border border-zinc-800 h-16 group bg-black flex items-center justify-center">
                            {isVid ? (
                              <video
                                src={`${UPLOADS_BASE_URL}${p.filePath}`}
                                className="w-full h-full object-cover opacity-80"
                                preload="metadata"
                                muted
                              />
                            ) : (
                              <img
                                src={`${UPLOADS_BASE_URL}${p.filePath}`}
                                alt="كشف حالة الهيكل"
                                className="w-full h-full object-cover"
                              />
                            )}
                            {isVid && (
                              <div className="absolute top-1 right-1 bg-black/75 rounded px-1 text-[8px] text-white font-bold font-sans">
                                VIDEO
                              </div>
                            )}
                            <a
                              href={`${UPLOADS_BASE_URL}${p.filePath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-semibold transition"
                            >
                              <Eye size={12} className="ml-1" /> عرض
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Receipts Checkbox Indicator - Only display after media is uploaded */}
                  {selectedJob.photos && selectedJob.photos.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 text-xs text-emerald-400 font-semibold bg-emerald-500/5 p-2 rounded border border-emerald-500/10">
                      <CheckCircle size={14} />
                      <span>تم تسجيل البيانات كاملة وتوثيق حالة المركبة بنجاح</span>
                    </div>
                  )}
                </div>

                {/* Transition Log Timeline */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-zinc-300 border-b border-zinc-800 pb-2">سجل حركات كرت استقبال السيارة</h3>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                    {(!selectedJob.activities || selectedJob.activities.length === 0) ? (
                      <p className="text-xs text-zinc-500">لا توجد سجلات حركات مسجلة.</p>
                    ) : (
                      (selectedJob.activities || []).map((act: any) => (
                        <div key={act.id} className="p-2.5 bg-zinc-900/40 rounded border border-zinc-800/60 flex items-start gap-2 text-right">
                          <FileText size={14} className="text-zinc-500 mt-0.5 shrink-0 ml-1" />
                          <div>
                            <p className="text-[11px] text-zinc-300 font-medium">{act.action}</p>
                            <p className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                              بواسطة: {act.user?.firstName} ({act.user?.role === 'ADMIN' ? 'مدير' : act.user?.role === 'RECEPTION' ? 'استقبال' : 'فني'}) — {new Date(act.createdAt).toLocaleString('ar-EG')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal: Printable Electronic Invoice & WhatsApp QR sharing */}
      {showInvoiceModal && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-panel rounded-2xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header Toolbar */}
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 no-print">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Receipt size={22} className="text-emerald-500" /> الفاتورة الإلكترونية الصادرة
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadInvoiceAsImage}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white rounded cursor-pointer transition shadow-sm"
                >
                  📥 تحميل كصورة
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded cursor-pointer transition"
                >
                  <Printer size={14} /> طباعة الفاتورة
                </button>
                <button
                  onClick={() => { setShowInvoiceModal(false); viewJobDetails(selectedJob); }}
                  className="text-zinc-400 hover:text-white px-2 py-1 text-sm"
                >
                  ✕ إغلاق
                </button>
              </div>
            </div>

            {/* Printable Invoice Page */}
            <div className="bg-white text-zinc-900 p-8 rounded-xl print:p-0 print:bg-white text-right" id="printable-invoice-layout" style={{ fontFamily: 'Cairo, sans-serif' }}>
              
              {/* Header block resembling the navy blue banner */}
              <div className="bg-[#0b192c] text-white p-4 rounded-t-lg flex justify-between items-center relative" style={{ borderBottom: '6px solid #e11d48' }}>
                <div className="text-right">
                  <h1 className="text-xl font-black tracking-wide text-white">نموذج استقبال سيارة في الورشة</h1>
                  <p className="text-[10px] text-zinc-300 font-semibold mt-1">بطاقة تشخيص وإصلاح المركبات المعتمدة</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-zinc-900 font-black tracking-wider text-xl font-mono">Au<span className="text-red-600">2</span>Ka</span>
                </div>
              </div>

              <div className="p-6 border-x-2 border-b-2 border-zinc-100 rounded-b-lg space-y-6">
                
                {/* 1. معلومات العميل */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    معلومات العميل
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-xs px-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-zinc-500 shrink-0">اسم العميل:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold">{selectedJob.customer?.fullName}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-zinc-500 shrink-0">رقم الجوال:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold font-mono">{selectedJob.customer?.mobileNumber}</span>
                    </div>
                  </div>
                </div>

                {/* 2. معلومات السيارة */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    معلومات السيارة
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-xs px-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-zinc-500 shrink-0">نوع السيارة:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold">{selectedJob.vehicle?.brand}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-zinc-500 shrink-0">الموديل:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold">{selectedJob.vehicle?.model}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-xs px-2">
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-zinc-500 shrink-0">رقم اللوحة:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold font-mono">{selectedJob.vehicle?.plateNumber}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-zinc-500 shrink-0">العداد الممشى:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold font-mono">{selectedJob.vehicle?.mileage} كم</span>
                    </div>
                  </div>
                </div>

                {/* 3. مشكلة السيارة حسب كلام العميل */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    مشكلة السيارة حسب كلام العميل
                  </div>
                  <div className="border border-zinc-200 rounded p-3 text-xs bg-zinc-50 min-h-[50px] leading-relaxed text-zinc-700 whitespace-pre-wrap"
                       style={{ 
                         backgroundImage: 'linear-gradient(rgba(0,0,0,0) 95%, #e2e8f0 95%)', 
                         backgroundSize: '100% 24px',
                         lineHeight: '24px'
                       }}>
                    {selectedJob.customerComplaint}
                  </div>
                </div>

                {/* 4. الفحص الأولي يعبئه الفني */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    الفحص الأولي يعبئه الفني
                  </div>
                  <div className="border border-zinc-200 rounded p-3 text-xs bg-zinc-50 min-h-[50px] leading-relaxed text-zinc-700 whitespace-pre-wrap"
                       style={{ 
                         backgroundImage: 'linear-gradient(rgba(0,0,0,0) 95%, #e2e8f0 95%)', 
                         backgroundSize: '100% 24px',
                         lineHeight: '24px'
                       }}>
                    {selectedJob.initialInspection || 'لم يتم البدء بالفحص المبدئي.'}
                  </div>
                </div>

                {/* 5. الأعمال المطلوبة الإصلاح */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    الأعمال المطلوبة الإصلاح
                  </div>
                  <div className="border border-zinc-200 rounded p-3 text-xs bg-zinc-50 min-h-[50px] leading-relaxed text-zinc-700 whitespace-pre-wrap"
                       style={{ 
                         backgroundImage: 'linear-gradient(rgba(0,0,0,0) 95%, #e2e8f0 95%)', 
                         backgroundSize: '100% 24px',
                         lineHeight: '24px'
                       }}>
                    {selectedJob.requiredRepairs || 'لم يتم تسجيل صيانة مطلوبة.'}
                  </div>
                </div>

                {/* 5.5. تفصيل الخدمات والقطع المضافة */}
                {(() => {
                  let invoiceServices: Array<{ name: string; price: number }> = [];
                  try {
                    if (selectedJob.additionalServices) {
                      invoiceServices = JSON.parse(selectedJob.additionalServices);
                    }
                  } catch (e) {}

                  if (invoiceServices.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                        تفصيل الخدمات والقطع الإضافية
                      </div>
                      <div className="border border-zinc-200 rounded overflow-hidden">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200 font-bold text-zinc-600">
                              <th className="p-2.5">الخدمة / القطعة</th>
                              <th className="p-2.5 w-32 text-left">التكلفة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoiceServices.map((srv, idx) => (
                              <tr key={idx} className="border-b border-zinc-150 hover:bg-zinc-50/55">
                                <td className="p-2.5 text-zinc-700 font-medium">{srv.name}</td>
                                <td className="p-2.5 text-zinc-900 font-bold font-mono text-left">{srv.price} ريال</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* 6. التكلفة والموافقة */}
                {(() => {
                  let invoiceServices: Array<{ name: string; price: number }> = [];
                  try {
                    if (selectedJob.additionalServices) {
                      invoiceServices = JSON.parse(selectedJob.additionalServices);
                    }
                  } catch (e) {}
                  
                  const servicesTotal = invoiceServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                  const baseCost = Number(selectedJob.estimatedCost) || 0;
                  const grandTotal = baseCost + servicesTotal;

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                        التكلفة والموافقة الكلية
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-xs px-2 items-start">
                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline border-b border-dashed border-zinc-200 pb-1">
                            <span className="text-zinc-500 font-semibold">التكلفة الأساسية:</span>
                            <span className="text-zinc-800 font-bold font-mono">{baseCost > 0 ? `${baseCost} ريال` : 'غير محدد'}</span>
                          </div>
                          {servicesTotal > 0 && (
                            <div className="flex justify-between items-baseline border-b border-dashed border-zinc-200 pb-1">
                              <span className="text-zinc-500 font-semibold">مجموع الخدمات الإضافية:</span>
                              <span className="text-zinc-800 font-bold font-mono">{servicesTotal} ريال</span>
                            </div>
                          )}
                          <div className="flex justify-between items-baseline pt-1">
                            <span className="text-zinc-900 font-black">المجموع الإجمالي الكلي:</span>
                            <span className="text-emerald-600 font-black text-sm font-mono">{grandTotal} ريال</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 justify-center text-zinc-700 font-semibold pt-1">
                          <div className="flex items-center gap-4">
                            <span className="text-zinc-500">موافقة العميل:</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-4 h-4 border border-zinc-400 rounded flex items-center justify-center text-[10px] ${selectedJob.approvalStatus === 'APPROVED' ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : ''}`}>
                                {selectedJob.approvalStatus === 'APPROVED' ? '✓' : ''}
                              </span>
                              <span>موافق على الإصلاح</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-4 h-4 border border-zinc-400 rounded flex items-center justify-center text-[10px] ${selectedJob.approvalStatus === 'REJECTED' ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : ''}`}>
                                {selectedJob.approvalStatus === 'REJECTED' ? '✓' : ''}
                              </span>
                              <span>مرفوض</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 7. بيانات الفني والتاريخ */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    بيانات الفني والتاريخ
                  </div>
                  <div className="flex justify-between items-center text-xs px-2 gap-4">
                    <div className="flex items-baseline gap-1 flex-1">
                      <span className="font-semibold text-zinc-500 shrink-0">اسم الفني المسؤول:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold">{selectedJob.technicianName || '.......................'}</span>
                    </div>
                    <div className="flex items-baseline gap-1 flex-1">
                      <span className="font-semibold text-zinc-500 shrink-0">تاريخ الدخول:</span>
                      <span className="border-b border-dashed border-zinc-400 flex-1 pb-0.5 text-zinc-800 font-bold font-mono">{new Date(selectedJob.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="w-5 h-5 border border-zinc-300 rounded bg-white"></span>
                      <span className="w-5 h-5 border border-zinc-300 rounded bg-white"></span>
                      <span className="w-5 h-5 border border-zinc-300 rounded bg-white"></span>
                    </div>
                  </div>
                </div>

                {/* 8. ملاحظات إضافية */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#dbeafe] p-2 rounded-r-md border-r-4 border-[#1e3a8a] text-[#1e3a8a] font-bold text-xs">
                    ملاحظات إضافية
                  </div>
                  <div className="border border-zinc-200 rounded p-3 text-xs bg-zinc-50 min-h-[50px] leading-relaxed text-zinc-700 whitespace-pre-wrap"
                       style={{ 
                         backgroundImage: 'linear-gradient(rgba(0,0,0,0) 95%, #e2e8f0 95%)', 
                         backgroundSize: '100% 24px',
                         lineHeight: '24px'
                       }}>
                    {selectedJob.notes || 'لم يتم تسجيل ملاحظات إضافية.'}
                  </div>
                </div>

                {/* 9. تأكيد الاستلام (Footer) */}
                <div className="bg-[#0b192c] text-white p-3.5 rounded-lg flex justify-between items-center text-xs">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-4 h-4 border border-white/40 rounded flex items-center justify-center text-[10px] ${selectedJob.isVehiclePhotographed ? 'bg-primary text-white border-primary' : ''}`}>
                        {selectedJob.isVehiclePhotographed ? '✓' : ''}
                      </span>
                      <span>تم تصوير السيارة قبل العمل</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-4 h-4 border border-white/40 rounded flex items-center justify-center text-[10px] ${localStorage.getItem(`job_data_complete_${selectedJob.id}`) === 'true' ? 'bg-primary text-white border-primary' : ''}`}>
                        {localStorage.getItem(`job_data_complete_${selectedJob.id}`) === 'true' ? '✓' : ''}
                      </span>
                      <span>تم تسجيل البيانات كاملة</span>
                    </div>
                  </div>
                  <div className="font-bold text-zinc-200">:تأكيد الاستلام</div>
                </div>

                {/* WhatsApp QR sharing & barcode - Only displayed on screen / no-print */}
                <div className="border-t border-zinc-100 pt-6 mt-6 no-print">
                  <div className="bg-zinc-50/80 rounded-xl p-5 border border-zinc-100 flex flex-col md:flex-row items-center gap-6">
                    
                    {/* QR Code Graphic Display */}
                    <div 
                      onClick={() => { setShowZoomedQR(true); markQRAsScanned(); }} 
                      className="cursor-zoom-in relative group bg-white p-3 rounded-lg border border-zinc-200/80 shadow-sm shrink-0 transition-transform hover:scale-105"
                      title="تكبير الباركود ملء الشاشة وتوثيق الموافقة"
                    >
                      <img
                        src={getQRCodeUrl()}
                        alt="WhatsApp QR Code"
                        className="w-28 h-28"
                      />
                      <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-white font-bold transition rounded-lg">
                        <span>تكبير الكود 🔍</span>
                        <span className="text-[8px] mt-1 text-emerald-300">لتوثيق الموافقة</span>
                      </div>
                    </div>

                    {/* Dynamic Instructions & Mandatory Step Status */}
                    <div className="flex-1 text-right space-y-2">
                      <div className="flex items-center gap-2 text-sm font-extrabold text-zinc-800">
                        <span className={`w-2.5 h-2.5 rounded-full ${qrScanned ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></span>
                        توثيق موافقة العميل (خطوة إجبارية)
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        يجب مسح هذا الرمز بكاميرا الجوال أو تكبيره بالضغط عليه ليقوم العميل بإرسال رسالة الموافقة الرسمية عبر الواتساب، وهي خطوة إجبارية لاعتماد الفاتورة والبدء في أعمال الإصلاح.
                      </p>

                      {/* Approval Tracking Indicator */}
                      <div className="pt-1.5">
                        {qrScanned ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-full">
                            <span className="text-emerald-500 text-[13px]">✓</span> تم عرض وتوثيق كود موافقة العميل بنجاح
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> بانتظار عرض/تكبير الرمز لتوثيق الموافقة
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* Actions Bar sharing directly on WhatsApp */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center no-print pt-4 border-t border-zinc-800">
              <div className="text-right text-xs text-zinc-400">
                <span>💡 يمكنك تحميل صورة الكارت الكاملة وإرسالها يدويًا كمستند أو صورة للعميل على الواتساب.</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadInvoiceAsImage}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-lg transition cursor-pointer shadow-sm"
                >
                  📥 تحميل الكارت كصورة
                </button>
                <a
                  href={getWhatsAppShareLink()}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markQRAsScanned()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-lg transition cursor-pointer shadow-sm"
                >
                  <Share2 size={14} /> إرسال عبر واتساب (+{activeWhatsappNumber})
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fullscreen Zoomed QR Code */}
      {showZoomedQR && selectedJob && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-6 relative">
            <button
              onClick={() => setShowZoomedQR(false)}
              className="absolute top-4 left-4 text-zinc-400 hover:text-white text-sm font-bold cursor-pointer"
            >
              ✕ إغلاق
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">رمز الاستجابة السريعة (QR Code)</h3>
              <p className="text-xs text-zinc-400">امسح الكود بكاميرا الجوال للموافقة الفورية والارتباط بالواتساب</p>
            </div>
            
            <div className="bg-white p-6 rounded-xl inline-block shadow-2xl mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(getWhatsAppShareLink())}`}
                alt="Zoomed WhatsApp QR Code"
                className="w-80 h-80 mx-auto"
              />
            </div>

            <div className="bg-zinc-900/60 p-3.5 rounded-lg border border-zinc-800 text-xs text-right space-y-1.5 text-zinc-300">
              <p>• رقم الكرت: <span className="font-bold text-white font-mono">{selectedJob.jobNumber}</span></p>
              <p>• العميل: <span className="font-bold text-white">{selectedJob.customer?.fullName}</span></p>
              <p>• رقم الواتساب المستقبل: <span className="font-bold text-emerald-400 font-mono">+{activeWhatsappNumber}</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
