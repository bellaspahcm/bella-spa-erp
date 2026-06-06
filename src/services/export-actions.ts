'use server';

import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase-server';
import { getLocalDateString } from '@/lib/utils';
import { buildPackageMultiplierMap, getSessionPackageMultiplier } from '@/modules/hr-salary/actions/salary-attendance-calculation';
import { getCurrentUser } from '@/services/user-actions';

type SheetCell = string | number | null;
type SheetRow = SheetCell[];

type SalaryExportSession = {
  bookings?: {
    package_name?: string | null;
    ktv_commission?: number | null;
    packages?: { name?: string | null; session_multiplier?: number | null } | null;
    customers?: {
      name_mother?: string | null;
    } | null;
  } | null;
};

type SalaryExportRecord = {
  base_salary?: number | null;
  session_bonus?: number | null;
  rating_bonus?: number | null;
  kpi_bonus?: number | null;
  violations_deduction?: number | null;
  service_percentage_bonus?: number | null;
  total_salary?: number | null;
};

type SalaryExportPackage = {
  name: string | null;
  session_multiplier: number | null;
};

type PackageGroup = {
  name: string;
  sessions: number;
  commissionRate: number;
  totalEarnings: number;
  customerNames: Set<string>;
};

function toFiniteNumber(value: unknown): number {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export interface SessionMatrixRow {
  name: string;
  [packageName: string]: string | number | boolean | null | undefined;
}

export interface TrialBalanceExportRow {
  account_id?: string | number | null;
  account_code: string;
  account_name: string;
  opening_debit: string | number | null;
  opening_credit: string | number | null;
  period_debit: string | number | null;
  period_credit: string | number | null;
  closing_debit: string | number | null;
  closing_credit: string | number | null;
}

export type AccountingReportRecord = Record<string, string | number | null | undefined>;
export type AccountingReportData = TrialBalanceExportRow[] | AccountingReportRecord;

export async function exportSalaryToExcel(ktvId: string, ktvName: string, monthYear?: string) {
  try {
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) {
      throw new Error('Missing tenant for salary export');
    }
    const salaryMonthYear = monthYear ?? `${getLocalDateString().slice(0, 7)}-01`;
    const monthDate = new Date(salaryMonthYear);
    const endOfMonthStr = getLocalDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1));

    // 1. Fetch completed sessions for this KTV in this month
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select('*, bookings(*, customers(name_mother), packages(name, session_multiplier))')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed')
      .eq('tenant_id', tenantId)
      .gte('completed_date', salaryMonthYear)
      .lt('completed_date', endOfMonthStr);

    if (sessionsError) throw sessionsError;

    // 2. Fetch salary record for fixed amounts
    const { data: record, error: salaryRecordError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', salaryMonthYear)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (salaryRecordError) throw salaryRecordError;

    const { data: packages, error: packagesError } = await supabase
      .from('packages')
      .select('name, session_multiplier')
      .eq('tenant_id', tenantId);

    if (packagesError) throw packagesError;

    const packageMultiplierMap = buildPackageMultiplierMap((packages || []) as SalaryExportPackage[]);

    // 3. Process data into groups by package
    const packageGroups: Record<string, PackageGroup> = {};
    const sessionRows = (sessions || []) as unknown as SalaryExportSession[];
    sessionRows.forEach((s) => {
      const packageName = s.bookings?.package_name || 'Dịch vụ lẻ';
      const sessionWeight = getSessionPackageMultiplier(s, packageMultiplierMap);
      if (!packageGroups[packageName]) {
        packageGroups[packageName] = {
          name: packageName,
          sessions: 0,
          commissionRate: s.bookings?.ktv_commission || 150000,
          totalEarnings: 0,
          customerNames: new Set<string>()
        };
      }
      packageGroups[packageName].sessions += sessionWeight;
      packageGroups[packageName].totalEarnings += (s.bookings?.ktv_commission || 150000);
      if (s.bookings?.customers?.name_mother) {
        packageGroups[packageName].customerNames.add(s.bookings.customers.name_mother);
      }
    });

    // 4. Create Workbook
    const wb = XLSX.utils.book_new();
    
    // Header Data
    const reportData: SheetRow[] = [
      ['BÁO CÁO CHI TIẾT LƯƠNG KTV'],
      ['Kỹ thuật viên:', ktvName],
      ['Tháng/Năm:', salaryMonthYear],
      ['Ngày xuất báo cáo:', new Date().toLocaleDateString('vi-VN')],
      [],
      ['CHI TIẾT THEO GÓI DỊCH VỤ'],
      ['STT', 'Tên gói/Dịch vụ', 'Số buổi', 'Đơn giá/buổi', 'Thành tiền', 'Khách hàng'],
    ];

    let stt = 1;
    let totalSessionBonus = 0;
    Object.values(packageGroups).forEach((group) => {
      reportData.push([
        stt++,
        group.name,
        group.sessions,
        group.commissionRate.toLocaleString('vi-VN') + 'đ',
        group.totalEarnings.toLocaleString('vi-VN') + 'đ',
        Array.from(group.customerNames).join(', ')
      ]);
      totalSessionBonus += group.totalEarnings;
    });

    const salaryRecord = record as SalaryExportRecord | null;
    const baseSalary = Number(salaryRecord?.base_salary ?? 0);
    const sessionBonus = Number(salaryRecord?.session_bonus ?? totalSessionBonus);
    const ratingBonus = Number(salaryRecord?.rating_bonus ?? 0);
    const kpiBonus = Number(salaryRecord?.kpi_bonus ?? 0);
    const deductions = Number(salaryRecord?.violations_deduction ?? 0);
    const advances = Number(salaryRecord?.service_percentage_bonus ?? 0);
    const totalFinal = Number(
      salaryRecord?.total_salary ?? Math.max(0, baseSalary + sessionBonus + ratingBonus + kpiBonus - deductions - advances),
    );
    const weightedSessionTotal = Object.values(packageGroups).reduce((sum, group) => sum + group.sessions, 0);

    reportData.push(
      [],
      ['TỔNG HỢP THU NHẬP & CHI PHÍ'],
      ['1. Lương cơ bản', '', '', '', baseSalary.toLocaleString('vi-VN') + 'đ'],
      ['2. Tổng hoa hồng buổi diễn', '', weightedSessionTotal + ' buổi', '', sessionBonus.toLocaleString('vi-VN') + 'đ'],
      ['3. Thưởng chất lượng', '', '', '', ratingBonus.toLocaleString('vi-VN') + 'đ'],
      ['4. Thưởng KPI/Chuyên cần', '', '', '', kpiBonus.toLocaleString('vi-VN') + 'đ'],
      ['5. Các khoản giảm trừ (Vi phạm)', '', '', '', '-' + deductions.toLocaleString('vi-VN') + 'đ'],
      ['6. Tạm ứng', '', '', '', '-' + advances.toLocaleString('vi-VN') + 'đ'],
      ['TỔNG THỰC NHẬN', '', '', '', totalFinal.toLocaleString('vi-VN') + 'đ'],
      [],
      ['XÁC NHẬN CỦA KTV', '', '', 'XÁC NHẬN CỦA QUẢN LÝ'],
      ['(Ký và ghi rõ họ tên)', '', '', '(Ký và ghi rõ họ tên)']
    );

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    
    // Styling hints (XLSX basic doesn't support full style without pro, but we can set column widths)
    ws['!cols'] = [
      { wch: 5 },  // STT
      { wch: 30 }, // Tên gói
      { wch: 10 }, // Số buổi
      { wch: 15 }, // Đơn giá
      { wch: 20 }, // Thành tiền
      { wch: 40 }, // Khách hàng
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Bang Luong Chi Tiet');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Return as base64 to avoid complex stream handling in server actions
    return buf.toString('base64');

  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

export async function exportSessionMatrixToExcel(data: SessionMatrixRow[], packageNames: string[]) {
  try {
    const wb = XLSX.utils.book_new();
    
    // 1. Prepare data for AOA (Array of Arrays)
    const reportData: SheetRow[] = [
      ['BẢNG ĐỐI SOÁT CHI TIẾT SỐ BUỔI LÀM THEO LIỆU TRÌNH'],
      ['Kỳ lương:', '05/2026'],
      ['Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
      [],
      ['Kỹ thuật viên', ...packageNames, 'Tổng cộng']
    ];

    data.forEach((row) => {
      const rowData: SheetRow = [row.name];
      let total = 0;
      packageNames.forEach((pkg: string) => {
        const count = toFiniteNumber(row[pkg]);
        rowData.push(count);
        total += count;
      });
      rowData.push(total);
      reportData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    
    // Set column widths
    const cols = [{ wch: 25 }]; // KTV name
    packageNames.forEach(() => cols.push({ wch: 15 }));
    cols.push({ wch: 15 }); // Total
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, 'Doi Soat Buoi Lam');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf.toString('base64');
  } catch (error) {
    console.error('Export matrix error:', error);
    throw error;
  }
}

/**
 * Export Accounting Reports (Trial Balance, Income Statement, Balance Sheet) to Excel (Thông tư 133)
 */
export async function exportAccountingReportToExcel(
  reportType: 'trial_balance' | 'income_statement' | 'balance_sheet' | 'cash_flow',
  data: AccountingReportData,
  dateStr: string
) {
  try {
    const wb = XLSX.utils.book_new();
    const sheetData: SheetRow[] = [];

    if (reportType === 'trial_balance') {
      // BẢNG CÂN ĐỐI PHÁT SINH
      sheetData.push(
        ['BẢNG CÂN ĐỐI PHÁT SINH TÀI KHOẢN (TT 133/2016/TT-BTC)'],
        ['Chi nhánh Spa:', 'Bella Spa ERP'],
        ['Kỳ báo cáo:', `Đến ngày ${dateStr}`],
        ['Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
        [],
        [
          'Mã tài khoản',
          'Tên tài khoản',
          'Số dư đầu kỳ',
          '',
          'Số phát sinh trong kỳ',
          '',
          'Số dư cuối kỳ',
          '',
        ],
        ['', '', 'Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có']
      );

      let sumOpDebit = 0;
      let sumOpCredit = 0;
      let sumPdDebit = 0;
      let sumPdCredit = 0;
      let sumClDebit = 0;
      let sumClCredit = 0;

      const rows = Array.isArray(data) ? data : [];
      rows.forEach((row) => {
        sheetData.push([
          row.account_code,
          row.account_name,
          row.opening_debit,
          row.opening_credit,
          row.period_debit,
          row.period_credit,
          row.closing_debit,
          row.closing_credit,
        ]);

        sumOpDebit += Number(row.opening_debit || 0);
        sumOpCredit += Number(row.opening_credit || 0);
        sumPdDebit += Number(row.period_debit || 0);
        sumPdCredit += Number(row.period_credit || 0);
        sumClDebit += Number(row.closing_debit || 0);
        sumClCredit += Number(row.closing_credit || 0);
      });

      // Tổng cộng row
      sheetData.push([
        'TỔNG CỘNG',
        '',
        sumOpDebit,
        sumOpCredit,
        sumPdDebit,
        sumPdCredit,
        sumClDebit,
        sumClCredit,
      ]);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      
      // Column widths
      ws['!cols'] = [
        { wch: 15 }, // Mã
        { wch: 35 }, // Tên
        { wch: 18 }, // Dư đầu Nợ
        { wch: 18 }, // Dư đầu Có
        { wch: 18 }, // Phát sinh Nợ
        { wch: 18 }, // Phát sinh Có
        { wch: 18 }, // Dư cuối Nợ
        { wch: 18 }, // Dư cuối Có
      ];

      // Merge header columns for Nợ / Có
      ws['!merges'] = [
        { s: { r: 5, c: 2 }, e: { r: 5, c: 3 } }, // Số dư đầu kỳ
        { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } }, // Phát sinh trong kỳ
        { s: { r: 5, c: 6 }, e: { r: 5, c: 7 } }, // Số dư cuối kỳ
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');

    } else if (reportType === 'income_statement') {
      // BÁO CÁO KẾT QUẢ KINH DOANH (P&L)
      const pnl = Array.isArray(data) ? {} : data;
      sheetData.push(
        ['BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH (TT 133/2016/TT-BTC)'],
        ['Chi nhánh Spa:', 'Bella Spa ERP'],
        ['Kỳ báo cáo:', `Từ ngày ${dateStr}`],
        ['Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
        [],
        ['Chỉ tiêu', 'Mã số', 'Thuyết minh', 'Kỳ này (VND)', 'Kỳ trước (VND)'],
        ['1. Doanh thu bán hàng và cung cấp dịch vụ', '01', '', pnl.gross_revenue || 0, 0],
        ['2. Các khoản giảm trừ doanh thu (Refund, voucher)', '02', '', pnl.deductions || 0, 0],
        ['3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)', '10', '', pnl.net_revenue || 0, 0],
        ['4. Giá vốn hàng bán (Vật tư tiêu hao ca làm)', '11', '', pnl.cost_of_goods_sold || 0, 0],
        ['5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)', '20', '', pnl.gross_profit || 0, 0],
        ['6. Doanh thu hoạt động tài chính', '21', '', pnl.financial_income || 0, 0],
        ['7. Chi phí tài chính', '22', '', pnl.financial_expense || 0, 0],
        ['8. Chi phí quản lý kinh doanh (Hoa hồng + Thưởng + Vận hành)', '24', '', pnl.operating_expense || 0, 0],
        ['9. Lợi nhuận thuần từ hoạt động kinh doanh (30 = 20 + 21 - 22 - 24)', '30', '', pnl.operating_profit || 0, 0],
        ['10. Thu nhập khác', '31', '', pnl.other_income || 0, 0],
        ['11. Chi phí khác', '32', '', pnl.other_expense || 0, 0],
        ['12. Lợi nhuận khác (40 = 31 - 32)', '40', '', Number(pnl.other_income || 0) - Number(pnl.other_expense || 0), 0],
        ['13. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)', '50', '', pnl.profit_before_tax || 0, 0],
        ['14. Chi phí thuế thu nhập doanh nghiệp', '51', '', pnl.tax_expense || 0, 0],
        ['15. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51)', '60', '', pnl.net_profit || 0, 0]
      );

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 60 }, // Chỉ tiêu
        { wch: 10 }, // Mã số
        { wch: 15 }, // Thuyết minh
        { wch: 22 }, // Kỳ này
        { wch: 22 }, // Kỳ trước
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Profit and Loss');

    } else if (reportType === 'balance_sheet') {
      // CÂN ĐỐI KẾ TOÁN
      const bs = Array.isArray(data) ? {} : data;
      sheetData.push(
        ['BẢNG CÂN ĐỐI KẾ TOÁN (TT 133/2016/TT-BTC)'],
        ['Chi nhánh Spa:', 'Bella Spa ERP'],
        ['Tại ngày:', dateStr],
        ['Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
        [],
        ['Tài sản / Nguồn vốn', 'Mã số', 'Thuyết minh', 'Số cuối kỳ (VND)', 'Số đầu năm (VND)'],
        ['A - TÀI SẢN NGẮN HẠN & DÀI HẠN', '100', '', bs.total_assets || 0, 0],
        ['I. Tiền và các khoản tương đương tiền (111 + 112)', '110', '', bs.cash_and_equivalents || 0, 0],
        ['II. Phải thu ngắn hạn khách hàng (131 + 138)', '120', '', bs.accounts_receivable || 0, 0],
        ['III. Hàng tồn kho (Vật tư massage, tinh dầu 152 + 153)', '130', '', bs.inventory || 0, 0],
        ['IV. Tài sản cố định hữu hình - Nguyên giá (211)', '140', '', bs.fixed_assets_cost || 0, 0],
        ['V. Hao mòn lũy kế tài sản cố định (214)', '141', '', -Math.abs(Number(bs.accumulated_depreciation || 0)), 0],
        ['VI. Chi phí trả trước (Thuê nhà mặt bằng dài hạn 242)', '150', '', bs.prepaid_expenses || 0, 0],
        ['BỔNG CỘNG TÀI SẢN', '200', '', bs.total_assets || 0, 0],
        [],
        ['B - NỢ PHẢI TRẢ (LIABILITIES)', '300', '', bs.total_liabilities || 0, 0],
        ['I. Phải trả người bán ngắn hạn (331)', '310', '', bs.accounts_payable || 0, 0],
        ['II. Thuế và các khoản phải nộp nhà nước (333)', '320', '', bs.taxes_payable || 0, 0],
        ['III. Phải trả người lao động (334)', '330', '', bs.employee_payables || 0, 0],
        ['IV. Doanh thu chưa thực hiện (Gói trị liệu chưa dùng 3387)', '340', '', bs.unearned_revenue || 0, 0],
        ['V. Phải trả, phải nộp ngắn hạn khác (335 + 338)', '350', '', bs.other_payables || 0, 0],
        ['TỔNG CỘNG NỢ PHẢI TRẢ', '390', '', bs.total_liabilities || 0, 0],
        [],
        ['C - VỐN CHỦ SỞ HỮU (OWNERS EQUITY)', '400', '', bs.total_equity || 0, 0],
        ['I. Vốn đầu tư của chủ sở hữu (411)', '410', '', bs.owners_capital || 0, 0],
        ['II. Lợi nhuận sau thuế chưa phân phối (421 + P&L kỳ này)', '420', '', bs.retained_earnings || 0, 0],
        ['TỔNG CỘNG VỐN CHỦ SỞ HỮU', '430', '', bs.total_equity || 0, 0],
        ['TỔNG CỘNG NGUỒN VỐN (390 + 430)', '440', '', bs.total_equity_and_liabilities || 0, 0]
      );

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 60 }, // Tài sản / Nguồn vốn
        { wch: 10 }, // Mã số
        { wch: 15 }, // Thuyết minh
        { wch: 22 }, // Kỳ cuối
        { wch: 22 }, // Kỳ đầu
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');

    } else if (reportType === 'cash_flow') {
      // BÁO CÁO LƯU CHUYỂN TIỀN TỆ — Phương pháp gián tiếp (TT133)
      const cf = Array.isArray(data) ? {} : data;
      sheetData.push(
        ['BÁO CÁO LƯU CHUYỂN TIỀN TỆ — Phương pháp gián tiếp (TT 133/2016/TT-BTC)'],
        ['Chi nhánh Spa:', 'Bella Spa ERP'],
        ['Kỳ báo cáo:', dateStr],
        ['Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
        [],
        ['Chỉ tiêu', 'Mã số', 'Số tiền (VND)'],

        // I. OPERATING
        ['I. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG KINH DOANH', '20', cf.net_cash_operating || 0],
        ['1. Lợi nhuận trước thuế', '01', cf.profit_before_tax || 0],
        ['2. (+) Khấu hao tài sản cố định (214)', '02', cf.depreciation || 0],
        ['3. Điều chỉnh: (−) Tăng khoản phải thu (131)', '03', -Number(cf.change_in_receivables || 0)],
        ['4. Điều chỉnh: (−) Tăng hàng tồn kho (152, 153)', '04', -Number(cf.change_in_inventory || 0)],
        ['5. Điều chỉnh: (+) Tăng khoản phải trả (331, 333, 334, 338)', '05', cf.change_in_payables || 0],
        ['6. Điều chỉnh: (+) Tăng doanh thu chưa thực hiện (3387)', '06', cf.change_in_unearned_revenue || 0],
        ['7. (−) Chi phí thuế TNDN đã ghi nhận (821)', '07', -Number(cf.tax_paid || 0)],
        ['Lưu chuyển tiền thuần từ HĐKD', '20', cf.net_cash_operating || 0],
        [],

        // II. INVESTING
        ['II. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG ĐẦU TƯ', '30', cf.net_cash_investing || 0],
        ['1. (−) Chi mua sắm tài sản cố định (Δ 211)', '21', -Number(cf.fixed_assets_purchased || 0)],
        ['2. (+) Thu thanh lý tài sản cố định', '22', cf.fixed_assets_sold || 0],
        ['Lưu chuyển tiền thuần từ HĐĐT', '30', cf.net_cash_investing || 0],
        [],

        // III. FINANCING
        ['III. LƯU CHUYỂN TIỀN TỪ HOẠT ĐỘNG TÀI CHÍNH', '40', cf.net_cash_financing || 0],
        ['1. (+) Tiền góp vốn của chủ sở hữu (Δ 411)', '31', cf.owner_contributions || 0],
        ['2. (+) Tiền vay nợ ngân hàng', '33', cf.loans_received || 0],
        ['3. (−) Tiền trả nợ vay, cổ tức', '34', -Number(cf.loans_repaid || 0)],
        ['Lưu chuyển tiền thuần từ HĐTC', '40', cf.net_cash_financing || 0],
        [],

        // TOTALS
        ['TĂNG/GIẢM TIỀN THUẦN TRONG KỲ (I + II + III)', '50', cf.net_change_in_cash || 0],
        ['TIỀN VÀ TƯƠNG ĐƯƠNG TIỀN ĐẦU KỲ', '60', cf.opening_cash || 0],
        ['TIỀN VÀ TƯƠNG ĐƯƠNG TIỀN CUỐI KỲ (50 + 60)', '70', cf.closing_cash || 0]
      );

      if (Math.abs(Number(cf.verification_diff || 0)) > 1) {
        sheetData.push(
          [],
          ['⚠ Cảnh báo: sai lệch giữa (Tiền cuối - Tiền đầu) và Lưu chuyển thuần', '', cf.verification_diff || 0]
        );
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 70 }, // Chỉ tiêu
        { wch: 12 }, // Mã số
        { wch: 24 }, // Số tiền
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow Statement');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf.toString('base64');
  } catch (error) {
    console.error('Export accounting report error:', error);
    throw error;
  }
}

