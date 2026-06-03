import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { FileText, Users, Car, Search, Download, Printer, Filter, ChevronLeft, ChevronRight, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { JobCardDetailView } from '../jobCards/JobCardDetailView';
import { useTranslation } from '../../store/LanguageContext';

export function ReportsView() {
  const { lang, t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'jobCards' | 'customers' | 'vehicles'>('jobCards');
  
  // Modals / Details state
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const isRtl = lang === 'ar';

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-white">{t('reportsTitle')}</h1>
        <p className="text-sm text-zinc-400">{t('reportsSubtitle')}</p>
      </div>

      {/* Sub tabs Navigation */}
      <div className="flex border-b border-zinc-900 pb-px gap-4">
        <button
          onClick={() => setActiveSubTab('jobCards')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
            activeSubTab === 'jobCards'
              ? 'border-primary text-white bg-primary/5'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <FileText size={14} /> {t('jobCardsReport')}
        </button>
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
            activeSubTab === 'customers'
              ? 'border-primary text-white bg-primary/5'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <Users size={14} /> {t('customersReport')}
        </button>
        <button
          onClick={() => setActiveSubTab('vehicles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 cursor-pointer ${
            activeSubTab === 'vehicles'
              ? 'border-primary text-white bg-primary/5'
              : 'border-transparent text-zinc-500 hover:text-white'
          }`}
        >
          <Car size={14} /> {t('vehiclesReport')}
        </button>
      </div>

      {/* Sub tabs contents */}
      {activeSubTab === 'jobCards' && <JobCardsReportTab onViewJob={setSelectedJob} />}
      {activeSubTab === 'customers' && <CustomersReportTab onViewJob={setSelectedJob} />}
      {activeSubTab === 'vehicles' && <VehiclesReportTab onViewJob={setSelectedJob} />}

      {/* Fullscreen detail modal overlay */}
      {selectedJob && (
        <JobCardDetailView
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   1. JOB CARDS REPORT VIEW
   ========================================================================= */
interface SubReportProps {
  onViewJob: (job: any) => void;
}

function JobCardsReportTab({ onViewJob }: SubReportProps) {
  const { lang, t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showWhatsAppAlert, setShowWhatsAppAlert] = useState(false);

  // Filters
  const [status, setStatus] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [technician, setTechnician] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const statusLabels: Record<string, string> = {
    RECEIVED: t('status_RECEIVED'),
    INSPECTION: t('status_INSPECTION'),
    WAITING_APPROVAL: t('status_WAITING_APPROVAL'),
    IN_PROGRESS: t('status_IN_PROGRESS'),
    COMPLETED: t('status_COMPLETED'),
    DELIVERED: t('status_DELIVERED')
  };

  const approvalStatusLabels: Record<string, string> = {
    PENDING: t('approval_PENDING'),
    APPROVED: t('approval_APPROVED'),
    REJECTED: t('approval_REJECTED')
  };

  // Debouncing search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    loadJobCards();
  }, [debouncedSearch, status, approvalStatus, technician, startDate, endDate, pagination.page, sortBy, sortOrder]);

  async function loadJobCards() {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: debouncedSearch,
        status,
        approvalStatus,
        technicianName: technician,
        startDate,
        endDate,
        sortBy,
        sortOrder
      });

      const res = await api.get(`/reports/job-cards?${queryParams.toString()}`);
      setData(res.data.data.jobCards || []);
      setPagination(res.data.data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Export Excel and Share via WhatsApp
  function handleExportExcelAndWhatsApp() {
    if (data.length === 0) return;
    
    const title = lang === 'ar' ? 'تقرير كروت استقبال وصيانة السيارات - Au2Ka CRM' : 'Job Cards Intake & Maintenance Report - Au2Ka CRM';
    const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
    
    const rowsHtml = data.map((job) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${job.jobNumber}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${job.customer?.fullName || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">+${job.customer?.mobileNumber || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${job.vehicle?.brand || ''} ${job.vehicle?.model || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${job.vehicle?.plateNumber || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${job.estimatedCost || '0'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${approvalStatusLabels[job.approvalStatus] || job.approvalStatus}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${statusLabels[job.status] || job.status}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${new Date(job.entryDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</td>
      </tr>
    `).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; }
          th { background-color: #e11d48; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: ${lang === 'ar' ? 'right' : 'left'}; }
          .title-row { font-size: 16px; font-weight: bold; color: #0b192c; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="9" class="title-row">${title}</td></tr>
          <tr><td colspan="9">${lang === 'ar' ? 'تاريخ استخراج التقرير:' : 'Export Date:'} ${dateStr}</td></tr>
          <tr></tr>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'رقم الكرت' : 'Card Number'}</th>
              <th>${lang === 'ar' ? 'اسم العميل' : 'Customer Name'}</th>
              <th>${lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</th>
              <th>${lang === 'ar' ? 'السيارة' : 'Vehicle'}</th>
              <th>${lang === 'ar' ? 'رقم اللوحة' : 'Plate Number'}</th>
              <th>${lang === 'ar' ? 'التكلفة (ريال)' : 'Cost (SAR)'}</th>
              <th>${lang === 'ar' ? 'حالة الاعتماد' : 'Approval Status'}</th>
              <th>${lang === 'ar' ? 'حالة العمل' : 'Work Status'}</th>
              <th>${lang === 'ar' ? 'تاريخ الدخول' : 'Entry Date'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reports-job-cards-${new Date().toISOString().slice(0, 10)}.xls`);
    link.click();
    
    setShowWhatsAppAlert(true);
  }

  const isRtl = lang === 'ar';

  return (
    <div className="space-y-4">
      {/* Filter panel */}
      <div className="glass-panel rounded-xl p-5 border border-zinc-900 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
          <Filter size={16} className="text-primary" /> {t('advancedFilter')}
        </div>
        
        <div className={`grid gap-4 grid-cols-2 md:grid-cols-5 ${isRtl ? 'text-right' : 'text-left'}`}>
          {/* Search */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] text-zinc-600 mb-1 font-semibold">{lang === 'ar' ? 'بحث شامل' : 'Search'}</label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('searchJobCards')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white placeholder-zinc-600 focus:outline-none ${isRtl ? 'pr-8 pl-2' : 'pl-8 pr-2'}`}
              />
              <Search className={`absolute top-2.5 text-zinc-600 ${isRtl ? 'right-2.5' : 'left-2.5'}`} size={14} />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] text-zinc-600 mb-1 font-semibold">{lang === 'ar' ? 'حالة الكرت' : 'Card Status'}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
            >
              <option value="">{t('allStatuses')}</option>
              {Object.entries(statusLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Approval */}
          <div>
            <label className="block text-[10px] text-zinc-600 mb-1 font-semibold">{t('jobApprovalSelect')}</label>
            <select
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value)}
              className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
            >
              <option value="">{t('allApprovals')}</option>
              {Object.entries(approvalStatusLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-[10px] text-zinc-600 mb-1 font-semibold">{t('startDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-600 mb-1 font-semibold">{t('endDate')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-zinc-900">
          <div className="flex gap-2">
            <button
              onClick={handleExportExcelAndWhatsApp}
              disabled={data.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-700 hover:text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-40 transition shadow-sm"
            >
              {t('exportExcel')}
            </button>
            <button
              onClick={() => window.print()}
              disabled={data.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white rounded text-xs font-semibold cursor-pointer transition"
            >
              <Printer size={12} /> {t('printList')}
            </button>
          </div>
          
          <button
            onClick={() => {
              setSearch('');
              setStatus('');
              setApprovalStatus('');
              setStartDate('');
              setEndDate('');
              setTechnician('');
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 font-bold cursor-pointer"
          >
            {t('resetFilters')}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel rounded-xl border border-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-zinc-900/60 text-zinc-400 font-bold border-b border-zinc-800">
              <tr>
                <th className="p-3">{t('zoomedCardNum')}</th>
                <th className="p-3">{t('zoomedCust')}</th>
                <th className="p-3">{t('vehicleInfo')}</th>
                <th className="p-3">{t('plateNumber')}</th>
                <th className="p-3">{t('cost')}</th>
                <th className="p-3">{t('approvalDecision')}</th>
                <th className="p-3">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="p-3">{t('entryDate')}</th>
                <th className="p-3 text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-16"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-24"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-12"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-14"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-16"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                    <td className="p-3"><div className="h-7 bg-zinc-900 rounded w-10 mx-auto"></div></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-600 font-bold">
                    <AlertCircle size={24} className="mx-auto mb-2 text-zinc-700" />
                    {t('noReportMatches')}
                  </td>
                </tr>
              ) : (
                data.map((job) => (
                  <tr key={job.id} className="hover:bg-zinc-900/30 transition">
                    <td className="p-3 font-semibold font-mono text-zinc-400">{job.jobNumber}</td>
                    <td className="p-3 font-bold text-white">{job.customer?.fullName}</td>
                    <td className="p-3 text-zinc-400">{job.vehicle?.brand} {job.vehicle?.model}</td>
                    <td className="p-3 text-zinc-500 font-mono">{job.vehicle?.plateNumber}</td>
                    <td className="p-3 font-bold text-zinc-300 font-mono">
                      {Number(job.estimatedCost) || 0}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.approvalStatus === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                        job.approvalStatus === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {approvalStatusLabels[job.approvalStatus] || job.approvalStatus}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                        job.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400' :
                        job.status === 'WAITING_APPROVAL' ? 'bg-yellow-500/10 text-yellow-450' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {statusLabels[job.status] || job.status}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-400 font-mono">{new Date(job.entryDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onViewJob(job)}
                        className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
                        title={lang === 'ar' ? 'عرض كامل كرت العمل' : 'View Full Job Card'}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination block */}
        <div className="p-3.5 bg-zinc-950 border-t border-zinc-900 flex justify-between items-center">
          <div className="text-zinc-500 text-[11px] font-semibold">
            {t('showingItems').replace('{count}', data.length.toString()).replace('{total}', pagination.total.toString())}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} className={isRtl ? '' : 'rotate-180'} />
            </button>
            <span className="text-xs text-zinc-400 font-bold font-mono">
              {lang === 'ar' ? `صفحة ${pagination.page} من ${pagination.pages}` : `Page ${pagination.page} of ${pagination.pages}`}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
              disabled={pagination.page >= pagination.pages}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} className={isRtl ? '' : 'rotate-180'} />
            </button>
          </div>
        </div>

      </div>

      {/* Alert Modal for WhatsApp Excel Sharing */}
      {showWhatsAppAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 no-print text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-3xl">📊</span>
              <h3 className="text-lg font-black text-white">{t('excelDownloaded')}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                {t('excelNextSteps')}
              </p>
            </div>

            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs text-right space-y-2 text-zinc-300">
              <p>• {t('excelFileName')}: <span className="font-mono text-emerald-400 font-bold">{`reports-job-cards-${new Date().toISOString().slice(0, 10)}.xls`}</span></p>
              <p>• {t('excelInstructions')}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowWhatsAppAlert(false)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {t('cancel')}
              </button>
              <a
                href={`https://api.whatsapp.com/send?phone=${localStorage.getItem('whatsappNumber') || '201015657091'}&text=${encodeURIComponent(lang === 'ar' ? 'السلام عليكم، مرفق لكم تقرير كروت صيانة المركبات الصادر من نظام Au2Ka CRM 🚗' : 'Hello, attached is the vehicle maintenance job cards report generated by Au2Ka CRM 🚗')}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppAlert(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {t('openWhatsAppChat')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   2. CUSTOMERS REPORT VIEW
   ========================================================================= */
function CustomersReportTab({ onViewJob }: SubReportProps) {
  const { lang, t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showWhatsAppAlert, setShowWhatsAppAlert] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [debouncedSearch, pagination.page]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const res = await api.get(`/reports/customers?page=${pagination.page}&limit=${pagination.limit}&search=${debouncedSearch}`);
      setData(res.data.data.customers || []);
      setPagination(res.data.data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Export Excel and Share via WhatsApp
  function handleExportExcelAndWhatsApp() {
    if (data.length === 0) return;
    const title = lang === 'ar' ? 'تقرير حركة العملاء بالكامل - Au2Ka CRM' : 'Full Customer Analytics Report - Au2Ka CRM';
    const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
    const rowsHtml = data.map((c) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${c.fullName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">+${c.mobileNumber}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${c.vehiclesCount}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${c.jobCardsCount}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${c.lastVisit ? new Date(c.lastVisit).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : (lang === 'ar' ? 'لا يوجد' : 'None')}</td>
      </tr>
    `).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; }
          th { background-color: #e11d48; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: ${lang === 'ar' ? 'right' : 'left'}; }
          .title-row { font-size: 16px; font-weight: bold; color: #0b192c; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="5" class="title-row">${title}</td></tr>
          <tr><td colspan="5">${lang === 'ar' ? 'تاريخ استخراج التقرير:' : 'Export Date:'} ${dateStr}</td></tr>
          <tr></tr>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'الاسم الكامل للعميل' : 'Customer Full Name'}</th>
              <th>${lang === 'ar' ? 'رقم الجوال' : 'Mobile Number'}</th>
              <th>${lang === 'ar' ? 'عدد السيارات' : 'Vehicles Count'}</th>
              <th>${lang === 'ar' ? 'إجمالي الكروت' : 'Total Job Cards'}</th>
              <th>${lang === 'ar' ? 'تاريخ آخر زيارة' : 'Last Visit Date'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reports-customers-${new Date().toISOString().slice(0, 10)}.xls`);
    link.click();
    
    setShowWhatsAppAlert(true);
  }

  const isRtl = lang === 'ar';

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className={`flex justify-between items-center glass-panel p-4 border border-zinc-900 rounded-xl ${isRtl ? 'text-right' : 'text-left'}`}>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <input
              type="text"
              placeholder={t('searchCustomer')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none ${isRtl ? 'pr-8 pl-2' : 'pl-8 pr-2'}`}
            />
            <Search className={`absolute top-2.5 text-zinc-600 ${isRtl ? 'right-2.5' : 'left-2.5'}`} size={14} />
          </div>
          <button
            onClick={handleExportExcelAndWhatsApp}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-700 hover:text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-40 transition shadow-sm shrink-0"
          >
            {t('exportExcel')}
          </button>
        </div>
        <div className="text-xs text-zinc-500">{lang === 'ar' ? 'تحليل فترات الزيارة وسجل حركة الكروت لكل عميل بالورشة.' : 'Analysis of visit periods and lifecycle history for each customer.'}</div>
      </div>

      <div className="glass-panel rounded-xl border border-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-zinc-900/60 text-zinc-400 font-bold border-b border-zinc-800">
              <tr>
                <th className="p-3">{t('fullName')}</th>
                <th className="p-3">{t('mobileNumber')}</th>
                <th className="p-3">{t('vehiclesCountLabel')}</th>
                <th className="p-3">{t('visitsCountLabel')}</th>
                <th className="p-3">{t('lastVisit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-24"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-10"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-10"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-600 font-semibold">
                    {t('noCustomers')}
                  </td>
                </tr>
              ) : (
                data.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/30 transition">
                    <td className="p-3 font-bold text-white">{c.fullName}</td>
                    <td className="p-3 text-zinc-400 font-mono">+{c.mobileNumber}</td>
                    <td className="p-3 font-semibold text-zinc-400 font-mono">{c.vehiclesCount}</td>
                    <td className="p-3 font-semibold text-zinc-400 font-mono">{c.jobCardsCount}</td>
                    <td className="p-3 text-zinc-400 font-mono">
                      {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : (lang === 'ar' ? 'لا يوجد' : 'None')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3.5 bg-zinc-950 border-t border-zinc-900 flex justify-between items-center">
          <div className="text-zinc-500 text-[11px] font-semibold">
            {t('showingItems').replace('{count}', data.length.toString()).replace('{total}', pagination.total.toString())}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} className={isRtl ? '' : 'rotate-180'} />
            </button>
            <span className="text-xs text-zinc-400 font-bold font-mono">
              {lang === 'ar' ? `صفحة ${pagination.page} من ${pagination.pages}` : `Page ${pagination.page} of ${pagination.pages}`}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
              disabled={pagination.page >= pagination.pages}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} className={isRtl ? '' : 'rotate-180'} />
            </button>
          </div>
        </div>
      </div>

      {/* Alert Modal for WhatsApp Excel Sharing */}
      {showWhatsAppAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 no-print text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-3xl">📊</span>
              <h3 className="text-lg font-black text-white">{t('excelDownloaded')}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                {t('excelNextSteps')}
              </p>
            </div>

            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs text-right space-y-2 text-zinc-300">
              <p>• {t('excelFileName')}: <span className="font-mono text-emerald-400 font-bold">{`reports-customers-${new Date().toISOString().slice(0, 10)}.xls`}</span></p>
              <p>• {t('excelInstructions')}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowWhatsAppAlert(false)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {t('cancel')}
              </button>
              <a
                href={`https://api.whatsapp.com/send?phone=${localStorage.getItem('whatsappNumber') || '201015657091'}&text=${encodeURIComponent(lang === 'ar' ? 'السلام عليكم، مرفق لكم تقرير حركة العملاء بالكامل الصادر من نظام Au2Ka CRM 🚗' : 'Hello, attached is the complete customer analytics report generated by Au2Ka CRM 🚗')}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppAlert(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {t('openWhatsAppChat')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   3. VEHICLES REPORT VIEW
   ========================================================================= */
function VehiclesReportTab({ onViewJob }: SubReportProps) {
  const { lang, t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showWhatsAppAlert, setShowWhatsAppAlert] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    loadVehicles();
  }, [debouncedSearch, pagination.page]);

  async function loadVehicles() {
    try {
      setLoading(true);
      const res = await api.get(`/reports/vehicles?page=${pagination.page}&limit=${pagination.limit}&search=${debouncedSearch}`);
      setData(res.data.data.vehicles || []);
      setPagination(res.data.data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Export Excel and Share via WhatsApp
  function handleExportExcelAndWhatsApp() {
    if (data.length === 0) return;
    const title = lang === 'ar' ? 'تقرير المركبات وصيانة السيارات - Au2Ka CRM' : 'Vehicles Maintenance Report - Au2Ka CRM';
    const dateStr = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
    const rowsHtml = data.map((v) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${v.brand} ${v.model}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${v.plateNumber}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${v.mileage} ${lang === 'ar' ? 'كم' : 'km'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${v.owner?.fullName || ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-family: monospace;">${v.repairsCount}</td>
      </tr>
    `).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          table { border-collapse: collapse; }
          th { background-color: #e11d48; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: ${lang === 'ar' ? 'right' : 'left'}; }
          .title-row { font-size: 16px; font-weight: bold; color: #0b192c; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="5" class="title-row">${title}</td></tr>
          <tr><td colspan="5">${lang === 'ar' ? 'تاريخ استخراج التقرير:' : 'Export Date:'} ${dateStr}</td></tr>
          <tr></tr>
          <thead>
            <tr>
              <th>${lang === 'ar' ? 'السيارة والموديل' : 'Vehicle & Model'}</th>
              <th>${lang === 'ar' ? 'رقم اللوحة' : 'Plate Number'}</th>
              <th>${lang === 'ar' ? 'قراءة العداد' : 'Mileage'}</th>
              <th>${lang === 'ar' ? 'المالك (العميل)' : 'Owner (Customer)'}</th>
              <th>${lang === 'ar' ? 'إجمالي زيارات الإصلاح' : 'Total Repairs'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reports-vehicles-${new Date().toISOString().slice(0, 10)}.xls`);
    link.click();
    
    setShowWhatsAppAlert(true);
  }

  const isRtl = lang === 'ar';

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className={`flex justify-between items-center glass-panel p-4 border border-zinc-900 rounded-xl ${isRtl ? 'text-right' : 'text-left'}`}>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <input
              type="text"
              placeholder={t('searchVehicle')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-xs text-white focus:outline-none ${isRtl ? 'pr-8 pl-2' : 'pl-8 pr-2'}`}
            />
            <Search className={`absolute top-2.5 text-zinc-600 ${isRtl ? 'right-2.5' : 'left-2.5'}`} size={14} />
          </div>
          <button
            onClick={handleExportExcelAndWhatsApp}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-700 hover:text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-40 transition shadow-sm shrink-0"
          >
            {t('exportExcel')}
          </button>
        </div>
        <div className="text-xs text-zinc-500">{lang === 'ar' ? 'متابعة سجلات تشخيص وأعطال وعدد إصلاحات السيارات بالكامل.' : 'Follow up complete logs of diagnostics, faults, and total repairs for all vehicles.'}</div>
      </div>

      <div className="glass-panel rounded-xl border border-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-zinc-900/60 text-zinc-400 font-bold border-b border-zinc-800">
              <tr>
                <th className="p-3">{lang === 'ar' ? 'السيارة والموديل' : 'Vehicle & Model'}</th>
                <th className="p-3">{t('plateNumber')}</th>
                <th className="p-3">{t('mileage')}</th>
                <th className="p-3">{lang === 'ar' ? 'المالك (العميل)' : 'Owner (Customer)'}</th>
                <th className="p-3">{t('visitsCountLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-24"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-16"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-14"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                    <td className="p-3"><div className="h-4 bg-zinc-900 rounded w-10"></div></td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-700 font-semibold">
                    {t('noVehicles')}
                  </td>
                </tr>
              ) : (
                data.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-900/30 transition">
                    <td className="p-3 font-bold text-white">{v.brand} {v.model}</td>
                    <td className="p-3 font-mono text-zinc-400">{v.plateNumber}</td>
                    <td className="p-3 font-semibold text-zinc-400 font-mono">{v.mileage} {lang === 'ar' ? 'كم' : 'km'}</td>
                    <td className="p-3 text-zinc-400">{v.owner?.fullName}</td>
                    <td className="p-3 font-bold text-zinc-300 font-mono">{v.repairsCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3.5 bg-zinc-950 border-t border-zinc-900 flex justify-between items-center">
          <div className="text-zinc-500 text-[11px] font-semibold">
            {t('showingItems').replace('{count}', data.length.toString()).replace('{total}', pagination.total.toString())}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page <= 1}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight size={16} className={isRtl ? '' : 'rotate-180'} />
            </button>
            <span className="text-xs text-zinc-400 font-bold font-mono">
              {lang === 'ar' ? `صفحة ${pagination.page} من ${pagination.pages}` : `Page ${pagination.page} of ${pagination.pages}`}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
              disabled={pagination.page >= pagination.pages}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} className={isRtl ? '' : 'rotate-180'} />
            </button>
          </div>
        </div>
      </div>

      {/* Alert Modal for WhatsApp Excel Sharing */}
      {showWhatsAppAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 no-print text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-3xl">📊</span>
              <h3 className="text-lg font-black text-white">{t('excelDownloaded')}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                {t('excelNextSteps')}
              </p>
            </div>

            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 text-xs text-right space-y-2 text-zinc-300">
              <p>• {t('excelFileName')}: <span className="font-mono text-emerald-400 font-bold">{`reports-vehicles-${new Date().toISOString().slice(0, 10)}.xls`}</span></p>
              <p>• {t('excelInstructions')}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowWhatsAppAlert(false)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                {t('cancel')}
              </button>
              <a
                href={`https://api.whatsapp.com/send?phone=${localStorage.getItem('whatsappNumber') || '201015657091'}&text=${encodeURIComponent(lang === 'ar' ? 'السلام عليكم، مرفق لكم تقرير حركة المركبات بالكامل الصادر من نظام Au2Ka CRM 🚗' : 'Hello, attached is the vehicle maintenance report generated by Au2Ka CRM 🚗')}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppAlert(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {t('openWhatsAppChat')}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
