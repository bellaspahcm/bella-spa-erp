'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckSquare, Plus, Loader2, Calendar, AlertCircle, 
  ChevronLeft, Trash2, CheckCircle2, Circle
} from 'lucide-react';
import { getMyTasks, completeTask, createTask, WorkforceTask } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function TaskCenter() {
  const [tasks, setTasks] = useState<WorkforceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create task modal & state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'lead_followup' | 'site_visit' | 'deposit_reminder' | 'contract_preparation' | 'manual'>('manual');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newDueDate, setNewDueDate] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getMyTasks();
      setTasks(data);
    } catch (err: unknown) {
      console.error('[TaskCenter] Fetch failed:', err);
      toast.error('Lỗi khi tải danh sách nhiệm vụ');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleComplete = async (taskId: string) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t));
    
    try {
      const res = await completeTask(taskId);
      if (res.success) {
        toast.success('Đã hoàn thành nhiệm vụ!');
        fetchTasks();
      } else {
        toast.error(res.error || 'Lỗi khi cập nhật nhiệm vụ');
        fetchTasks(); // rollback
      }
    } catch (err: unknown) {
      toast.error('Lỗi kết nối khi cập nhật nhiệm vụ');
      fetchTasks(); // rollback
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Vui lòng nhập tiêu đề nhiệm vụ');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTask({
        title: newTitle,
        description: newDesc,
        task_type: newType,
        priority: newPriority,
        due_date: newDueDate || undefined
      });

      if (res.success) {
        toast.success('Thêm nhiệm vụ thành công!');
        setShowAddModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewType('manual');
        setNewPriority('medium');
        setNewDueDate('');
        fetchTasks();
      } else {
        toast.error(res.error || 'Không thể tạo nhiệm vụ');
      }
    } catch (err: unknown) {
      toast.error('Lỗi kết nối khi tạo nhiệm vụ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900';
      case 'high': return 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900';
      case 'medium': return 'text-sky-600 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900';
      default: return 'text-slate-600 bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800';
    }
  };

  const getTaskTypeLabel = (t: string) => {
    switch (t) {
      case 'lead_followup': return 'Chăm sóc Lead';
      case 'site_visit': return 'Dẫn khách dự án';
      case 'deposit_reminder': return 'Nhắc cọc';
      case 'contract_preparation': return 'Hợp đồng';
      case 'system_generated': return 'Hệ thống';
      default: return 'Tự tạo';
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Nhiệm vụ</h2>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-primary text-white hover:bg-primary-hover rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-5 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải nhiệm vụ...</p>
          </div>
        ) : (
          <>
            {/* PENDING TASKS */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Chưa hoàn thành ({pendingTasks.length})</h3>
              {pendingTasks.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-100 dark:border-slate-850">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
                  <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đã hoàn thành mọi việc!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <button 
                          onClick={() => handleComplete(task.id)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-500 transition-colors flex-shrink-0"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug">{task.title}</h4>
                          {task.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-450">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md border ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md border border-slate-100 dark:border-slate-700">
                              {getTaskTypeLabel(task.task_type)}
                            </span>
                            {task.due_date && (
                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {task.due_date}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COMPLETED TASKS */}
            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Đã hoàn thành ({completedTasks.length})</h3>
                <div className="space-y-2">
                  {completedTasks.map(task => (
                    <div key={task.id} className="bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-start gap-3 opacity-60">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-350 line-through leading-snug">{task.title}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Đã hoàn tất lúc: {task.completed_at ? new Date(task.completed_at).toLocaleDateString('vi-VN') : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ADD TASK MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[36px] p-6 pb-12 space-y-4 animate-[slideUp_0.2s_ease-out]">
            <div className="flex justify-between items-center pb-2">
              <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Thêm nhiệm vụ mới</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiêu đề *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Gọi điện tư vấn khách dự án VGP..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi tiết mô tả</label>
                <textarea
                  placeholder="Nhập thông tin hướng dẫn, ghi chú..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loại nhiệm vụ</label>
                  <select
                    value={newType}
                    onChange={(e: Record<string, unknown>) => setNewType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="manual">Tự tạo</option>
                    <option value="lead_followup">Chăm sóc Lead</option>
                    <option value="site_visit">Dẫn khách dự án</option>
                    <option value="deposit_reminder">Nhắc cọc</option>
                    <option value="contract_preparation">Hợp đồng</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mức độ ưu tiên</label>
                  <select
                    value={newPriority}
                    onChange={(e: Record<string, unknown>) => setNewPriority(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hạn hoàn thành</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...
                  </>
                ) : 'Tạo nhiệm vụ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
