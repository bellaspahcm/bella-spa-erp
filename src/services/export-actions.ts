'use server';

import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase-server';

export async function exportSalaryToExcel(ktvId: string, ktvName: string, monthYear: string = '2026-05-01') {
  try {
    const supabase = (await createClient()) as any;

    // 1. Fetch completed sessions for this KTV in this month
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select('*, bookings(*, customers(name_mother))')
      .eq('completed_by_ktv_id', ktvId)
      .eq('status', 'completed');

    if (sessionsError) throw sessionsError;

    // 2. Fetch salary record for fixed amounts
    const { data: record } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear)
      .single();

    // 3. Process data into groups by package
    const packageGroups: Record<string, any> = {};
    (sessions || []).forEach((s: any) => {
      const packageName = s.bookings?.package_name || 'Dịch vụ lẻ';
      if (!packageGroups[packageName]) {
        packageGroups[packageName] = {
          name: packageName,
          sessions: 0,
          commissionRate: s.bookings?.ktv_commission || 150000,
          totalEarnings: 0,
          customerNames: new Set()
        };
      }
      packageGroups[packageName].sessions += 1;
      packageGroups[packageName].totalEarnings += (s.bookings?.ktv_commission || 150000);
      if (s.bookings?.customers?.name_mother) {
        packageGroups[packageName].customerNames.add(s.bookings.customers.name_mother);
      }
    });

    // 4. Create Workbook
    const wb = XLSX.utils.book_new();
    
    // Header Data
    const reportData = [
      ['BÁO CÁO CHI TIẾT LƯƠNG KTV'],
      ['Kỹ thuật viên:', ktvName],
      ['Tháng/Năm:', monthYear],
      ['Ngày xuất báo cáo:', new Date().toLocaleDateString('vi-VN')],
      [],
      ['CHI TIẾT THEO GÓI DỊCH VỤ'],
      ['STT', 'Tên gói/Dịch vụ', 'Số buổi', 'Đơn giá/buổi', 'Thành tiền', 'Khách hàng'],
    ];

    let stt = 1;
    let totalSessionBonus = 0;
    Object.values(packageGroups).forEach((group: any) => {
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

    const baseSalary = record?.base_salary || 6000000;
    const kpiBonus = record?.kpi_bonus || (sessions?.length > 30 ? 1000000 : 0);
    const deductions = record?.violations_deduction || 0;
    const advances = record?.service_percentage_bonus || 0;
    const totalFinal = baseSalary + totalSessionBonus + kpiBonus - deductions - advances;

    reportData.push(
      [],
      ['TỔNG HỢP THU NHẬP & CHI PHÍ'],
      ['1. Lương cơ bản', '', '', '', baseSalary.toLocaleString('vi-VN') + 'đ'],
      ['2. Tổng hoa hồng buổi diễn', '', sessions?.length + ' buổi', '', totalSessionBonus.toLocaleString('vi-VN') + 'đ'],
      ['3. Thưởng KPI/Chuyên cần', '', '', '', kpiBonus.toLocaleString('vi-VN') + 'đ'],
      ['4. Các khoản giảm trừ (Vi phạm)', '', '', '', '-' + deductions.toLocaleString('vi-VN') + 'đ'],
      ['5. Tạm ứng', '', '', '', '-' + advances.toLocaleString('vi-VN') + 'đ'],
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

export async function exportSessionMatrixToExcel(data: any[], packageNames: string[]) {
  try {
    const wb = XLSX.utils.book_new();
    
    // 1. Prepare data for AOA (Array of Arrays)
    const reportData = [
      ['BẢNG ĐỐI SOÁT CHI TIẾT SỐ BUỔI LÀM THEO LIỆU TRÌNH'],
      ['Kỳ lương:', '05/2026'],
      ['Ngày xuất:', new Date().toLocaleDateString('vi-VN')],
      [],
      ['Kỹ thuật viên', ...packageNames, 'Tổng cộng']
    ];

    data.forEach((row: any) => {
      const rowData = [row.name];
      let total = 0;
      packageNames.forEach((pkg: string) => {
        const count = row[pkg] || 0;
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
