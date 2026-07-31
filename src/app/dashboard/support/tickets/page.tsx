'use client';

import React, { useState } from 'react';
import {
  Ticket,
  Clock,
  UserCheck,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Search,
  Filter,
  User,
} from 'lucide-react';
import { SupportTicketItem } from '@/modules/support/ticket-resource-provider';

// Mock Initial Tickets using Generic Capability Types
const INITIAL_TICKETS: SupportTicketItem[] = [
  {
    id: 'tkt-001',
    tenantId: 'beauty_spa',
    ticketNumber: 'TKT-2026-0891',
    customerName: 'Trần Thị Thu Thảo',
    customerPhone: '0908 123 456',
    subject: 'Yêu cầu hỗ trợ thay đổi lịch hẹn dịch vụ Chăm sóc Mẹ & Bé VIP',
    priority: 'HIGH',
    category: 'SERVICE_QUALITY',
    state: 'NEW',
    noAnswerCount: 0,
    createdAt: '2026-07-31T15:30:00Z',
    updatedAt: '2026-07-31T15:30:00Z',
  },
  {
    id: 'tkt-002',
    tenantId: 'beauty_spa',
    ticketNumber: 'TKT-2026-0892',
    customerName: 'Nguyễn Văn Minh',
    customerPhone: '0912 987 654',
    subject: 'Thắc mắc hóa đơn VAT thanh toán combo dịch vụ Spa',
    priority: 'CRITICAL',
    category: 'BILLING',
    state: 'ASSIGNED',
    assignedToId: 'sp-01',
    assignedToName: 'Lê Thanh Hà (Tier-1 Support)',
    noAnswerCount: 1,
    createdAt: '2026-07-31T14:00:00Z',
    updatedAt: '2026-07-31T14:45:00Z',
  },
  {
    id: 'tkt-003',
    tenantId: 'beauty_spa',
    ticketNumber: 'TKT-2026-0893',
    customerName: 'Phạm Hồng Ánh',
    customerPhone: '0977 456 789',
    subject: 'Hỗ trợ kích hoạt tài khoản hội viên trên ứng dụng di động',
    priority: 'MEDIUM',
    category: 'TECHNICAL',
    state: 'IN_PROGRESS',
    assignedToId: 'sp-02',
    assignedToName: 'Nguyễn Tuấn Anh (Tier-2 Tech Support)',
    noAnswerCount: 0,
    createdAt: '2026-07-31T12:00:00Z',
    updatedAt: '2026-07-31T13:15:00Z',
  },
];

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>(INITIAL_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketItem | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Handle Ticket Assignment
  const handleAssign = (ticketId: string, agentName: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              state: 'ASSIGNED',
              assignedToId: 'sp-01',
              assignedToName: agentName,
              updatedAt: new Date().toISOString(),
            }
          : t
      )
    );
  };

  // Handle Ticket Accept
  const handleAccept = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, state: 'IN_PROGRESS', updatedAt: new Date().toISOString() }
          : t
      )
    );
  };

  // Handle Ticket Rotate (Switch to Tier-2 Agent)
  const handleRotate = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              state: 'ASSIGNED',
              assignedToId: 'sp-02',
              assignedToName: 'Hoàng Quốc Việt (Tier-2 Escalation Lead)',
              noAnswerCount: t.noAnswerCount + 1,
              updatedAt: new Date().toISOString(),
            }
          : t
      )
    );
  };

  // Handle Ticket Resolve
  const handleResolve = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, state: 'RESOLVED', updatedAt: new Date().toISOString() }
          : t
      )
    );
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/80 p-6 rounded-2xl border border-slate-700/60 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Ticket className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Customer Support Ticket Center
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Powered by Bella Capability Platform
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Phân hệ Quản lý Yêu cầu Hỗ trợ Khách hàng sử dụng chung 100% Generic Resource Capability Engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-900/60 rounded-xl border border-slate-700/50 text-xs space-y-1">
            <div className="text-slate-400">SLA Phản Hồi Ban Đầu (First Response):</div>
            <div className="font-semibold text-amber-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 15 phút (Quy định tự động)
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã Ticket, Tên khách hàng, Tiêu đề..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Độ Ưu Tiên:</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Tất cả Độ Ưu Tiên</option>
            <option value="CRITICAL">Khẩn Cấp (Critical)</option>
            <option value="HIGH">Cao (High)</option>
            <option value="MEDIUM">Trung Bình (Medium)</option>
            <option value="LOW">Thấp (Low)</option>
          </select>
        </div>
      </div>

      {/* Ticket Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTickets.map((ticket) => {
          const isCritical = ticket.priority === 'CRITICAL';
          const isHigh = ticket.priority === 'HIGH';

          return (
            <div
              key={ticket.id}
              className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-mono px-2.5 py-1 bg-slate-900/80 rounded-lg text-slate-300 border border-slate-700">
                    {ticket.ticketNumber}
                  </span>

                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      isCritical
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : isHigh
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                    }`}
                  >
                    {ticket.priority}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold text-white text-base line-clamp-2">{ticket.subject}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{ticket.customerName}</span>
                    <span>•</span>
                    <span>{ticket.customerPhone}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/40 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Trạng thái Workflow:</span>
                    <span className="font-semibold text-indigo-400">{ticket.state}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Hỗ trợ viên phụ trách:</span>
                    <span className="text-slate-200 font-medium">{ticket.assignedToName || 'Chưa phân công'}</span>
                  </div>

                  {ticket.noAnswerCount > 0 && (
                    <div className="flex items-center gap-1 text-rose-400 font-medium pt-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Đã xoay vòng {ticket.noAnswerCount} lần (SLA Escalated)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Capability Actions */}
              <div className="pt-3 border-t border-slate-700/50 flex flex-wrap items-center gap-2">
                {ticket.state === 'NEW' && (
                  <button
                    onClick={() => handleAssign(ticket.id, 'Lê Thanh Hà (Tier-1 Support)')}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Phân công Agent
                  </button>
                )}

                {ticket.state === 'ASSIGNED' && (
                  <>
                    <button
                      onClick={() => handleAccept(ticket.id)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận xử lý
                    </button>

                    <button
                      onClick={() => handleRotate(ticket.id)}
                      className="py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      title="Xoay vòng sang Tier-2 Support"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Xoay Tier-2
                    </button>
                  </>
                )}

                {ticket.state === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleResolve(ticket.id)}
                    className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn tất Ticket
                  </button>
                )}

                {ticket.state === 'RESOLVED' && (
                  <div className="flex-1 py-2 text-center text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn tất hỗ trợ
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
