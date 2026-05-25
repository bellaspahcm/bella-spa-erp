'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  FileSpreadsheet, 
  RefreshCw, 
  Calendar, 
  HelpCircle,
  TrendingUp,
  Download,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { 
  getTrialBalanceReport, 
  getIncomeStatementReport, 
  getBalanceSheetReport, 
  getAccountLedgerReport,
  getAccounts
} from '@/services/accounting-actions';
import { exportAccountingReportToExcel } from '@/services/export-actions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { toast } from 'sonner';

const reportTabs = [
  { value: 'trial_balance', label: 'Bảng cân đối phát sinh' },
  { value: 'income_statement', label: 'Báo cáo Kết quả KD (P&L)' },
  { value: 'balance_sheet', label: 'Bảng Cân đối Kế toán' },
  { value: 'account_ledger', label: 'Sổ chi tiết tài khoản' },
];

export default function AccountingReportsPage() {
  const [activeTab, setActiveTab] = useState<string>('trial_balance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dynamic report data states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [accountLedger, setAccountLedger] = useState<any[]>([]);

  // Filtering metadata
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of the month
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Fetch accounts list (specifically for the ledger report account selector)
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await getAccounts();
        setAccounts(data || []);
        if (data && data.length > 0) {
          setSelectedAccountId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching accounts for report selector:', err);
      }
    };
    loadAccounts();
  }, []);

  const loadReportData = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'trial_balance') {
        const data = await getTrialBalanceReport(asOfDate);
        setTrialBalance(data || []);
      } else if (activeTab === 'income_statement') {
        const data = await getIncomeStatementReport(fromDate, toDate);
        setIncomeStatement(data);
      } else if (activeTab === 'balance_sheet') {
        const data = await getBalanceSheetReport(asOfDate);
        setBalanceSheet(data);
      } else if (activeTab === 'account_ledger' && selectedAccountId) {
        const data = await getAccountLedgerReport(selectedAccountId, fromDate, toDate);
        setAccountLedger(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching report data:', err);
      toast.error('Không thể tải dữ liệu báo cáo tài chính.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab, asOfDate, fromDate, toDate, selectedAccountId]);

  // Trigger base64 compilation and force local browser download
  const handleExportExcel = async () => {
    setRefreshing(true);
    try {
      let reportData: any = null;
      let dateString = '';

      if (activeTab === 'trial_balance') {
        reportData = trialBalance;
        dateString = asOfDate;
      } else if (activeTab === 'income_statement') {
        reportData = incomeStatement;
        dateString = `${fromDate} đến ${toDate}`;
      } else if (activeTab === 'balance_sheet') {
        reportData = balanceSheet;
        dateString = asOfDate;
      }

      if (!reportData) {
        toast.warning('Không có dữ liệu báo cáo để xuất.');
        return;
      }

      const base64 = await exportAccountingReportToExcel(activeTab as any, reportData, dateString);
      
      // Force download via trigger
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
      link.download = `Bao_Cao_Ke_Toan_${activeTab.toUpperCase()}_TT133.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Báo cáo Excel đã được xuất thành công!');
    } catch (err: any) {
      console.error('Excel export failed:', err);
      toast.error('Gặp lỗi khi xuất tệp tin Excel.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Sync indicator spinner */}
      {refreshing && (
        <div className="absolute top-0 right-0 flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-[#A67D44] animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Đang tạo báo cáo...</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 flex-wrap">
        {/* Switch report type tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-50 dark:bg-[#11100F] p-1.5 rounded-2xl border border-slate-100 dark:border-none w-fit max-w-full shrink-0">
          {reportTabs.map((t) => (
            <button 
              key={t.value}
              onClick={() => { setActiveTab(t.value); setLoading(true); }}
              className={`px-4 py-2.5 rounded-xl text-3xs font-black uppercase tracking-widest transition-all shrink-0 cursor-pointer ${
                activeTab === t.value 
                  ? 'bg-slate-900 text-white dark:bg-[#5D1C34] dark:text-[#EFE9E1]' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-[#EFE9E1]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dynamic Filters Bar based on active tab */}
        <div className="flex flex-wrap items-center gap-4 shrink-0">
          {activeTab === 'trial_balance' || activeTab === 'balance_sheet' ? (
            <div className="flex items-center gap-2">
              <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tính đến ngày:</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="pl-10 pr-3 py-2 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]" 
                />
              </div>
            </div>
          ) : activeTab === 'account_ledger' ? (
            <div className="flex flex-wrap items-center gap-4">
              {/* Account Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tài khoản:</span>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.account_code}] - {a.account_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Ranges */}
              <div className="flex items-center gap-2">
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Từ ngày:</span>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3.5 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]" 
                />
                <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Đến:</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3.5 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]" 
                />
              </div>
            </div>
          ) : (
            // P&L Date Range
            <div className="flex items-center gap-2">
              <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Từ ngày:</span>
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]" 
              />
              <span className="text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Đến ngày:</span>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3.5 py-1.5 bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35]/50 rounded-xl text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1]" 
              />
            </div>
          )}

          {/* Export Excel Button (Hidden in Ledger view for demo simplicity) */}
          {activeTab !== 'account_ledger' && (
            <button 
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-black transition-all shadow-md shadow-emerald-100 uppercase tracking-widest text-3xs shrink-0 active:scale-95 cursor-pointer border-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel TT133</span>
            </button>
          )}
        </div>
      </div>

      {/* ── REPORT CONTENT DISPLAY ── */}
      <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
        {loading ? (
          <SkeletonTable />
        ) : activeTab === 'trial_balance' ? (
          /* ==========================================
             1. BẢNG CÂN ĐỐI PHÁT SINH (TRIAL BALANCE)
             ========================================== */
          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider text-center">BẢNG CÂN ĐỐI PHÁT SINH TÀI KHOẢN (TT 133/2016/TT-BTC)</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                    <th rowSpan={2} className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest border-r border-slate-100 dark:border-[#3E3A35]/20">Mã TK</th>
                    <th rowSpan={2} className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest border-r border-slate-100 dark:border-[#3E3A35]/20">Tên Tài Khoản</th>
                    <th colSpan={2} className="px-4 py-2 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center border-b border-r border-slate-100 dark:border-[#3E3A35]/20">Số dư đầu kỳ</th>
                    <th colSpan={2} className="px-4 py-2 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center border-b border-r border-slate-100 dark:border-[#3E3A35]/20">Số phát sinh trong kỳ</th>
                    <th colSpan={2} className="px-4 py-2 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center border-b border-slate-100 dark:border-[#3E3A35]/20">Số dư cuối kỳ</th>
                  </tr>
                  <tr className="text-right bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40 text-4xs uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-2 border-r border-slate-100 dark:border-[#3E3A35]/20">Nợ</th>
                    <th className="px-4 py-2 border-r border-slate-100 dark:border-[#3E3A35]/20">Có</th>
                    <th className="px-4 py-2 border-r border-slate-100 dark:border-[#3E3A35]/20">Nợ</th>
                    <th className="px-4 py-2 border-r border-slate-100 dark:border-[#3E3A35]/20">Có</th>
                    <th className="px-4 py-2 border-r border-slate-100 dark:border-[#3E3A35]/20">Nợ</th>
                    <th className="px-4 py-2">Có</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-mono text-2xs">
                  {trialBalance.map((row) => (
                    <tr key={row.account_id} className="hover:bg-slate-50/40 dark:hover:bg-[#11100F]/10 transition-colors">
                      <td className="px-4 py-3 font-black text-slate-800 dark:text-[#EFE9E1] border-r border-slate-100 dark:border-[#3E3A35]/20">{row.account_code}</td>
                      <td className="px-4 py-3 font-sans font-semibold text-slate-600 dark:text-[#CDBCAB] border-r border-slate-100 dark:border-[#3E3A35]/20 text-xs">{row.account_name}</td>
                      
                      <td className="px-4 py-3 text-right border-r border-slate-100 dark:border-[#3E3A35]/20 text-slate-700 dark:text-[#EFE9E1]/85">{Number(row.opening_debit) > 0 ? Number(row.opening_debit).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right border-r border-slate-100 dark:border-[#3E3A35]/20 text-slate-700 dark:text-[#EFE9E1]/85">{Number(row.opening_credit) > 0 ? Number(row.opening_credit).toLocaleString() : '-'}</td>
                      
                      <td className="px-4 py-3 text-right border-r border-slate-100 dark:border-[#3E3A35]/20 text-slate-700 dark:text-[#EFE9E1]/85">{Number(row.period_debit) > 0 ? Number(row.period_debit).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right border-r border-slate-100 dark:border-[#3E3A35]/20 text-slate-700 dark:text-[#EFE9E1]/85">{Number(row.period_credit) > 0 ? Number(row.period_credit).toLocaleString() : '-'}</td>
                      
                      <td className="px-4 py-3 text-right border-r border-slate-100 dark:border-[#3E3A35]/20 font-black text-slate-900 dark:text-[#EFE9E1]">{Number(row.closing_debit) > 0 ? Number(row.closing_debit).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-[#EFE9E1]">{Number(row.closing_credit) > 0 ? Number(row.closing_credit).toLocaleString() : '-'}</td>
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr className="bg-slate-50 dark:bg-[#11100F]/30 font-black border-t border-slate-200 dark:border-[#3E3A35]">
                    <td colSpan={2} className="px-4 py-4 font-sans text-xs text-slate-800 dark:text-[#EFE9E1] uppercase tracking-wider border-r border-slate-100 dark:border-[#3E3A35]/20">TỔNG CỘNG</td>
                    <td className="px-4 py-4 text-right border-r border-slate-100 dark:border-[#3E3A35]/20">{trialBalance.reduce((sum, r) => sum + Number(r.opening_debit), 0).toLocaleString()}đ</td>
                    <td className="px-4 py-4 text-right border-r border-slate-100 dark:border-[#3E3A35]/20">{trialBalance.reduce((sum, r) => sum + Number(r.opening_credit), 0).toLocaleString()}đ</td>
                    <td className="px-4 py-4 text-right border-r border-slate-100 dark:border-[#3E3A35]/20">{trialBalance.reduce((sum, r) => sum + Number(r.period_debit), 0).toLocaleString()}đ</td>
                    <td className="px-4 py-4 text-right border-r border-slate-100 dark:border-[#3E3A35]/20">{trialBalance.reduce((sum, r) => sum + Number(r.period_credit), 0).toLocaleString()}đ</td>
                    <td className="px-4 py-4 text-right border-r border-slate-100 dark:border-[#3E3A35]/20">{trialBalance.reduce((sum, r) => sum + Number(r.closing_debit), 0).toLocaleString()}đ</td>
                    <td className="px-4 py-4 text-right">{trialBalance.reduce((sum, r) => sum + Number(r.closing_credit), 0).toLocaleString()}đ</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'income_statement' ? (
          /* ==========================================
             2. BÁO CÁO KẾT QUẢ KINH DOANH (P&L)
             ========================================== */
          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider text-center">BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH (TT 133/2016/TT-BTC)</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Chỉ tiêu</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Mã số</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Thuyết minh</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số phát sinh Kỳ này (VND)</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Kỳ trước (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-sans text-xs">
                  {(() => {
                    const pnl = incomeStatement || {};
                    const items = [
                      { label: '1. Doanh thu bán hàng và cung cấp dịch vụ', code: '01', val: pnl.gross_revenue, isBold: true },
                      { label: '2. Các khoản giảm trừ doanh thu (Refunds, Voucher)', code: '02', val: pnl.deductions, isBold: false },
                      { label: '3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)', code: '10', val: pnl.net_revenue, isBold: true },
                      { label: '4. Giá vốn hàng bán (Vật tư tiêu hao trị liệu)', code: '11', val: pnl.cost_of_goods_sold, isBold: false },
                      { label: '5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)', code: '20', val: pnl.gross_profit, isBold: true },
                      { label: '6. Doanh thu hoạt động tài chính (Lãi tiền gửi)', code: '21', val: pnl.financial_income, isBold: false },
                      { label: '7. Chi phí tài chính', code: '22', val: pnl.financial_expense, isBold: false },
                      { label: '8. Chi phí quản lý kinh doanh (Lương KTV + Hoa hồng + Mặt bằng)', code: '24', val: pnl.operating_expense, isBold: false },
                      { label: '9. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 24)', code: '30', val: pnl.operating_profit, isBold: true },
                      { label: '10. Thu nhập khác', code: '31', val: pnl.other_income, isBold: false },
                      { label: '11. Chi phí khác', code: '32', val: pnl.other_expense, isBold: false },
                      { label: '12. Lợi nhuận khác (40 = 31 - 32)', code: '40', val: (pnl.other_income || 0) - (pnl.other_expense || 0), isBold: true },
                      { label: '13. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)', code: '50', val: pnl.profit_before_tax, isBold: true },
                      { label: '14. Chi phí thuế thu nhập doanh nghiệp (821)', code: '51', val: pnl.tax_expense, isBold: false },
                      { label: '15. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51)', code: '60', val: pnl.net_profit, isBold: true },
                    ];

                    return items.map((item, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50/40 dark:hover:bg-[#11100F]/10 transition-colors ${
                        item.isBold ? 'font-black bg-slate-50/20 dark:bg-[#11100F]/20 text-slate-900 dark:text-[#EFE9E1]' : 'text-slate-600 dark:text-[#CDBCAB]'
                      }`}>
                        <td className="px-6 py-3.5 text-xs">{item.label}</td>
                        <td className="px-6 py-3.5 text-center font-mono font-bold">{item.code}</td>
                        <td className="px-6 py-3.5 text-center font-bold">—</td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-[#EFE9E1]">
                          {Number(item.val || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-slate-300">0đ</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'balance_sheet' ? (
          /* ==========================================
             3. BẢNG CÂN ĐỐI KẾ TOÁN (BALANCE SHEET)
             ========================================== */
          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider text-center">BẢNG CÂN ĐỐI KẾ TOÁN (TT 133/2016/TT-BTC)</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Tài sản / Nguồn vốn</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Mã số</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Thuyết minh</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số cuối kỳ (VND)</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số đầu năm (VND)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-sans text-xs">
                  {(() => {
                    const bs = balanceSheet || {};
                    const items = [
                      // ASSETS
                      { label: 'A - TÀI SẢN (ASSETS)', code: '100', val: bs.total_assets, isBold: true, isRed: false },
                      { label: 'I. Tiền và các khoản tương đương tiền (111 + 112)', code: '110', val: bs.cash_and_equivalents, isBold: false, isRed: false },
                      { label: 'II. Phải thu khách hàng ngắn hạn (131 + 138)', code: '120', val: bs.accounts_receivable, isBold: false, isRed: false },
                      { label: 'III. Hàng tồn kho (Vật tư massage 152 + 153)', code: '130', val: bs.inventory, isBold: false, isRed: false },
                      { label: 'IV. Tài sản cố định hữu hình - Nguyên giá (211)', code: '140', val: bs.fixed_assets_cost, isBold: false, isRed: false },
                      { label: 'V. Hao mòn lũy kế tài sản cố định (214)', code: '141', val: -Math.abs(bs.accumulated_depreciation || 0), isBold: false, isRed: true },
                      { label: 'VI. Chi phí trả trước (Mặt bằng 242)', code: '150', val: bs.prepaid_expenses, isBold: false, isRed: false },
                      { label: 'TỔNG CỘNG TÀI SẢN', code: '200', val: bs.total_assets, isBold: true, isRed: false },
                      
                      // LIABILITIES
                      { label: 'B - NỢ PHẢI TRẢ (LIABILITIES)', code: '300', val: bs.total_liabilities, isBold: true, isRed: false },
                      { label: 'I. Phải trả người bán ngắn hạn (331)', code: '310', val: bs.accounts_payable, isBold: false, isRed: false },
                      { label: 'II. Thuế và các khoản phải nộp nhà nước (333)', code: '320', val: bs.taxes_payable, isBold: false, isRed: false },
                      { label: 'III. Phải trả người lao động (Lương KTV 334)', code: '330', val: bs.employee_payables, isBold: false, isRed: false },
                      { label: 'IV. Doanh thu chưa thực hiện (3387)', code: '340', val: bs.unearned_revenue, isBold: false, isRed: false },
                      { label: 'V. Phải trả ngắn hạn khác (335 + 338)', code: '350', val: bs.other_payables, isBold: false, isRed: false },
                      { label: 'TỔNG CỘNG NỢ PHẢI TRẢ', code: '390', val: bs.total_liabilities, isBold: true, isRed: false },
                      
                      // EQUITY
                      { label: 'C - VỐN CHỦ SỞ HỮU (OWNERS EQUITY)', code: '400', val: bs.total_equity, isBold: true, isRed: false },
                      { label: 'I. Vốn đầu tư của chủ sở hữu (411)', code: '410', val: bs.owners_capital, isBold: false, isRed: false },
                      { label: 'II. Lợi nhuận sau thuế chưa phân phối (421 + P&L kỳ này)', code: '420', val: bs.retained_earnings, isBold: false, isRed: false },
                      { label: 'TỔNG CỘNG VỐN CHỦ SỞ HỮU', code: '430', val: bs.total_equity, isBold: true, isRed: false },
                      { label: 'TỔNG CỘNG NGUỒN VỐN (TỔNG LIABILITIES + EQUITY)', code: '440', val: bs.total_equity_and_liabilities, isBold: true, isRed: false },
                    ];

                    return items.map((item, idx) => (
                      <tr key={idx} className={`hover:bg-slate-50/40 dark:hover:bg-[#11100F]/10 transition-colors ${
                        item.isBold ? 'font-black bg-slate-50/20 dark:bg-[#11100F]/20 text-slate-900 dark:text-[#EFE9E1]' : 'text-slate-600 dark:text-[#CDBCAB]'
                      }`}>
                        <td className="px-6 py-3.5 text-xs">{item.label}</td>
                        <td className="px-6 py-3.5 text-center font-mono font-bold">{item.code}</td>
                        <td className="px-6 py-3.5 text-center font-bold">—</td>
                        <td className={`px-6 py-3.5 text-right font-mono font-bold ${
                          item.isRed ? 'text-red-500 font-extrabold' : 'text-slate-900 dark:text-[#EFE9E1]'
                        }`}>
                          {item.isRed ? `(${Math.abs(Number(item.val || 0)).toLocaleString('vi-VN')})` : `${Number(item.val || 0).toLocaleString('vi-VN')}đ`}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-slate-300">0đ</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ==========================================
             4. SỔ CHI TIẾT TÀI KHOẢN (ACCOUNT LEDGER)
             ========================================== */
          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider text-center">SỔ CHI TIẾT TÀI KHOẢN KẾ TOÁN</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40 border-t border-slate-100 dark:border-[#3E3A35]/30">
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest font-mono">Ngày</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Nghiệp vụ (Diễn giải)</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">Loại Ref</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Phát sinh Nợ</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Phát sinh Có</th>
                    <th className="px-6 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số dư tích lũy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20 font-sans text-xs">
                  {accountLedger.map((row, idx) => {
                    const isOpening = row.description === 'Số dư đầu kỳ';

                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50/20 dark:hover:bg-[#11100F]/10 transition-colors ${
                          isOpening ? 'bg-slate-50/50 dark:bg-[#11100F]/20 font-black text-slate-900 dark:text-[#EFE9E1]' : 'text-slate-600 dark:text-[#CDBCAB]'
                        }`}
                      >
                        <td className="px-6 py-3.5 font-mono text-2xs text-slate-500 dark:text-[#CDBCAB]/80">{row.entry_date}</td>
                        <td className={`px-6 py-3.5 text-xs ${isOpening ? 'font-black' : 'font-medium'}`}>
                          {row.description}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {row.reference_type ? (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#3E3A35] rounded-md text-4xs font-black text-slate-400 dark:text-[#CDBCAB]/80 uppercase tracking-widest">
                              {row.reference_type}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-600">
                          {Number(row.debit_amount) > 0 ? `${Number(row.debit_amount).toLocaleString()}đ` : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-rose-600">
                          {Number(row.credit_amount) > 0 ? `${Number(row.credit_amount).toLocaleString()}đ` : '-'}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-black text-slate-900 dark:text-[#EFE9E1]">
                          {Number(row.running_balance).toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
