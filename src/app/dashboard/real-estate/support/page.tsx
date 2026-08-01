'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy, Search, Plus, User, MessageSquare, AlertTriangle, CheckCircle2,
  XCircle, ArrowRight, ShieldAlert, Sparkles, Send, Play, Check, RotateCcw, Ban, X,
  Clock, History, UserCheck, Heart, Zap, Award
} from 'lucide-react';
import { toast } from 'sonner';

import {
  colors,
  statusColors,
  textStyles,
  spacing,
  radius,
  shadow,
  cardPatterns,
  badgePatterns,
  tablePatterns,
  timelinePatterns,
  layoutPatterns,
  formPatterns,
  getStateVisual,
  documentStateVisuals,
  leadStateVisuals,
  paymentStateVisuals,
} from '@/shared/design-system';

import { ComplaintTicketService } from '@/modules/real_estate/contexts/support/application/ComplaintTicketService';
import { ComplaintTicketProps, TicketPriority, TicketCategory, TicketState } from '@/modules/real_estate/contexts/support/domain/ComplaintTicketAggregate';

// State visuals for Support Tickets
const ticketStateVisuals = {
  NEW:           { color: 'info' as const,     label: 'Mới nhận',      icon: Clock },
  ASSIGNED:      { color: 'primary' as const,  label: 'Đã phân công',  icon: UserCheck },
  INVESTIGATING: { color: 'warning' as const,  label: 'Đang xác minh', icon: Search },
  RESOLVED:      { color: 'success' as const,  label: 'Đã giải quyết', icon: CheckCircle2 },
  CLOSED:        { color: 'neutral' as const,  label: 'Đã đóng',       icon: CheckCircle2 },
  REOPENED:      { color: 'purple' as const,   label: 'Mở lại',        icon: RotateCcw },
  CANCELLED:     { color: 'danger' as const,   label: 'Đã hủy',        icon: Ban },
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<ComplaintTicketProps[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('inv-1');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('Lê Văn C');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<TicketPriority>('HIGH');
  const [newCategory, setNewCategory] = useState<TicketCategory>('SERVICE_QUALITY');
  const [newCustId, setNewCustId] = useState('inv-1');

  // Load tickets and timeline on mount & when selections change
  useEffect(() => {
    refreshData();
  }, [selectedCustomerId]);

  function refreshData() {
    const list = ComplaintTicketService.getTickets('real_estate');
    setTickets(list);
    const events = ComplaintTicketService.getCustomerTimeline('real_estate', selectedCustomerId);
    // Sort newest first
    const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTimeline(sorted);
  }

  function handleCustomerSelect(id: string, name: string) {
    setSelectedCustomerId(id);
    setSelectedCustomerName(name);
  }

  // State Transition Handlers
  async function handleAssign(ticketId: string) {
    try {
      await ComplaintTicketService.assignTicket(
        ticketId,
        'agent-1',
        'Trần Thị Hỗ Trợ',
        { userId: 'admin-1', userName: 'Người Điều Hành' }
      );
      toast.success('Đã phân công phiếu cho kĩ thuật viên hỗ trợ');
      refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi phân công');
    }
  }

  async function handleInvestigate(ticketId: string) {
    try {
      await ComplaintTicketService.investigateTicket(
        ticketId,
        { userId: 'agent-1', userName: 'Trần Thị Hỗ Trợ' }
      );
      toast.success('Bắt đầu quy trình xác minh và kiểm tra khiếu nại');
      refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật trạng thái');
    }
  }

  async function handleResolve(ticketId: string) {
    try {
      await ComplaintTicketService.resolveTicket(
        ticketId,
        'Đã gửi lại phương án giải quyết và được khách hàng đồng ý thông qua biên bản làm việc.',
        { userId: 'agent-1', userName: 'Trần Thị Hỗ Trợ' }
      );
      toast.success('Xác nhận giải quyết khiếu nại thành công');
      refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật trạng thái');
    }
  }

  async function handleClose(ticketId: string) {
    try {
      await ComplaintTicketService.closeTicket(
        ticketId,
        { userId: 'admin-1', userName: 'Người Điều Hành' }
      );
      toast.success('Đã hoàn tất đóng phiếu khiếu nại');
      refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi đóng phiếu');
    }
  }

  async function handleReopen(ticketId: string) {
    try {
      await ComplaintTicketService.reopenTicket(
        ticketId,
        { userId: 'admin-1', userName: 'Người Điều Hành' }
      );
      toast.success('Mở lại phiếu khiếu nại để xác minh bổ sung');
      refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi mở lại phiếu');
    }
  }

  async function handleCancel(ticketId: string) {
    try {
      await ComplaintTicketService.cancelTicket(
        ticketId,
        { userId: 'admin-1', userName: 'Người Điều Hành' }
      );
      toast.success('Đã hủy phiếu khiếu nại');
      refreshData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi hủy phiếu');
    }
  }

  // Create Ticket Submit
  function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newDesc.trim()) {
      toast.error('Vui lòng điền đầy đủ tiêu đề và nội dung phản ánh');
      return;
    }

    const custName = newCustId === 'inv-1' ? 'Lê Văn C' : 'Phạm Thị D';

    ComplaintTicketService.createTicket({
      tenantId: 'real_estate',
      customerId: newCustId,
      customerName: custName,
      subject: newSubject,
      description: newDesc,
      priority: newPriority,
      category: newCategory,
      actor: { userId: 'admin-1', userName: 'Người Điều Hành' }
    });

    toast.success('Tạo phiếu khiếu nại mới thành công');
    setIsCreateOpen(false);
    setNewSubject('');
    setNewDesc('');
    
    // Auto focus current customer view if new ticket is for them
    if (newCustId === selectedCustomerId) {
      refreshData();
    } else {
      handleCustomerSelect(newCustId, custName);
    }
  }

  // Filters tickets based on search query
  const filteredTickets = tickets.filter(t => 
    t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
    t.customerName.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={layoutPatterns.page}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <LifeBuoy className="text-primary w-8 h-8 animate-spin-slow" />
            Trung Tâm Chăm Sóc & Khiếu Nại
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Theo dõi yêu cầu hỗ trợ (Complaints Ticket FSM) và lịch sử tương tác khách hàng (CSKH Timeline)
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Tiếp Nhận Phản Ánh
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Tickets Management */}
        <div className="xl:col-span-2 space-y-6">
          <div className={`${cardPatterns.elevated} p-6 space-y-4 bg-white/5 border border-white/10`}>
            <div className="flex items-center justify-between">
              <h2 className={textStyles.h2}>Danh Sách Phiếu Phản Ánh / Khiếu Nại</h2>
              
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm kiếm phiếu..."
                  className="w-full pl-9 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const stateCfg = ticketStateVisuals[ticket.state] || { color: 'neutral', label: ticket.state, icon: Clock };
                const Icon = stateCfg.icon;
                const badgeStyle = statusColors[stateCfg.color];
                
                const priorityColor = 
                  ticket.priority === 'CRITICAL' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                  ticket.priority === 'HIGH' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                  ticket.priority === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                  'text-slate-400 bg-slate-500/10 border-slate-500/20';

                const categoryLabel = 
                  ticket.category === 'SERVICE_QUALITY' ? 'Chất lượng dịch vụ' :
                  ticket.category === 'BILLING' ? 'Thanh toán & Lãi suất' :
                  ticket.category === 'TECHNICAL' ? 'Kỹ thuật / Thiết kế' : 'Câu hỏi chung';

                const isSelected = selectedCustomerId === ticket.customerId;

                return (
                  <div 
                    key={ticket.id} 
                    className={`p-5 rounded-2xl border transition-all ${
                      isSelected 
                        ? 'bg-amber-500/5 border-amber-500/40 shadow-md shadow-amber-500/5' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono text-sm font-black">{ticket.ticketNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${priorityColor}`}>
                            {ticket.priority}
                          </span>
                          <span className="text-white/30 text-xs">• {categoryLabel}</span>
                        </div>
                        <h3 className="text-white font-bold text-base mt-1">{ticket.subject}</h3>
                        <p className="text-white/50 text-xs line-clamp-2 max-w-xl">{ticket.description}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {/* FSM State Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {stateCfg.label}
                        </span>
                        
                        {/* Customer Quick View Link */}
                        <button
                          onClick={() => handleCustomerSelect(ticket.customerId, ticket.customerName)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 mt-1 transition-colors"
                        >
                          <User className="w-3 h-3" />
                          {ticket.customerName}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* FSM Actions Block */}
                    <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-white/30">
                        {ticket.assignedAgentName ? (
                          <span>Giao cho: <strong className="text-white/60">{ticket.assignedAgentName}</strong></span>
                        ) : (
                          <span className="italic">Chưa phân công phụ trách</span>
                        )}
                        <span className="mx-2">|</span>
                        <span>Cập nhật: {new Date(ticket.updatedAt).toLocaleTimeString()} {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                      </div>

                      {/* FSM Workflow Buttons */}
                      <div className="flex items-center gap-1.5">
                        {ticket.state === 'NEW' && (
                          <button
                            onClick={() => handleAssign(ticket.id)}
                            className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" /> Phân công
                          </button>
                        )}
                        {ticket.state === 'ASSIGNED' && (
                          <button
                            onClick={() => handleInvestigate(ticket.id)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Xác minh
                          </button>
                        )}
                        {ticket.state === 'INVESTIGATING' && (
                          <button
                            onClick={() => handleResolve(ticket.id)}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Giải quyết
                          </button>
                        )}
                        {ticket.state === 'RESOLVED' && (
                          <button
                            onClick={() => handleClose(ticket.id)}
                            className="px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Đóng phiếu
                          </button>
                        )}
                        {(ticket.state === 'CLOSED' || ticket.state === 'RESOLVED') && (
                          <button
                            onClick={() => handleReopen(ticket.id)}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Mở lại
                          </button>
                        )}
                        {['NEW', 'ASSIGNED', 'INVESTIGATING'].includes(ticket.state) && (
                          <button
                            onClick={() => handleCancel(ticket.id)}
                            className="px-2.5 py-1 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 border border-rose-500/20"
                          >
                            <Ban className="w-3 h-3" /> Hủy bỏ
                          </button>
                        )}
                      </div>
                    </div>

                    {ticket.resolutionNotes && (
                      <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white/60">
                        <strong className="text-emerald-400">Ghi chú giải quyết:</strong> {ticket.resolutionNotes}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredTickets.length === 0 && (
                <div className="text-center py-12 text-white/30 italic text-sm">
                  Không tìm thấy phiếu khiếu nại nào phù hợp.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Col 3: CSKH Timeline (Customer 360 view) */}
        <div className="space-y-6">
          <div className={`${cardPatterns.elevated} p-6 space-y-4 bg-white/5 border border-white/10`}>
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <History className="text-amber-400 w-5 h-5" />
              <h2 className={textStyles.h2}>Dòng Lịch Sử CSKH (Customer Timeline)</h2>
            </div>

            {/* Quick Customer Switcher */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5">
              <span className="text-xs text-white/40 shrink-0">Chọn KH:</span>
              <button 
                onClick={() => handleCustomerSelect('inv-1', 'Lê Văn C')}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedCustomerId === 'inv-1' 
                    ? 'bg-amber-500 text-black' 
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                Lê Văn C
              </button>
              <button 
                onClick={() => handleCustomerSelect('inv-2', 'Phạm Thị D')}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedCustomerId === 'inv-2' 
                    ? 'bg-amber-500 text-black' 
                    : 'text-white/60 hover:bg-white/5'
                }`}
              >
                Phạm Thị D
              </button>
            </div>

            {/* Timeline */}
            <div className="pt-2">
              <h3 className="text-xs text-white/40 uppercase font-black tracking-wider mb-4">
                Lịch sử của: {selectedCustomerName}
              </h3>
              
              <div className={timelinePatterns.list}>
                {timeline.map((event, index) => {
                  
                  // Pick dot color and icon based on category/verb
                  let dotClass: string = timelinePatterns.dot;
                  let iconElement = <Clock className="w-3 h-3 text-white/40" />;
                  
                  if (event.category === 'crm') {
                    dotClass = timelinePatterns.dotPrimary;
                    iconElement = <Heart className="w-3.5 h-3.5 text-primary" />;
                  } else if (event.category === 'sales') {
                    dotClass = timelinePatterns.dotSuccess;
                    iconElement = <Zap className="w-3.5 h-3.5 text-emerald-500" />;
                  } else if (event.category === 'support') {
                    dotClass = timelinePatterns.dotWarning;
                    iconElement = <LifeBuoy className="w-3.5 h-3.5 text-amber-500" />;
                  }

                  const time = new Date(event.timestamp);

                  return (
                    <div key={event.id || index} className={timelinePatterns.item}>
                      {/* Connector Line */}
                      {index < timeline.length - 1 && (
                        <div className={timelinePatterns.connector} />
                      )}

                      {/* Dot icon */}
                      <div className={dotClass}>
                        {iconElement}
                      </div>

                      {/* Content */}
                      <div className={timelinePatterns.content}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-white/30 uppercase font-black">
                            {event.category}
                          </span>
                          <span className="text-[10px] text-white/30">
                            {time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {time.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-white/80 font-medium mt-1 leading-relaxed">
                          {event.summary}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {timeline.length === 0 && (
                  <div className="text-center py-8 text-white/20 italic text-xs">
                    Chưa ghi nhận hoạt động chăm sóc nào.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Reception Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="absolute right-4 top-4 p-1 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <LifeBuoy className="text-amber-400 w-6 h-6 animate-pulse" />
                <div>
                  <h3 className="text-lg font-bold text-white">Tiếp Nhận Phản Ánh & Khiếu Nại</h3>
                  <p className="text-xs text-white/40">Ghi nhận khiếu nại mới của khách hàng vào hệ thống</p>
                </div>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                {/* Select Customer */}
                <div className={formPatterns.field}>
                  <label className={formPatterns.label}>Khách Hàng Phản Ánh <span className={formPatterns.required}>*</span></label>
                  <select
                    value={newCustId}
                    onChange={e => setNewCustId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                  >
                    <option value="inv-1" className="bg-slate-900">Lê Văn C (HĐMB Căn CH-1204)</option>
                    <option value="inv-2" className="bg-slate-900">Phạm Thị D (Khách đầu tư tiềm năng)</option>
                  </select>
                </div>

                {/* Priority & Category Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={formPatterns.field}>
                    <label className={formPatterns.label}>Mức Độ Khẩn <span className={formPatterns.required}>*</span></label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value as TicketPriority)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                    >
                      <option value="CRITICAL" className="bg-slate-900 text-red-400">💥 CRITICAL (Khẩn cấp)</option>
                      <option value="HIGH" className="bg-slate-900 text-orange-400">🔥 HIGH (Cao)</option>
                      <option value="MEDIUM" className="bg-slate-900 text-amber-400">⭐ MEDIUM (Thường)</option>
                      <option value="LOW" className="bg-slate-900 text-slate-400">💤 LOW (Thấp)</option>
                    </select>
                  </div>

                  <div className={formPatterns.field}>
                    <label className={formPatterns.label}>Phân Loại <span className={formPatterns.required}>*</span></label>
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value as TicketCategory)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                    >
                      <option value="SERVICE_QUALITY" className="bg-slate-900">Chất lượng dịch vụ</option>
                      <option value="BILLING" className="bg-slate-900">Thanh toán & Lãi phạt</option>
                      <option value="TECHNICAL" className="bg-slate-900">Kỹ thuật & Thiết kế</option>
                      <option value="GENERAL" className="bg-slate-900">Câu hỏi tổng quát</option>
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div className={formPatterns.field}>
                  <label className={formPatterns.label}>Tiêu Đề Phản Ánh <span className={formPatterns.required}>*</span></label>
                  <input
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    placeholder="VD: Trễ hạn nộp hồ sơ xin cấp sổ đỏ"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Description */}
                <div className={formPatterns.field}>
                  <label className={formPatterns.label}>Chi Tiết Phản Ánh / Yêu Cầu <span className={formPatterns.required}>*</span></label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    rows={4}
                    placeholder="Mô tả cụ thể sự việc phản ánh của khách hàng..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className={formPatterns.actions}>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-sm rounded-xl transition"
                  >
                    Bỏ Qua
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm rounded-xl transition"
                  >
                    Tạo Yêu Cầu
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
