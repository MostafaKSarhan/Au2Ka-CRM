import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import {
  Users,
  Car,
  Wrench,
  Clock,
  CheckCircle,
  TrendingUp,
  Search,
  ChevronRight,
  Eye,
  FileText,
  PieChart as PieIcon,
  BarChart4,
  ExternalLink,
  ChevronLeft,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { JobCardDetailView } from '../jobCards/JobCardDetailView';

interface DashboardViewProps {
  onNavigate?: (tab: 'dashboard' | 'customers' | 'vehicles' | 'jobCards' | 'settings' | 'reports') => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [stats, setStats] = useState<any>({
    totalCustomers: { count: 0, growth: 0 },
    totalVehicles: { count: 0, growth: 0 },
    totalJobCards: { count: 0, growth: 0 },
    vehiclesUnderRepair: { count: 0 },
    completedRepairs: { count: 0 },
    deliveredVehicles: { count: 0 }
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Chart type switcher: 'bar' | 'pie'
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>({ jobCards: [], customers: [], vehicles: [] });
  const [searching, setSearching] = useState(false);

  // Selected job for detail modal
  const [selectedJob, setSelectedJob] = useState<any>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Debounced/instant global search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ jobCards: [], customers: [], vehicles: [] });
      return;
    }
    const handler = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.data);
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [statsRes, recentRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/recent-job-cards')
      ]);

      if (statsRes.data.status === 'success') {
        setStats(statsRes.data.data.stats);
        setChartData(statsRes.data.data.statusChartData);
      }
      if (recentRes.data.status === 'success') {
        setRecentJobs(recentRes.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  // Recharts styling
  const COLORS = ['#6366f1', '#06b6d4', '#eab308', '#3b82f6', '#22c55e', '#10b981'];

  // Map database status codes to labels for chart display
  const mappedChartData = chartData.map((item, idx) => ({
    name: statusLabels[item.status] || item.status,
    العدد: item.count,
    fill: COLORS[idx % COLORS.length]
  }));

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">لوحة الإحصائيات والتحليلات</h1>
          <p className="text-sm text-zinc-400">متابعة الأداء اليومي للورشة، توزيع الفنيين، ونسبة الكروت المعتمدة.</p>
        </div>
        
        {/* Global Search Box */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="بحث شامل (رقم كرت، لوحة، عميل...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 pr-10 text-xs text-white placeholder-zinc-500 focus:border-primary focus:outline-none"
          />
          <Search className="absolute right-3.5 top-3.5 text-zinc-500" size={16} />

          {/* Instant Search Results Panel */}
          {searchQuery.trim() !== '' && (
            <div className="absolute top-full right-0 left-0 mt-2 z-50 glass-panel border border-zinc-800 rounded-xl p-3 shadow-2xl space-y-3 max-h-96 overflow-y-auto text-right">
              {searching ? (
                <p className="text-xs text-zinc-500 text-center py-2">جاري البحث عن تطابقات...</p>
              ) : (
                <>
                  {/* Job Cards Matches */}
                  {searchResults.jobCards?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] text-zinc-500 font-bold border-b border-zinc-900 pb-1">كروت العمل المطابقة</span>
                      {searchResults.jobCards.map((job: any) => (
                        <button
                          key={job.id}
                          onClick={() => { setSelectedJob(job); setSearchQuery(''); }}
                          className="w-full flex justify-between items-center text-xs p-2 rounded hover:bg-zinc-900 text-right text-zinc-300"
                        >
                          <span className="font-semibold text-white font-mono">{job.jobNumber}</span>
                          <span className="text-[10px] text-zinc-500">{job.customer?.fullName}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Customers Matches */}
                  {searchResults.customers?.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="block text-[10px] text-zinc-500 font-bold border-b border-zinc-900 pb-1">العملاء المطابقين</span>
                      {searchResults.customers.map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => onNavigate?.('customers')}
                          className="w-full flex justify-between items-center text-xs p-2 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300"
                        >
                          <span className="font-bold text-white">{c.fullName}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">+{c.mobileNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Vehicles Matches */}
                  {searchResults.vehicles?.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="block text-[10px] text-zinc-500 font-bold border-b border-zinc-900 pb-1">السيارات المطابقة</span>
                      {searchResults.vehicles.map((v: any) => (
                        <div
                          key={v.id}
                          onClick={() => onNavigate?.('vehicles')}
                          className="w-full flex justify-between items-center text-xs p-2 rounded hover:bg-zinc-900 cursor-pointer text-zinc-300"
                        >
                          <span className="font-bold text-white">{v.brand} {v.model}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{v.plateNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchResults.jobCards?.length === 0 && searchResults.customers?.length === 0 && searchResults.vehicles?.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-2">لا توجد نتائج مطابقة لبحثك.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Six statistics cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        
        {/* Card 1: Total Customers */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-900 relative group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold">إجمالي العملاء</span>
              <h3 className="text-xl font-black text-white">{stats.totalCustomers.count}</h3>
            </div>
            <div className="p-2 bg-zinc-900/60 rounded-lg text-primary">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px]">
            <span className="text-emerald-500 font-bold flex items-center gap-0.5">
              <TrendingUp size={10} /> +{stats.totalCustomers.growth}%
            </span>
            <button onClick={() => onNavigate?.('customers')} className="text-zinc-500 hover:text-white transition flex items-center gap-0.5">
              عرض <ChevronLeft size={10} />
            </button>
          </div>
        </div>

        {/* Card 2: Total Vehicles */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-900 relative group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold">السيارات المسجلة</span>
              <h3 className="text-xl font-black text-white">{stats.totalVehicles.count}</h3>
            </div>
            <div className="p-2 bg-zinc-900/60 rounded-lg text-accent">
              <Car size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px]">
            <span className="text-emerald-500 font-bold flex items-center gap-0.5">
              <TrendingUp size={10} /> +{stats.totalVehicles.growth}%
            </span>
            <button onClick={() => onNavigate?.('vehicles')} className="text-zinc-500 hover:text-white transition flex items-center gap-0.5">
              عرض <ChevronLeft size={10} />
            </button>
          </div>
        </div>

        {/* Card 3: Total Job Cards */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-900 relative group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold">إجمالي الكروت</span>
              <h3 className="text-xl font-black text-white">{stats.totalJobCards.count}</h3>
            </div>
            <div className="p-2 bg-zinc-900/60 rounded-lg text-blue-400">
              <Wrench size={16} />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px]">
            <span className="text-emerald-500 font-bold flex items-center gap-0.5">
              <TrendingUp size={10} /> +{stats.totalJobCards.growth}%
            </span>
            <button onClick={() => onNavigate?.('jobCards')} className="text-zinc-500 hover:text-white transition flex items-center gap-0.5">
              عرض <ChevronLeft size={10} />
            </button>
          </div>
        </div>

        {/* Card 4: Under Repair */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-900 relative group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold">تحت الإصلاح حالياً</span>
              <h3 className="text-xl font-black text-white">{stats.vehiclesUnderRepair.count}</h3>
            </div>
            <div className="p-2 bg-zinc-900/60 rounded-lg text-orange-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2.5 text-left text-[10px]">
            <span className="text-zinc-500">تجري عليها أعمال صيانة</span>
          </div>
        </div>

        {/* Card 5: Completed Repairs */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-900 relative group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold">عمليات تم إصلاحها</span>
              <h3 className="text-xl font-black text-white">{stats.completedRepairs.count}</h3>
            </div>
            <div className="p-2 bg-zinc-900/60 rounded-lg text-green-400">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="mt-2.5 text-left text-[10px]">
            <span className="text-green-500/80 font-bold">بانتظار تسليم العميل</span>
          </div>
        </div>

        {/* Card 6: Delivered Vehicles */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-900 relative group overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] text-zinc-400 font-semibold">المركبات المسلمة</span>
              <h3 className="text-xl font-black text-white">{stats.deliveredVehicles.count}</h3>
            </div>
            <div className="p-2 bg-zinc-900/60 rounded-lg text-indigo-400">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="mt-2.5 text-left text-[10px]">
            <span className="text-indigo-400">انتهت دورتها بالكامل</span>
          </div>
        </div>

      </div>

      {/* Analytics Chart & Recent Job Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Status Analytics Chart */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-6 border border-zinc-900 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              📊 نسب الحالات
            </h2>
            <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              <button
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded cursor-pointer transition ${chartType === 'bar' ? 'bg-primary text-white' : 'text-zinc-500'}`}
                title="مخطط الأعمدة"
              >
                <BarChart4 size={14} />
              </button>
              <button
                onClick={() => setChartType('pie')}
                className={`p-1.5 rounded cursor-pointer transition ${chartType === 'pie' ? 'bg-primary text-white' : 'text-zinc-500'}`}
                title="المخطط الدائري"
              >
                <PieIcon size={14} />
              </button>
            </div>
          </div>

          <div className="h-64 mt-4">
            {mappedChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">لا توجد بيانات كافية للتحليل.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={mappedChartData}>
                    <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', textAlign: 'right' }} />
                    <Bar dataKey="العدد" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={mappedChartData}
                      dataKey="العدد"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {mappedChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', textAlign: 'right' }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Job Cards Table */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-zinc-900 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              🚗 أحدث كروت صيانة جارية بالورشة
            </h2>
            <button
              onClick={() => onNavigate?.('reports')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              كل كروت العمل والتقارير <ExternalLink size={12} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="text-zinc-500 border-b border-zinc-900 font-bold">
                <tr>
                  <th className="pb-3">رقم الكرت</th>
                  <th className="pb-3">اسم العميل</th>
                  <th className="pb-3">السيارة</th>
                  <th className="pb-3">اللوحة</th>
                  <th className="pb-3">التكلفة (ريال)</th>
                  <th className="pb-3">الحالة</th>
                  <th className="pb-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-zinc-600 font-semibold">لا توجد كروت جارية حالياً.</td>
                  </tr>
                ) : (
                  recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-zinc-900/10 transition">
                      <td className="py-3 font-semibold font-mono text-zinc-400">{job.jobNumber}</td>
                      <td className="py-3 font-bold text-white">{job.customer?.fullName}</td>
                      <td className="py-3 text-zinc-400">{job.vehicle?.brand} {job.vehicle?.model}</td>
                      <td className="py-3 text-zinc-500 font-mono">{job.vehicle?.plateNumber}</td>
                      <td className="py-3 font-bold font-mono text-zinc-300">{Number(job.estimatedCost) || 0}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          job.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                          job.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400' :
                          job.status === 'WAITING_APPROVAL' ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>
                          {statusLabels[job.status] || job.status}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
                          title="معاينة تفاصيل الكرت"
                        >
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Selected Job details modal overlay */}
      {selectedJob && (
        <JobCardDetailView
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
