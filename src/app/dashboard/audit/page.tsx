'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  Search, 
  Filter, 
  Eye, 
  Clock, 
  User as UserIcon, 
  Database, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  ArrowRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface AuditLog {
  id: string;
  user_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  created_at: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTable, setFilterTable] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        if (userData?.tenant_id) {
          tenantId = userData.tenant_id;
        }
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          users:changed_by_id(full_name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching logs:', error);
        toast.error('Lỗi khi tải nhật ký: ' + error.message);
        return;
      }

      const formattedLogs = data?.map((log: any) => ({
        id: log.id,
        user_name: log.users?.full_name || 'Hệ thống',
        action: log.action,
        table_name: log.table_name,
        record_id: log.record_id,
        old_data: log.old_data,
        new_data: log.new_data,
        created_at: log.created_at
      })) || [];

      setLogs(formattedLogs);
      setFilteredLogs(formattedLogs);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error('Không thể tải nhật ký hệ thống: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let result = logs;

    if (searchTerm) {
      result = result.filter(log => 
        log.record_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterTable !== 'all') {
      result = result.filter(log => log.table_name === filterTable);
    }

    if (filterAction !== 'all') {
      result = result.filter(log => log.action === filterAction);
    }

    setFilteredLogs(result);
    setCurrentPage(1);
  }, [searchTerm, filterTable, filterAction, logs]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'UPDATE': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'DELETE': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 min-h-screen pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <History className="w-6 h-6 text-rose-500" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Audit Trail
            </h1>
          </div>
          <p className="text-slate-500 ml-11">
            Theo dõi và kiểm soát mọi thay đổi dữ liệu trong hệ thống.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <button 
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </motion.div>
      </div>

      {/* Filters section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm ID, User, Bảng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-rose-500/20 text-sm"
          />
        </div>

        <PremiumSelect
          value={filterTable}
          onChange={setFilterTable}
          options={[
            { value: 'all', label: 'Tất cả các bảng' },
            { value: 'revenue', label: 'Doanh thu' },
            { value: 'expenses', label: 'Chi phí' },
            { value: 'bookings', label: 'Lịch hẹn' },
            { value: 'inventory_items', label: 'Kho hàng' },
            { value: 'users', label: 'Người dùng' },
          ]}
        />

        <PremiumSelect
          value={filterAction}
          onChange={setFilterAction}
          options={[
            { value: 'all', label: 'Tất cả hành động' },
            { value: 'INSERT', label: 'Thêm mới' },
            { value: 'UPDATE', label: 'Cập nhật' },
            { value: 'DELETE', label: 'Xóa' },
          ]}
        />
        
        <div className="flex items-center justify-center text-slate-400 text-xs italic">
          Đang hiển thị {filteredLogs.length} bản ghi
        </div>
      </motion.div>

      {/* Table section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Thời gian</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Người thực hiện</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Hành động</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Bảng dữ liệu</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/20"></td>
                  </tr>
                ))
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {log.table_name}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-40">
                      <AlertCircle className="w-12 h-12" />
                      <p>Không có dữ liệu nhật ký nào.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Trang {currentPage} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Chi tiết thay đổi</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
                    Record ID: {selectedLog.record_id}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Old Data */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      Dữ liệu cũ
                    </h4>
                    <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto min-h-[200px]">
                      <pre className="text-emerald-400 text-xs font-mono">
                        {formatValue(selectedLog.old_data)}
                      </pre>
                    </div>
                  </div>

                  {/* New Data */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                      Dữ liệu mới
                      <ArrowRight className="w-4 h-4" />
                    </h4>
                    <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto min-h-[200px]">
                      <pre className="text-rose-400 text-xs font-mono">
                        {formatValue(selectedLog.new_data)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Lưu ý an ninh</p>
                    <p>Mọi thay đổi đều được mã hóa và lưu trữ vĩnh viễn. Chỉ quản trị viên cấp cao mới có quyền xem nhật ký này.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-all"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
