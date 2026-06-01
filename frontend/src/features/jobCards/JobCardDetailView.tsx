import React, { useState } from 'react';
import { User, Car, AlertCircle, Wrench, Clock, Receipt, Image as ImageIcon, FileText, CheckCircle2, ChevronRight, Download, ZoomIn } from 'lucide-react';
import { UPLOADS_BASE_URL } from '../../lib/api';

interface JobCardDetailViewProps {
  job: any;
  onClose: () => void;
}

export function JobCardDetailView({ job, onClose }: JobCardDetailViewProps) {
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    RECEIVED: 'تم الاستلام',
    INSPECTION: 'قيد الفحص',
    WAITING_APPROVAL: 'انتظار الموافقة',
    IN_PROGRESS: 'تحت الإصلاح',
    COMPLETED: 'تم الإصلاح',
    DELIVERED: 'تم التسليم'
  };

  const approvalStatusLabels: Record<string, string> = {
    PENDING: 'انتظار الاعتماد',
    APPROVED: 'تمت الموافقة',
    REJECTED: 'مرفوض'
  };

  function isVideoFile(filePath: string) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  // Parse additional services
  let servicesList: Array<{ name: string; price: number }> = [];
  try {
    if (job.additionalServices) {
      servicesList = JSON.parse(job.additionalServices);
    }
  } catch (e) {}

  const baseCost = Number(job.estimatedCost) || 0;
  const servicesTotal = servicesList.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const grandTotal = baseCost + servicesTotal;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950 text-zinc-100 text-right" dir="rtl">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition text-zinc-400 hover:text-white cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
          <div>
            <span className="text-[10px] text-zinc-500 font-mono">تفاصيل كرت العمل</span>
            <h1 className="text-lg font-black text-white font-mono">{job.jobNumber}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
            job.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            job.status === 'WAITING_APPROVAL' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
            'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}>
            {statusLabels[job.status] || job.status}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* Customer & Vehicle Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Customer Info Card */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <User className="text-primary" size={18} /> بيانات العميل
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs text-zinc-500">الاسم الكامل</span>
                <span className="font-semibold text-zinc-200 mt-1 block">{job.customer?.fullName}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">رقم الهاتف</span>
                <span className="font-semibold text-zinc-200 mt-1 block font-mono">+{job.customer?.mobileNumber}</span>
              </div>
            </div>
            {job.customer?.notes && (
              <div className="pt-2 border-t border-zinc-900">
                <span className="block text-xs text-zinc-500">ملاحظات العميل</span>
                <p className="text-xs text-zinc-400 mt-1">{job.customer.notes}</p>
              </div>
            )}
          </div>

          {/* Vehicle Info Card */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Car className="text-accent" size={18} /> بيانات السيارة
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="block text-xs text-zinc-500">الماركة / الموديل</span>
                <span className="font-semibold text-zinc-200 mt-1 block">{job.vehicle?.brand} {job.vehicle?.model}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">رقم اللوحة</span>
                <span className="font-semibold text-zinc-200 mt-1 block font-mono">{job.vehicle?.plateNumber}</span>
              </div>
              <div>
                <span className="block text-xs text-zinc-500">قراءة العداد</span>
                <span className="font-semibold text-zinc-200 mt-1 block font-mono">{job.vehicle?.mileage} كم</span>
              </div>
            </div>
          </div>
        </div>

        {/* Complaints and Inspections */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Customer Complaint */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <AlertCircle className="text-red-500" size={16} /> شكوى وملاحظات العميل
            </h4>
            <p className="text-sm text-zinc-300 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/60 leading-relaxed min-h-[100px]">
              {job.customerComplaint}
            </p>
          </div>

          {/* Initial Inspection */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Wrench className="text-blue-400" size={16} /> الفحص والتشخيص الفني المبدئي
            </h4>
            <p className="text-sm text-zinc-300 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/60 leading-relaxed min-h-[100px]">
              {job.initialInspection || 'لم يتم تسجيل فحص مبدئي بعد.'}
            </p>
          </div>

          {/* Required Repairs */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Clock className="text-yellow-500" size={16} /> الأعمال المطلوبة للإصلاح
            </h4>
            <p className="text-sm text-zinc-300 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/60 leading-relaxed min-h-[100px]">
              {job.requiredRepairs || 'لم يتم تحديد إصلاحات مطلوبة بعد.'}
            </p>
          </div>
        </div>

        {/* Financials & Approval */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Financials Breakdown */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="text-emerald-500" size={18} /> التكلفة الإجمالية وتفاصيل الفاتورة
            </h3>
            <div className="divide-y divide-zinc-900">
              <div className="flex justify-between py-2.5 text-sm">
                <span className="text-zinc-400">التكلفة الأساسية (المقدرة):</span>
                <span className="font-bold text-white font-mono">{baseCost} ريال</span>
              </div>
              {servicesList.map((srv, idx) => (
                <div key={idx} className="flex justify-between py-2.5 text-sm">
                  <span className="text-zinc-400">{srv.name}:</span>
                  <span className="font-semibold text-zinc-300 font-mono">+{srv.price} ريال</span>
                </div>
              ))}
              <div className="flex justify-between py-3 text-base border-t border-zinc-800 font-black">
                <span className="text-zinc-200">المجموع النهائي:</span>
                <span className="text-emerald-400 font-mono">{grandTotal} ريال</span>
              </div>
            </div>
          </div>

          {/* Approval & Tech Info */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
            <h3 className="text-base font-bold text-white">حالة الاعتماد والفني المسؤول</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-800">
                <span className="text-zinc-400">قرار اعتماد العميل:</span>
                <span className={`px-2.5 py-1 rounded text-xs font-extrabold ${
                  job.approvalStatus === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                  job.approvalStatus === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {approvalStatusLabels[job.approvalStatus] || job.approvalStatus}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-800">
                <span className="text-zinc-400">الفني المسؤول:</span>
                <span className="font-bold text-white">{job.technicianName || 'غير محدد بعد'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Photos & Activity Timeline grid */}
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Photos/Videos Gallery */}
          <div className="md:col-span-2 glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ImageIcon className="text-purple-400" size={18} /> معرض الصور والتوثيق المرئي
            </h3>
            
            {(!job.photos || job.photos.length === 0) ? (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-900 rounded-xl">
                <ImageIcon className="text-zinc-700 mb-2" size={32} />
                <p className="text-xs text-zinc-600">لا توجد صور أو فيديوهات مرفقة بهذا الكرت.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {job.photos.map((photo: any) => {
                  const isVid = isVideoFile(photo.filePath);
                  const fullUrl = `${UPLOADS_BASE_URL}${photo.filePath}`;
                  return (
                    <div 
                      key={photo.id} 
                      className="group relative rounded-xl overflow-hidden border border-zinc-800 aspect-video bg-black flex items-center justify-center cursor-pointer hover:border-zinc-700/60"
                      onClick={() => setActivePhoto(fullUrl)}
                    >
                      {isVid ? (
                        <video
                          src={fullUrl}
                          className="w-full h-full object-cover opacity-80"
                          preload="metadata"
                          muted
                        />
                      ) : (
                        <img
                          src={fullUrl}
                          alt="توثيق المركبة"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition duration-200">
                        <ZoomIn size={16} className="text-white" />
                        <span className="text-[10px] text-white font-bold">معاينة</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timeline of Activity */}
          <div className="glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="text-cyan-400" size={18} /> سجل وتاريخ كرت الاستقبال
            </h3>
            
            <div className="relative pl-2 border-r border-zinc-900 space-y-6">
              {/* Card Created default node */}
              <div className="relative pr-6">
                <span className="absolute -right-[7px] top-1 w-3 h-3 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center"></span>
                <span className="text-[10px] text-zinc-500 font-mono">{new Date(job.createdAt).toLocaleString('ar-EG')}</span>
                <p className="text-xs font-semibold text-zinc-300 mt-0.5">فتح وإنشاء كرت استقبال السيارة</p>
              </div>

              {/* Dynamic Activities */}
              {(job.activities || []).map((act: any) => (
                <div key={act.id} className="relative pr-6">
                  <span className="absolute -right-[7px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-zinc-950 flex items-center justify-center"></span>
                  <span className="text-[10px] text-zinc-500 font-mono">{new Date(act.createdAt).toLocaleString('ar-EG')}</span>
                  <p className="text-xs font-semibold text-zinc-300 mt-0.5">{act.action}</p>
                  <span className="text-[9px] text-zinc-500 mt-0.5 block">بواسطة: {act.user?.firstName} {act.user?.lastName}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>

      {/* Lightbox / Zoomed Preview Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
          <button
            onClick={() => setActivePhoto(null)}
            className="absolute top-4 left-4 p-2 bg-zinc-900 text-white rounded-lg cursor-pointer"
          >
            ✕ إغلاق المعاينة
          </button>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden flex items-center justify-center">
            {isVideoFile(activePhoto) ? (
              <video
                src={activePhoto}
                controls
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                autoPlay
              />
            ) : (
              <img
                src={activePhoto}
                alt="معاينة كاملة"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>

          <a
            href={activePhoto}
            target="_blank"
            download
            className="absolute bottom-4 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white px-5 py-2.5 rounded-lg flex items-center gap-2 transition"
          >
            <Download size={14} /> تحميل الملف الأصلي
          </a>
        </div>
      )}
    </div>
  );
}
