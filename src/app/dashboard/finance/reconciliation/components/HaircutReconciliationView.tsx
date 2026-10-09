'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Loader2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@bella/shared';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { cn } from '@/lib/utils';
import {
  collectHaircutF3ReceivablePayment,
  getHaircutF3OpenReceivables,
  type HaircutF3DebtRow,
} from '@/services/haircut-f3-reconciliation-actions';

type PaymentMethod = 'bank_transfer' | 'cash';

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN').format(date);
}

function getAgeDays(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function getStatus(ageDays: number): 'overdue' | 'due_soon' | 'upcoming' {
  if (ageDays > 30) return 'overdue';
  if (ageDays > 7) return 'due_soon';
  return 'upcoming';
}

function buildNotes(row: HaircutF3DebtRow) {
  const booking = row.bookingNumber || row.bookingId.slice(0, 8).toUpperCase();
  return `Thu F3 receivable Haircut ${row.invoiceNumber} - booking ${booking}`;
}

export function HaircutReconciliationView() {
  const [rows, setRows] = useState<readonly HaircutF3DebtRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'due_soon' | 'upcoming'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [selectedRow, setSelectedRow] = useState<HaircutF3DebtRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [notes, setNotes] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);

  const refreshRows = async () => {
    setIsRefreshing(true);
    try {
      const result = await getHaircutF3OpenReceivables();
      if (!result.success) {
        toast.error(result.error || 'Không thể tải công nợ F3 Haircut');
        return;
      }
      setRows(result.data ?? []);
      setLastUpdated(new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date()));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshRows();
  }, []);

  const decoratedRows = useMemo(() => rows.map((row) => {
    const ageDays = getAgeDays(row.issueDate);
    return {
      ...row,
      ageDays,
      status: getStatus(ageDays),
    };
  }), [rows]);

  const filteredRows = decoratedRows.filter((row) => {
    const needle = searchTerm.trim().toLowerCase();
    const matchesSearch = !needle
      || row.customerName.toLowerCase().includes(needle)
      || row.customerPhone.includes(needle)
      || row.invoiceNumber.toLowerCase().includes(needle)
      || row.bookingNumber.toLowerCase().includes(needle)
      || row.packageName.toLowerCase().includes(needle);
    const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = filteredRows.reduce((sum, row) => sum + row.outstandingAmountMinor, 0);
  const overdueCount = decoratedRows.filter((row) => row.status === 'overdue').length;
  const dueSoonCount = decoratedRows.filter((row) => row.status === 'due_soon').length;

  const openCollection = (row: HaircutF3DebtRow) => {
    setSelectedRow(row);
    setPaymentAmount(String(row.outstandingAmountMinor));
    setPaymentMethod('bank_transfer');
    setNotes(buildNotes(row));
  };

  const confirmCollection = async () => {
    if (!selectedRow) return;
    const amountMinor = Number(paymentAmount);
    setIsCollecting(true);
    try {
      const result = await collectHaircutF3ReceivablePayment({
        invoiceId: selectedRow.invoiceId,
        amountMinor,
        paymentMethod,
        notes,
      });
      if (!result.success) {
        toast.error(result.error || 'Không thể thu công nợ F3');
        return;
      }
      toast.success(result.data?.duplicate ? 'Giao dịch đã tồn tại, không tạo trùng' : 'Đã thu và phân bổ F3 receivable');
      setSelectedRow(null);
      await refreshRows();
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/60 p-4 sm:p-8 space-y-6">
      <div className="flex flex-col gap-5">
        <div className="flex w-full overflow-x-auto items-center gap-1 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-sm sm:w-fit">
          <Link href="/dashboard/finance" className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all text-slate-500 hover:text-slate-900">
            Sổ nhật ký
          </Link>
          <Link href="/dashboard/finance/pnl" className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all text-slate-500 hover:text-slate-900">
            Lãi/Lỗ Chi Tiết
          </Link>
          <Link href="/dashboard/finance/reconciliation" className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all bg-slate-900 text-white shadow-sm">
            Đối soát công nợ
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Đối soát công nợ Haircut</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              F3 receivables từ session đã hoàn tất và chưa thu đủ.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lastUpdated && (
              <div className="text-right hidden sm:block">
                <span className="block text-[11px] font-medium text-slate-400">Cập nhật lần cuối</span>
                <span className="text-xs font-bold text-slate-700">{lastUpdated}</span>
              </div>
            )}
            <button
              onClick={() => void refreshRows()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 bg-primary text-white hover:bg-primary/90 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              Đối soát lại
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">F3 công nợ phải thu</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalOutstanding)}</h3>
            </div>
            <DollarSign className="w-9 h-9 rounded-xl bg-rose-50 p-2 text-rose-600" />
          </div>
          <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-500">
            {filteredRows.length} receivable đang mở
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Quá hạn</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{overdueCount}</h3>
            </div>
            <AlertTriangle className="w-9 h-9 rounded-xl bg-amber-50 p-2 text-amber-600" />
          </div>
          <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-500">
            Tính theo tuổi invoice F3
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Cần theo dõi</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{dueSoonCount}</h3>
            </div>
            <Clock className="w-9 h-9 rounded-xl bg-emerald-50 p-2 text-emerald-600" />
          </div>
          <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-medium text-slate-500">
            8-30 ngày từ ngày phát hành
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm khách hàng, invoice, booking hoặc dịch vụ..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <PremiumSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as typeof statusFilter)}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'overdue', label: 'Quá hạn' },
              { value: 'due_soon', label: 'Cần theo dõi' },
              { value: 'upcoming', label: 'Mới phát sinh' },
            ]}
            ariaLabel="Lọc trạng thái công nợ"
            className="w-full lg:w-44 space-y-0"
            buttonClassName="h-11 rounded-xl border-slate-200 bg-white px-3 py-2.5 text-xs font-bold shadow-none hover:border-primary/30"
            dropdownClassName="min-w-44"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Khách hàng</th>
                <th className="px-5 py-3 text-left">Invoice / Booking</th>
                <th className="px-5 py-3 text-left">Receivable</th>
                <th className="px-5 py-3 text-right">F3 outstanding</th>
                <th className="px-5 py-3 text-right">Tuổi nợ</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isRefreshing && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-primary" />
                    Đang tải F3 receivables...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-slate-500">
                    <CheckCircle2 className="w-7 h-7 mx-auto mb-3 text-emerald-500" />
                    Không có F3 receivable đang mở theo bộ lọc hiện tại.
                  </td>
                </tr>
              ) : filteredRows.map((row) => (
                <tr key={row.receivablePositionId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-extrabold text-slate-900">{row.customerName}</div>
                    <div className="text-xs font-medium text-slate-500">{row.customerPhone || row.customerId}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-slate-800">{row.invoiceNumber}</div>
                    <div className="text-xs text-slate-500">{row.bookingNumber || row.bookingId}</div>
                    <div className="text-xs text-slate-400">{row.packageName}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      F3 position
                    </div>
                    <div className="mt-1 text-[11px] font-mono text-slate-400">{row.receivablePositionId}</div>
                  </td>
                  <td className="px-5 py-4 text-right font-black text-rose-600">{formatCurrency(row.outstandingAmountMinor)}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="font-bold text-slate-800">{row.ageDays} ngày</div>
                    <div className="text-xs text-slate-400">{formatDate(row.issueDate)}</div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => openCollection(row)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Thu F3
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-5">
            <button
              onClick={() => setSelectedRow(null)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[11px] uppercase tracking-wider mb-2">
                <DollarSign className="w-3.5 h-3.5" />
                F3 receivable collection
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">Thu công nợ Haircut</h2>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">{selectedRow.customerName}</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {selectedRow.invoiceNumber} · {selectedRow.bookingNumber || selectedRow.bookingId}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 font-medium block">F3 outstanding</span>
                <span className="text-lg font-black text-rose-600">{formatCurrency(selectedRow.outstandingAmountMinor)}</span>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Số tiền thu (VND)</label>
                <input
                  type="number"
                  min={1}
                  max={selectedRow.outstandingAmountMinor}
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phương thức thanh toán</label>
                <PremiumSelect
                  value={paymentMethod}
                  onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  options={[
                    { value: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
                    { value: 'cash', label: 'Tiền mặt tại quầy' },
                  ]}
                  ariaLabel="Chọn phương thức thanh toán"
                  className="space-y-0"
                  buttonClassName="rounded-xl border-slate-200 bg-white px-4 py-2.5 text-xs font-bold shadow-none hover:border-primary/30"
                  dropdownClassName="min-w-full"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedRow(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={() => void confirmCollection()}
                disabled={isCollecting}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-60"
              >
                {isCollecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                Xác nhận thu F3
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
