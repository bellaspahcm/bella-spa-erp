"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy, Search, Plus, User, MessageSquare, AlertTriangle, CheckCircle2,
  XCircle, ArrowRight, ShieldAlert, Sparkles, Send, Play, Check, RotateCcw, Ban, X,
  Clock, History, UserCheck, Heart, Zap, Award
} from "lucide-react";
import { toast } from "sonner";

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
} from "@/shared/design-system";

import { ComplaintTicketService } from "@/modules/real_estate/contexts/support/application/ComplaintTicketService";
import { ComplaintTicketProps, TicketPriority, TicketCategory, TicketState } from "@/modules/real_estate/contexts/support/domain/ComplaintTicketAggregate";

// State visuals for Support Tickets
const ticketStateVisuals = {
  NEW:           { color: "info" as const,     label: "Mới nhận",      icon: Clock },
  ASSIGNED:      { color: "primary" as const,  label: "Đã phân công",  icon: UserCheck },
  INVESTIGATING: { color: "warning" as const,  label: "Đang xác minh", icon: Search },
  RESOLVED:      { color: "success" as const,  label: "Đã giải quyết", icon: CheckCircle2 },
  CLOSED:        { color: "neutral" as const,  label: "Đã đóng",       icon: CheckCircle2 },
  REOPENED:      { color: "purple" as const,   label: "Mở lại",        icon: RotateCcw },
  CANCELLED:     { color: "danger" as const,   label: "Đã hủy",        icon: Ban },
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<ComplaintTicketProps[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("inv-1");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("Lê Văn C");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("HIGH");
  const [newCategory, setNewCategory] = useState<TicketCategory>("SERVICE_QUALITY");
  const [newCustId, setNewCustId] = useState("inv-1");

  // Load tickets and timeline on mount & when selections change
  useEffect(() => {
    refreshData();
  }, [selectedCustomerId]);

  function refreshData() {
    const list = ComplaintTicketService.getTickets("real_estate");
    setTickets(list);
    const events = ComplaintTicketService.getCustomerTimeline("real_estate", selectedCustomerId);
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
        "agent-1",
        "Trần Thị Hỗ Trợ",
        { userId: "admin-1", userName: "Người Điều Hành" }
      );
      toast.success("Đã phân công phiếu cho kĩ thuật viên hỗ trợ");
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi phân công");
    }
  }

  async function handleInvestigate(ticketId: string) {
    try {
      await ComplaintTicketService.investigateTicket(
        ticketId,
        { userId: "agent-1", userName: "Trần Thị Hỗ Trợ" }
      );
      toast.success("Bắt đầu quy trình xác minh và kiểm tra khiếu nại");
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi cập nhật trạng thái");
    }
  }

  async function handleResolve(ticketId: string) {
    try {
      await ComplaintTicketService.resolveTicket(
        ticketId,
        "Đã gửi lại phương án giải quyết và được khách hàng đồng ý thông qua biên bản làm việc.",
        { userId: "agent-1", userName: "Trần Thị Hỗ Trợ" }
      );
      toast.success("Xác nhận giải quyết khiếu nại thành công");
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi cập nhật trạng thái");
    }
  }

  async function handleClose(ticketId: string) {
    try {
      await ComplaintTicketService.closeTicket(
        ticketId,
        { userId: "admin-1", userName: "Người Điều Hành" }
      );
      toast.success("Đã hoàn tất đóng phiếu khiếu nại");
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi đóng phiếu");
    }
  }

  async function handleReopen(ticketId: string) {
    try {
      await ComplaintTicketService.reopenTicket(
        ticketId,
        { userId: "admin-1", userName: "Người Điều Hành" }
      );
      toast.success("Mở lại phiếu khiếu nại để xác minh bổ sung");
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi mở lại phiếu");
    }
  }

  async function handleCancel(ticketId: string) {
    try {
      await ComplaintTicketService.cancelTicket(
        ticketId,
        { userId: "admin-1", userName: "Người Điều Hành" }
      );
      toast.success("Đã hủy phiếu khiếu nại");
      refreshData();
    } catch (e: any) {
      toast.error(e.message || "Lỗi hủy phiếu");
    }
  }

  // Create Ticket Submit
  function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newDesc.trim()) {
      toast.error("Vui lòng điền đầy đủ tiêu đề và nội dung phản ánh");
      return;
    }

    const custName = newCustId === "inv-1" ? "Lê Văn C" : "Phạm Thị D";

    ComplaintTicketService.createTicket({
      tenantId: "real_estate",
      customerId: newCustId,
      customerName: custName,
      subject: newSubject,
      description: newDesc,
      priority: newPriority,
      category: newCategory,
      actor: { userId: "admin-1", userName: "Người Điều Hành" }
    });

    toast.success("Tạo phiếu khiếu nại mới thành công");
    setIsCreateOpen(false);
    setNewSubject("");
    setNewDesc("");
    
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
    <div className="space-y-8 w-full">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <LifeBuoy className="text-amber-600 dark:text-amber-400 w-6 h-6" />
            </div>
            Trung Tâm Chăm Sóc & Khiếu Nại
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Theo dõi yêu cầu hỗ trợ (Complaints Ticket FSM) và lịch sử tương tác khách hàng (CSKH Timeline)
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Tiếp Nhận Phản Ánh
        </button>
      </div>

      {/* ─ Main Grid ─ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Tickets Management */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Danh Sách Phiếu Phản Ánh / Khiếu Nại</h2>
              
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm kiếm phiếu..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredTickets.map((ticket) => {
                const stateCfg = ticketStateVisuals[ticket.state] || { color: "info", label: ticket.state, icon: Clock };
                const Icon = stateCfg.icon;
                const badgeStyle = statusColors[stateCfg.color];
                
                const priorityColor = 
                  ticket.priority === "CRITICAL" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50" :
                  ticket.priority === "HIGH" ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50" :
                  ticket.priority === "MEDIUM" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50" :
                  "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";

                const categoryLabel = 
                  ticket.category === "SERVICE_QUALITY" ? "Chất lượng dịch vụ" :
                  ticket.category === "BILLING" ? "Thanh toán & Lãi suất" :
                  ticket.category === "TECHNICAL" ? "Kỹ thuật / Thiết kế" : "Câu hỏi chung";

                const isSelected = selectedCustomerId === ticket.customerId;

                return (
                  <div 
                    key={ticket.id} 
                    className={`p-5 rounded-2xl border transition-all ${
                      isSelected 
                        ? "bg-amber-500/5 border-amber-300 dark:border-amber-500/40 shadow-sm" 
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-900 dark:text-white font-mono text-sm font-black">{ticket.ticketNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${priorityColor}`}>
                            {ticket.priority}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">• {categoryLabel}</span>
                        </div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-base leading-tight mt-1">{ticket.subject}</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed max-w-xl">{ticket.description}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {/* FSM State Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {stateCfg.label}
                        </span>
                        
                        {/* Customer Quick View Link */}
                        <button
                          onClick={() => handleCustomerSelect(ticket.customerId, ticket.customerName)}
                          className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold flex items-center gap-1 mt-1 transition-colors"
                        >
                          <User className="w-3.5 h-3.5" />
                          {ticket.customerName}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* FSM Actions Block */}
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ticket.assignedAgentName ? (
                          <span>Giao cho: <strong className="text-slate-700 dark:text-slate-300 font-bold">{ticket.assignedAgentName}</strong></span>
                        ) : (
                          <span className="italic">Chưa phân công phụ trách</span>
                        )}
                        <span className="mx-2">|</span>
                        <span>Cập nhật: {new Date(ticket.updatedAt).toLocaleTimeString()} {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                      </div>

                      {/* FSM Workflow Buttons */}
                      <div className="flex items-center gap-1.5">
                        {ticket.state === "NEW" && (
                          <button
                            onClick={() => handleAssign(ticket.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Phân công
                          </button>
                        )}
                        {ticket.state === "ASSIGNED" && (
                          <button
                            onClick={() => handleInvestigate(ticket.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" /> Xác minh
                          </button>
                        )}
                        {ticket.state === "INVESTIGATING" && (
                          <button
                            onClick={() => handleResolve(ticket.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Giải quyết
                          </button>
                        )}
                        {ticket.state === "RESOLVED" && (
                          <button
                            onClick={() => handleClose(ticket.id)}
                            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Đóng phiếu
                          </button>
                        )}
                        {(ticket.state === "CLOSED" || ticket.state === "RESOLVED") && (
                          <button
                            onClick={() => handleReopen(ticket.id)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Mở lại
                          </button>
                        )}
                        {["NEW", "ASSIGNED", "INVESTIGATING"].includes(ticket.state) && (
                          <button
                            onClick={() => handleCancel(ticket.id)}
                            className="px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-all flex items-center gap-1 border border-rose-200 dark:border-rose-800/40"
                          >
                            <Ban className="w-3.5 h-3.5" /> Hủy bỏ
                          </button>
                        )}
                      </div>
                    </div>

                    {ticket.resolutionNotes && (
                      <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-400">
                        <strong className="text-emerald-600 dark:text-emerald-400">Ghi chú giải quyết:</strong> {ticket.resolutionNotes}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredTickets.length === 0 && (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-sm">
                  Không tìm thấy phiếu khiếu nại nào phù hợp.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Col 3: CSKH Timeline (Customer 360 view) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <History className="text-amber-500 w-5 h-5" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Dòng Lịch Sử CSKH (Customer Timeline)</h2>
            </div>

            {/* Quick Customer Switcher */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 font-bold pl-1">Chọn KH:</span>
              <button 
                onClick={() => handleCustomerSelect("inv-1", "Lê Văn C")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCustomerId === "inv-1" 
                    ? "bg-amber-500 text-black shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                Lê Văn C
              </button>
              <button 
                onClick={() => handleCustomerSelect("inv-2", "Phạm Thị D")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCustomerId === "inv-2" 
                    ? "bg-amber-500 text-black shadow-sm" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                Phạm Thị D
              </button>
            </div>

            {/* Timeline */}
            <div className="pt-2">
              <h3 className="text-xs text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest mb-4">
                Lịch sử của: {selectedCustomerName}
              </h3>
              
              <div className="relative space-y-4 pl-6">
                {timeline.map((event, index) => {
                  // Pick dot color and icon based on category/verb
                  let dotClass = "absolute left-[-28px] top-1.5 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
                  let iconElement = <Clock className="w-4 h-4 text-slate-400" />;
                  
                  if (event.category === "crm") {
                    dotClass = "absolute left-[-28px] top-1.5 w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50";
                    iconElement = <Heart className="w-4 h-4 text-blue-500" />;
                  } else if (event.category === "sales") {
                    dotClass = "absolute left-[-28px] top-1.5 w-8 h-8 rounded-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50";
                    iconElement = <Zap className="w-4 h-4 text-emerald-500" />;
                  } else if (event.category === "support") {
                    dotClass = "absolute left-[-28px] top-1.5 w-8 h-8 rounded-full flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50";
                    iconElement = <LifeBuoy className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
                  }

                  const time = new Date(event.timestamp);

                  return (
                    <div key={event.id || index} className="relative">
                      {/* Connector Line */}
                      {index < timeline.length - 1 && (
                        <div className="absolute left-[-13px] top-9 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
                      )}

                      {/* Dot icon */}
                      <div className={dotClass}>
                        {iconElement}
                      </div>

                      {/* Content */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 ml-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black">
                            {event.category}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {time.toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"})} - {time.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-750 dark:text-slate-300 font-semibold mt-1 leading-relaxed">
                          {event.summary}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {timeline.length === 0 && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-xs">
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>

              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
                  <LifeBuoy className="text-amber-600 dark:text-amber-400 w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Tiếp Nhận Phản Ánh & Khiếu Nại</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ghi nhận khiếu nại mới của khách hàng vào hệ thống</p>
                </div>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                {/* Select Customer */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Khách Hàng Phản Ánh *</label>
                  <select
                    value={newCustId}
                    onChange={e => setNewCustId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                  >
                    <option value="inv-1">Lê Văn C (HĐMB Căn CH-1204)</option>
                    <option value="inv-2">Phạm Thị D (Khách đầu tư tiềm năng)</option>
                  </select>
                </div>

                {/* Priority & Category Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Mức Độ Khần *</label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value as TicketPriority)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                    >
                      <option value="CRITICAL">💥 CRITICAL (Khẩn cấp)</option>
                      <option value="HIGH">🔥 HIGH (Cao)</option>
                      <option value="MEDIUM">⭐ MEDIUM (Thường)</option>
                      <option value="LOW">💤 LOW (Thấp)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Phân Loại *</label>
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value as TicketCategory)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                    >
                      <option value="SERVICE_QUALITY">Chất lượng dịch vụ</option>
                      <option value="BILLING">Thanh toán & Lãi phạt</option>
                      <option value="TECHNICAL">Kỹ thuật & Thiết kế</option>
                      <option value="GENERAL">Câu hỏi tổng quát</option>
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tiêu Đề Phản Ánh *</label>
                  <input
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    placeholder="VD: Trễ hạn nộp hồ sơ xin cấp sổ đỏ"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Chi Tiết Phản Ánh / Yêu Cầu *</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    rows={4}
                    placeholder="Mô tả cụ thể sự việc phản ánh của khách hàng..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 resize-none h-24"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Bỏ Qua
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black text-sm rounded-xl transition shadow-sm"
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
