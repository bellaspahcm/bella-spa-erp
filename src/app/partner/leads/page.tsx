'use client';

import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, ShieldAlert, ArrowLeft, 
  Phone, Mail, MessageSquare, Plus, Clock, HelpCircle, Check, Loader2, ChevronDown,
  Edit3, X, Save, Shield, Calendar, DollarSign, Download
} from 'lucide-react';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { toast } from 'sonner';
import Link from 'next/link';
import { fetchPartnerLeads, createPartnerLead, updatePartnerLeadStatus, type PartnerLead } from '@/services/partner-actions';

export default function PartnerLeads() {
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<PartnerLead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditingDetail, setIsEditingDetail] = useState(false);

  // New Lead Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [budget, setBudget] = useState('1.5 - 3.0 tỷ');
  const [notes, setNotes] = useState('');

  // Edit Lead Form fields
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Budget options for PremiumSelect
  const budgetOptions = [
    { value: '1.5 - 3.0 tỷ', label: '1.5 - 3.0 tỷ' },
    { value: '3.0 - 5.0 tỷ', label: '3.0 - 5.0 tỷ' },
    { value: '5.0 - 10.0 tỷ', label: '5.0 - 10.0 tỷ' },
    { value: 'Trên 10 tỷ', label: 'Trên 10 tỷ' },
  ];

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

  const handleStatusUpdate = async (leadId: string, newStatus: PartnerLead['status']) => {
    setUpdatingLeadId(leadId);
    
    try {
      const result = await updatePartnerLeadStatus(leadId, { status: newStatus });
      
      if (result.success) {
        toast.success('Cập nhật trạng thái thành công');
        await loadLeads();
      } else {
        toast.error(result.error || 'Không thể cập nhật trạng thái');
      }
    } catch (error) {
      console.error('[PartnerLeads] Failed to update status:', error);
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái');
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleOpenDetailModal = (lead: PartnerLead) => {
    setSelectedLead(lead);
    setEditName(lead.name);
    setEditEmail(lead.email || '');
    setEditBudget(lead.budget || '1.5 - 3.0 tỷ');
    setEditNotes(lead.notes || '');
    setIsEditingDetail(false);
    setIsDetailModalOpen(true);
  };

  const handleUpdateLeadDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLead) return;
    
    setIsSubmitting(true);
    
    try {
      const result = await updatePartnerLeadStatus(selectedLead.id, {
        email: editEmail.trim() || undefined,
        budget: editBudget || undefined,
        notes: editNotes.trim() || undefined,
      });
      
      if (result.success) {
        toast.success('Cập nhật thông tin thành công');
        setIsEditingDetail(false);
        await loadLeads();
        
        // Update selectedLead with new data
        if (result.data) {
          setSelectedLead(result.data);
        }
      } else {
        toast.error(result.error || 'Không thể cập nhật thông tin');
      }
    } catch (error) {
      console.error('[PartnerLeads] Failed to update lead details:', error);
      toast.error('Có lỗi xảy ra khi cập nhật thông tin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportLeads = () => {
    if (leads.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }

    // Create CSV content
    const headers = [
      'Họ và tên',
      'Số điện thoại',
      'Email',
      'Ngân sách',
      'Trạng thái',
      'Ghi chú',
      'Ngày đăng ký',
      'Hết hạn bảo vệ',
      'Đang được bảo vệ'
    ];

    const statusMap: Record<string, string> = {
      registered: 'Đã đăng ký',
      interested: 'Quan tâm',
      booking: 'Giữ chỗ',
      deposited: 'Đặt cọc',
      contracted: 'Đã mua (HĐ)',
      lost: 'Không thành',
    };

    const rows = leads.map(lead => [
      lead.name,
      lead.phone,
      lead.email || '',
      lead.budget || '',
      statusMap[lead.status] || lead.status,
      lead.notes || '',
      new Date(lead.created_at).toLocaleString('vi-VN'),
      new Date(lead.protected_until).toLocaleDateString('vi-VN'),
      lead.isProtected ? 'Có' : 'Không'
    ]);

    // Escape CSV fields
    const escapeCSV = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `khach-hang-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Đã xuất ${leads.length} khách hàng ra file CSV`);
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
      case 'lost':
        return <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-widest rounded-full">Không Thành</span>;
      default:
        return <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-widest rounded-full">{status}</span>;
    }
  };

  const getStatusOptions = (currentStatus: string): Array<{ value: PartnerLead['status']; label: string; disabled?: boolean }> => {
    const allOptions = [
      { value: 'registered' as const, label: 'Đã Đăng Ký' },
      { value: 'interested' as const, label: 'Quan Tâm' },
      { value: 'booking' as const, label: 'Giữ Chỗ' },
      { value: 'deposited' as const, label: 'Đặt Cọc' },
      { value: 'contracted' as const, label: 'Đã Mua (HĐ)' },
      { value: 'lost' as const, label: 'Không Thành' },
    ];

    // Valid transitions from API
    const validTransitions: Record<string, string[]> = {
      'registered': ['interested', 'lost'],
      'interested': ['booking', 'lost'],
      'booking': ['deposited', 'lost'],
      'deposited': ['contracted', 'lost'],
      'contracted': [], // Terminal
      'lost': [], // Terminal
    };

    const allowed = validTransitions[currentStatus] || [];
    
    return allOptions.map(opt => ({
      ...opt,
      disabled: opt.value !== currentStatus && !allowed.includes(opt.value),
    }));
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
        <div className="flex gap-2">
          {leads.length > 0 && (
            <button 
              onClick={handleExportLeads}
              disabled={isLoading}
              className="p-2 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              title="Xuất Excel"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={isLoading}
            className="p-2 bg-primary text-white rounded-xl shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
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
                  <div className="flex-1">
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
                  
                  {/* Status Dropdown */}
                  <div className="relative">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusUpdate(lead.id, e.target.value as PartnerLead['status'])}
                      disabled={updatingLeadId === lead.id || lead.status === 'contracted' || lead.status === 'lost'}
                      className="appearance-none pl-2 pr-6 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      style={{
                        backgroundColor: lead.status === 'interested' ? 'rgb(240 249 255)' :
                                       lead.status === 'booking' ? 'rgb(255 251 235)' :
                                       lead.status === 'deposited' ? 'rgb(238 242 255)' :
                                       lead.status === 'contracted' ? 'rgb(236 253 245)' :
                                       lead.status === 'lost' ? 'rgb(254 242 242)' :
                                       'rgb(241 245 249)',
                        color: lead.status === 'interested' ? 'rgb(2 132 199)' :
                              lead.status === 'booking' ? 'rgb(217 119 6)' :
                              lead.status === 'deposited' ? 'rgb(99 102 241)' :
                              lead.status === 'contracted' ? 'rgb(5 150 105)' :
                              lead.status === 'lost' ? 'rgb(220 38 38)' :
                              'rgb(71 85 105)',
                      }}
                    >
                      {getStatusOptions(lead.status).map(opt => (
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {updatingLeadId === lead.id ? (
                      <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin pointer-events-none" />
                    ) : (
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                    )}
                  </div>
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

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleOpenDetailModal(lead)}
                    className="flex-1 py-2 bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEAD DETAIL MODAL */}
      {isDetailModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Chi tiết Khách hàng
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  Mã: {selectedLead.id.slice(0, 8)}...
                </p>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 bg-slate-50 dark:bg-slate-850 rounded-full flex items-center justify-center text-sm font-bold text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Protection Status Banner */}
              {selectedLead.isProtected ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                      🛡️ Đang Được Bảo Vệ
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      Quyền độc quyền còn {selectedLead.daysRemaining} ngày
                    </p>
                    <p className="text-[9px] text-emerald-500 dark:text-emerald-500 mt-0.5">
                      Hết hạn: {new Date(selectedLead.protected_until).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                      ⚠️ Hết Thời Gian Bảo Vệ
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                      Khách hàng có thể được xử lý bởi đối tác khác
                    </p>
                  </div>
                </div>
              )}

              {/* Info Section */}
              {!isEditingDetail ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                      <Users className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Họ và tên</p>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedLead.name}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                      <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Số điện thoại</p>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedLead.phone}</p>
                      </div>
                    </div>

                    {selectedLead.email && (
                      <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                        <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Email</p>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedLead.email}</p>
                        </div>
                      </div>
                    )}

                    {selectedLead.budget && (
                      <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                        <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ngân sách</p>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{selectedLead.budget}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                      <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ngày đăng ký</p>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                          {new Date(selectedLead.created_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    {selectedLead.notes && (
                      <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-850 rounded-xl">
                        <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ghi chú</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-1 font-medium">
                            {selectedLead.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setIsEditingDetail(true)}
                    className="w-full py-3 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Edit3 className="w-4 h-4" />
                    Chỉnh sửa thông tin
                  </button>

                  {/* Convert to Booking Button */}
                  {(selectedLead.status === 'interested' || selectedLead.status === 'booking') && (
                    <Link 
                      href={`/partner/bookings?lead_id=${selectedLead.id}&name=${encodeURIComponent(selectedLead.name)}&phone=${encodeURIComponent(selectedLead.phone)}&email=${encodeURIComponent(selectedLead.email || '')}&budget=${encodeURIComponent(selectedLead.budget || '')}`}
                      className="w-full py-3 bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-emerald-600 flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Chuyển thành Booking
                    </Link>
                  )}
                </>
              ) : (
                /* Edit Form */
                <form onSubmit={handleUpdateLeadDetails} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Họ và tên (không thể sửa)
                    </label>
                    <input
                      type="text"
                      value={editName}
                      disabled
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-850 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Số điện thoại (không thể sửa)
                    </label>
                    <input
                      type="tel"
                      value={selectedLead.phone}
                      disabled
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-850 text-slate-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="khachhang@gmail.com"
                      disabled={isSubmitting}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>

                  <PremiumSelect
                    label="Ngân sách"
                    options={budgetOptions}
                    value={editBudget}
                    onChange={setEditBudget}
                    disabled={isSubmitting}
                    buttonClassName="!py-2.5 !px-3 !text-xs"
                    dropdownClassName="!text-xs"
                  />

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ghi chú</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Nhu cầu chi tiết của khách hàng..."
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetail(false)}
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-150 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
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
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Lưu thay đổi
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

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

              <PremiumSelect
                label="Ngân sách quan tâm"
                options={budgetOptions}
                value={budget}
                onChange={setBudget}
                disabled={isSubmitting}
                buttonClassName="!py-2.5 !px-3 !text-xs"
                dropdownClassName="!text-xs"
              />

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
