'use client';

import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, ShieldAlert, ArrowLeft, 
  Phone, Mail, MessageSquare, Plus, Clock, HelpCircle, Check, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { fetchPartnerLeads, createPartnerLead, type PartnerLead } from '@/services/partner-actions';

export default function PartnerLeads() {
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Lead Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [budget, setBudget] = useState('1.5 - 3.0 tỷ');
  const [notes, setNotes] = useState('');

  // Load leads from API
  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPartnerLeads();
      setLeads(data);
    } catch (error) {
      console.error('[PartnerLeads] Failed to load leads:', error);
      toast.error('Không thể tải danh sách khách hàng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      toast.error('Vui lòng điền Họ tên và Số điện thoại');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createPartnerLead({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        budget: budget || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        toast.success('Đăng ký khách hàng thành công! Quyền bảo vệ khách hàng có hiệu lực trong 30 ngày.');
        
        // Reset form
        setName('');
        setPhone('');
        setEmail('');
        setBudget('1.5 - 3.0 tỷ');
        setNotes('');
        setIsModalOpen(false);
        
        // Reload leads
        await loadLeads();
      } else {
        toast.error(result.error || 'Không thể đăng ký khách hàng');
      }
    } catch (error) {
      console.error('[PartnerLeads] Failed to create lead:', error);
      toast.error('Có lỗi xảy ra khi đăng ký khách hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest rounded-full">Đã Đăng Ký</span>;
      case 'interested':
        return <span className="px-2 py-0.5 bg-sky-50 text-sky-600 border border-sky-200 text-[8px] font-black uppercase tracking-widest rounded-full">Quan Tâm</span>;
      case 'booking':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[8px] font-black uppercase tracking-widest rounded-full">Giữ Chỗ</span>;
      case 'deposited':
        return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-[8px] font-black uppercase tracking-widest rounded-full">Đặt Cọc</span>;
      case 'contracted':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] font-black uppercase tracking-widest rounded-full">Đã Mua (HĐ)</span>;
      default:
        return <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-widest rounded-full">{status}</span>;
    }
  };

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    l.phone.includes(search)
  );

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/partner/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Khách Hàng Của Tôi</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={isLoading}
          className="p-2 bg-primary text-white rounded-xl shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* SEARCH */}
      <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm khách hàng bằng tên hoặc SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isLoading}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-primary disabled:opacity-50"
          />
        </div>
      </div>

      {/* LEADS LIST */}
      <div className="p-5 space-y-4">
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
              {search ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng đăng ký'}
            </p>
            {!search && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:opacity-90 shadow-sm"
              >
                Đăng ký ngay
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredLeads.map(lead => (
              <div 
                key={lead.id}
                className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">{lead.name}</h4>
                    <span className="text-[9px] font-bold text-slate-350 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      Ngày ĐK: {new Date(lead.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {lead.isProtected && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5">
                        🛡️ Bảo vệ: còn {lead.daysRemaining} ngày
                      </span>
                    )}
                  </div>
                  {getStatusBadge(lead.status)}
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-650 dark:text-slate-400 font-medium">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lead.phone}</span>
                  </p>
                  {lead.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{lead.email}</span>
                    </p>
                  )}
                  {lead.budget && (
                    <p className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 bg-primary/10 rounded-full flex items-center justify-center text-[8px] font-bold text-primary">$</span>
                      <span>Ngân sách: {lead.budget}</span>
                    </p>
                  )}
                </div>

                {lead.notes && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold italic">
                      &ldquo;{lead.notes}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE LEAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Khai báo Khách hàng mới
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 bg-slate-50 dark:bg-slate-850 rounded-full flex items-center justify-center text-xs font-bold text-slate-450 hover:bg-slate-100"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  disabled={isSubmitting}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  disabled={isSubmitting}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email (nếu có)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="khachhang@gmail.com"
                  disabled={isSubmitting}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ngân sách quan tâm</label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 focus:outline-none disabled:opacity-50"
                >
                  <option value="1.5 - 3.0 tỷ">1.5 - 3.0 tỷ</option>
                  <option value="3.0 - 5.0 tỷ">3.0 - 5.0 tỷ</option>
                  <option value="5.0 - 10.0 tỷ">5.0 - 10.0 tỷ</option>
                  <option value="Trên 10 tỷ">Trên 10 tỷ</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nhu cầu chi tiết</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Căn hộ hướng Đông Nam, tầng trung..."
                  rows={2}
                  disabled={isSubmitting}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-150 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Đăng Ký
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
