import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { supabase } from './db.js';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
// ---------------------------------------------------------
// Helper: Auto-generate Booking Number (BK-YYMMDD-NNN)
// ---------------------------------------------------------
async function generateBookingNumber(tenantId) {
    const todayStr = format(new Date(), 'yyMMdd');
    const prefix = `BK-${todayStr}`;
    const { data, error } = await supabase
        .from('bookings')
        .select('booking_number')
        .eq('tenant_id', tenantId)
        .like('booking_number', `${prefix}-%`)
        .order('booking_number', { ascending: false })
        .limit(1);
    let nextNum = 1;
    if (data && data.length > 0) {
        const lastNumStr = data[0].booking_number.split('-')[2];
        nextNum = parseInt(lastNumStr, 10) + 1;
    }
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${prefix}-${paddedNum}`;
}
// ---------------------------------------------------------
// Register Tools Handler
// ---------------------------------------------------------
export function registerTools(server) {
    // 1. List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                // --- Mô-đun Tài chính & Quỹ lương ---
                {
                    name: 'get_financial_performance',
                    description: 'Phân tích tài chính P&L chi tiết của một chi nhánh trong một khoảng thời gian: tổng hợp Doanh thu (cọc + ca hoàn thành), Chi phí (vận chuyển, marketing, mặt bằng), Lương nhân viên và Phí tác quyền nhượng quyền (Franchise Royalty).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh cần phân tích.' },
                            start_date: { type: 'string', description: 'Ngày bắt đầu phân tích (YYYY-MM-DD).' },
                            end_date: { type: 'string', description: 'Ngày kết thúc phân tích (YYYY-MM-DD).' }
                        },
                        required: ['tenant_id', 'start_date', 'end_date']
                    }
                },
                {
                    name: 'detect_financial_anomalies',
                    description: 'Quét và phát hiện các bất thường về dòng tiền: Nợ đọng khách hàng (làm nhiều buổi nhưng chưa đóng đủ cọc/học phí), chi phí đề xuất bất thường (vượt 2M), hoặc các khoản thu chi chưa được đối soát (pending).',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh cần phân tích.' }
                        },
                        required: ['tenant_id']
                    }
                },
                {
                    name: 'calculate_salary_projection',
                    description: 'Tính toán dự phóng quỹ lương và hoa hồng KTV cho tháng hiện tại dựa trên số ca hoàn thành thực tế, hoa hồng tích lũy và kpi thưởng đánh giá 5 sao.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh.' },
                            month_year: { type: 'string', description: 'Tháng cần dự phòng lương (YYYY-MM).' }
                        },
                        required: ['tenant_id', 'month_year']
                    }
                },
                // --- Mô-đun Điều phối KTV ---
                {
                    name: 'optimize_ktv_allocation',
                    description: 'Phân tích ca làm việc, trạng thái KTV, điểm đánh giá trung bình và khoảng cách để đề xuất KTV tối ưu nhất cho một lịch hẹn mới.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh.' },
                            date: { type: 'string', description: 'Ngày xếp lịch (YYYY-MM-DD).' },
                            customer_address: { type: 'string', description: 'Địa chỉ nhà của khách hàng.' }
                        },
                        required: ['tenant_id', 'date', 'customer_address']
                    }
                },
                // --- Mô-đun Liệu trình & Zalo CSKH ---
                {
                    name: 'inspect_customer_treatment_progress',
                    description: 'Giám sát tiến độ liệu trình 15/21 buổi của khách hàng: Phát hiện các ca bị đứt quãng quá 5 ngày chưa thực hiện, hoặc có phản hồi đánh giá kém từ khách để kịp thời CSKH.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh.' },
                            booking_id: { type: 'string', description: 'UUID của hợp đồng dịch vụ (Booking ID).' }
                        },
                        required: ['tenant_id', 'booking_id']
                    }
                },
                {
                    name: 'propose_zalo_reminders',
                    description: 'Quét toàn bộ ca hẹn sắp tới trong ngày chưa gửi nhắc lịch, tự động soạn sẵn nội dung tin nhắn Zalo ZNS đề xuất (Human-in-the-loop) để gửi phê duyệt.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh.' }
                        },
                        required: ['tenant_id']
                    }
                },
                // --- Mô-đun Vật tư kho ---
                {
                    name: 'forecast_inventory_depletion',
                    description: 'Dự báo ngày cạn kiệt vật tư kho (tinh dầu tắm bé, mỹ phẩm) dựa trên lượng tồn kho thực tế, định mức tiêu hao dịch vụ và các ca hẹn dự kiến trong 14 ngày tới.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            tenant_id: { type: 'string', description: 'UUID của chi nhánh.' }
                        },
                        required: ['tenant_id']
                    }
                },
            ]
        };
    });
    // 2. Call tool execution handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            // ---------------------------------------------------------
            // TOOL: get_financial_performance (P&L Analysis)
            // ---------------------------------------------------------
            if (name === 'get_financial_performance') {
                const parsed = z.object({
                    tenant_id: z.string().uuid(),
                    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
                }).parse(args);
                // Fetch Tenant Info for Royalty calculation
                const { data: tenant, error: tenantErr } = await supabase
                    .from('tenants')
                    .select('name, royalty_rate')
                    .eq('id', parsed.tenant_id)
                    .single();
                if (tenantErr || !tenant) {
                    return { content: [{ type: 'text', text: `Lỗi: Không tìm thấy chi nhánh: ${tenantErr?.message}` }] };
                }
                // Fetch Confirmed Revenue
                const { data: revenueData, error: revErr } = await supabase
                    .from('revenue')
                    .select('amount, revenue_type, payment_method')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('status', 'confirmed')
                    .gte('received_date', parsed.start_date)
                    .lte('received_date', parsed.end_date);
                if (revErr)
                    throw new Error(`Lỗi doanh thu: ${revErr.message}`);
                // Fetch Approved Expenses
                const { data: expenseData, error: expErr } = await supabase
                    .from('expenses')
                    .select('amount, category')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('status', 'approved')
                    .gte('expense_date', parsed.start_date)
                    .lte('expense_date', parsed.end_date);
                if (expErr)
                    throw new Error(`Lỗi chi phí: ${expErr.message}`);
                // Fetch Salaries paid in this range
                const { data: salaryData, error: salErr } = await supabase
                    .from('salary_records')
                    .select('total_salary')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('status', 'paid')
                    .gte('paid_date', parsed.start_date)
                    .lte('paid_date', parsed.end_date);
                if (salErr)
                    throw new Error(`Lỗi quỹ lương: ${salErr.message}`);
                // Calculate Sums
                const totalRevenue = (revenueData || []).reduce((sum, r) => sum + Number(r.amount), 0);
                const totalExpenses = (expenseData || []).reduce((sum, e) => sum + Number(e.amount), 0);
                const totalSalaries = (salaryData || []).reduce((sum, s) => sum + Number(s.total_salary), 0);
                // Breakdown revenue & expenses
                const revenueBreakdown = (revenueData || []).reduce((acc, r) => {
                    acc[r.revenue_type] = (acc[r.revenue_type] || 0) + Number(r.amount);
                    return acc;
                }, {});
                const expenseBreakdown = (expenseData || []).reduce((acc, e) => {
                    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
                    return acc;
                }, {});
                // Royalty calculation
                const royaltyRate = Number(tenant.royalty_rate) || 0;
                const royaltyPaid = totalRevenue * (royaltyRate / 100);
                // Net Profit = Revenue - Expenses - Salaries - Royalty
                const netProfit = totalRevenue - totalExpenses - totalSalaries - royaltyPaid;
                const result = {
                    tenant_name: tenant.name,
                    period: `${parsed.start_date} -> ${parsed.end_date}`,
                    financial_summary: {
                        total_revenue: totalRevenue,
                        total_expenses: totalExpenses,
                        total_salaries_paid: totalSalaries,
                        royalty_percentage: `${royaltyRate}%`,
                        royalty_paid: royaltyPaid,
                        net_profit: netProfit,
                        profit_margin: totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(2)}%` : '0%'
                    },
                    revenue_breakdown: revenueBreakdown,
                    expense_breakdown: expenseBreakdown
                };
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }]
                };
            }
            // ---------------------------------------------------------
            // TOOL: detect_financial_anomalies (Dòng tiền bất thường)
            // ---------------------------------------------------------
            if (name === 'detect_financial_anomalies') {
                const parsed = z.object({
                    tenant_id: z.string().uuid()
                }).parse(args);
                // 1. Scan for Booking Debts (completed sessions * session price > deposit paid)
                const { data: bookings, error: bookErr } = await supabase
                    .from('bookings')
                    .select(`
            id, booking_number, package_name, price, deposit_amount, completed_sessions, total_sessions,
            customers!bookings_customer_id_fkey(name_mother, phone)
          `)
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('status', 'in_progress');
                if (bookErr)
                    throw new Error(bookErr.message);
                const customerDebts = [];
                for (const b of (bookings || [])) {
                    const completed = b.completed_sessions || 0;
                    const total = b.total_sessions || 1;
                    const price = Number(b.price) || 0;
                    const deposit = Number(b.deposit_amount) || 0;
                    // Fetch all actual received revenue for this booking
                    const { data: revs } = await supabase
                        .from('revenue')
                        .select('amount')
                        .eq('booking_id', b.id)
                        .eq('status', 'confirmed');
                    const totalPaid = (revs || []).reduce((sum, r) => sum + Number(r.amount), 0);
                    // Earned value of performed sessions
                    const earnedValue = (completed / total) * price;
                    // Debt is earned sessions value minus money actually paid
                    const debt = earnedValue - totalPaid;
                    if (debt > 100000) { // Debt > 100k VND
                        const cust = b.customers;
                        customerDebts.push({
                            booking_id: b.id,
                            booking_number: b.booking_number,
                            customer_mother: cust?.name_mother || 'N/A',
                            customer_phone: cust?.phone || 'N/A',
                            package_name: b.package_name,
                            completed_sessions: `${completed}/${total}`,
                            total_price: price,
                            total_paid: totalPaid,
                            estimated_debt: Math.round(debt)
                        });
                    }
                }
                // 2. Scan for Unconfirmed Revenue (pending)
                const { data: pendingRevs, error: pendErr } = await supabase
                    .from('revenue')
                    .select('id, amount, received_date, notes')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('status', 'pending');
                if (pendErr)
                    throw new Error(pendErr.message);
                // 3. Scan for Large Expenses (> 2M) or Unapproved Expenses
                const { data: suspiciousExps, error: expErr } = await supabase
                    .from('expenses')
                    .select('id, category, amount, description, expense_date, status')
                    .eq('tenant_id', parsed.tenant_id)
                    .or('amount.gt.2000000,status.eq.submitted');
                if (expErr)
                    throw new Error(expErr.message);
                const anomalies = {
                    customer_debts_count: customerDebts.length,
                    customer_debts: customerDebts,
                    pending_unconfirmed_revenue: pendingRevs || [],
                    suspicious_or_unapproved_expenses: suspiciousExps || []
                };
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(anomalies, null, 2)
                        }]
                };
            }
            // ---------------------------------------------------------
            // TOOL: calculate_salary_projection (KTV Wage forecast)
            // ---------------------------------------------------------
            if (name === 'calculate_salary_projection') {
                const parsed = z.object({
                    tenant_id: z.string().uuid(),
                    month_year: z.string().regex(/^\d{4}-\d{2}$/)
                }).parse(args);
                // Month range dates
                const startOfMonth = `${parsed.month_year}-01`;
                const endOfMonth = `${parsed.month_year}-31`; // Loose end date, PG can handle between
                // Fetch all KTVs
                const { data: ktvs, error: ktvErr } = await supabase
                    .from('users')
                    .select('id, full_name, role, status')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('role', 'ktv')
                    .eq('status', 'active');
                if (ktvErr)
                    throw new Error(ktvErr.message);
                const wageForecasts = [];
                for (const ktv of (ktvs || [])) {
                    // Fetch completed sessions by this KTV in this month
                    const { data: sessions, error: sesErr } = await supabase
                        .from('session_logs')
                        .select(`
              id, assigned_date,
              bookings!session_logs_booking_id_fkey(ktv_commission)
            `)
                        .eq('completed_by_ktv_id', ktv.id)
                        .eq('status', 'completed')
                        .gte('assigned_date', startOfMonth)
                        .lte('assigned_date', endOfMonth);
                    if (sesErr)
                        continue;
                    // Sum commissions
                    const totalSessions = sessions?.length || 0;
                    const commissionTotal = (sessions || []).reduce((sum, s) => {
                        const bookings = s.bookings;
                        return sum + (Number(bookings?.ktv_commission) || 0);
                    }, 0);
                    // Fetch reviews of these sessions to calculate 5-star bonuses (e.g. 50k bonus per 5-star)
                    const sessionIds = (sessions || []).map(s => s.id);
                    let ratingBonus = 0;
                    let avgRating = 0;
                    if (sessionIds.length > 0) {
                        const { data: reviews } = await supabase
                            .from('session_reviews')
                            .select('rating')
                            .in('session_log_id', sessionIds)
                            .eq('status', 'approved');
                        if (reviews && reviews.length > 0) {
                            const fiveStarCount = reviews.filter(r => Number(r.rating) === 5).length;
                            ratingBonus = fiveStarCount * 50000; // 50k bonus per 5 star review
                            const totalRating = reviews.reduce((sum, r) => sum + Number(r.rating), 0);
                            avgRating = totalRating / reviews.length;
                        }
                    }
                    // Fetch base salary from tenants default configurations or a flat 4.5M base
                    const baseSalary = 4500000; // Flat base salary for modeling
                    const projectedTotal = baseSalary + commissionTotal + ratingBonus;
                    wageForecasts.push({
                        ktv_id: ktv.id,
                        ktv_name: ktv.full_name,
                        total_sessions_completed: totalSessions,
                        average_customer_rating: avgRating > 0 ? Number(avgRating.toFixed(2)) : 'N/A',
                        breakdown: {
                            base_salary: baseSalary,
                            session_commissions: commissionTotal,
                            kpi_rating_bonuses: ratingBonus,
                            projected_total_salary: projectedTotal
                        }
                    });
                }
                const result = {
                    month: parsed.month_year,
                    ktv_count: wageForecasts.length,
                    projected_payroll_total: wageForecasts.reduce((sum, w) => sum + w.breakdown.projected_total_salary, 0),
                    ktv_salaries_forecast: wageForecasts
                };
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }]
                };
            }
            // ---------------------------------------------------------
            // TOOL: optimize_ktv_allocation (Scheduling helper)
            // ---------------------------------------------------------
            if (name === 'optimize_ktv_allocation') {
                const parsed = z.object({
                    tenant_id: z.string().uuid(),
                    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                    customer_address: z.string()
                }).parse(args);
                // Fetch all technicians of the branch
                const { data: ktvs, error: ktvErr } = await supabase
                    .from('users')
                    .select('id, full_name')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('role', 'ktv')
                    .eq('status', 'active');
                if (ktvErr)
                    throw new Error(ktvErr.message);
                const allocationList = [];
                for (const ktv of (ktvs || [])) {
                    // Check KTV's registered schedule for the date
                    const { data: sched } = await supabase
                        .from('ktv_schedule')
                        .select('status')
                        .eq('ktv_id', ktv.id)
                        .eq('date', parsed.date)
                        .single();
                    const scheduleStatus = sched?.status || 'free_full'; // default free
                    if (scheduleStatus === 'off') {
                        continue; // Skip off KTVs
                    }
                    // Count active shifts on that day to assess load
                    const { count: activeShifts } = await supabase
                        .from('shifts')
                        .select('*', { count: 'exact', head: true })
                        .eq('ktv_id', ktv.id)
                        .eq('date', parsed.date)
                        .eq('status', 'scheduled');
                    const loadCount = activeShifts || 0;
                    if (loadCount >= 3) {
                        continue; // Skip heavily loaded KTVs (> 3 shifts)
                    }
                    // Fetch average rating of KTV
                    const { data: kpi } = await supabase
                        .from('kpi_records')
                        .select('customer_satisfaction')
                        .eq('ktv_id', ktv.id)
                        .order('month_year', { ascending: false })
                        .limit(1);
                    const ratingAvg = kpi && kpi.length > 0 ? Number(kpi[0].customer_satisfaction) : 4.8;
                    // Simple location matching (simulation): Check if KTV resides/previously checked-in nearby
                    // In real ERP, geocoding coordinates are compared. Here we do keyword match.
                    const lowerAddr = parsed.customer_address.toLowerCase();
                    let proximityScore = 'Medium';
                    if (lowerAddr.includes('quận 1') || lowerAddr.includes('q1') || lowerAddr.includes('quận 3')) {
                        proximityScore = 'High';
                    }
                    allocationList.push({
                        ktv_id: ktv.id,
                        ktv_name: ktv.full_name,
                        schedule_status: scheduleStatus,
                        current_ca_count: loadCount,
                        average_rating: ratingAvg,
                        estimated_proximity: proximityScore,
                        suitability_score: Math.round((ratingAvg * 15) + (proximityScore === 'High' ? 25 : 10) - (loadCount * 15)) // score formula
                    });
                }
                // Sort by suitability score desc
                allocationList.sort((a, b) => b.suitability_score - a.suitability_score);
                const result = {
                    target_date: parsed.date,
                    customer_address: parsed.customer_address,
                    recommended_ktvs: allocationList
                };
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }]
                };
            }
            // ---------------------------------------------------------
            // TOOL: inspect_customer_treatment_progress (Liệu trình CSKH)
            // ---------------------------------------------------------
            if (name === 'inspect_customer_treatment_progress') {
                const parsed = z.object({
                    tenant_id: z.string().uuid(),
                    booking_id: z.string().uuid()
                }).parse(args);
                // Fetch booking & customer details
                const { data: booking, error: bookErr } = await supabase
                    .from('bookings')
                    .select(`
            id, booking_number, package_name, start_date, end_date, expected_birth_date,
            customers!bookings_customer_id_fkey(name_mother, name_baby, phone)
          `)
                    .eq('id', parsed.booking_id)
                    .single();
                if (bookErr || !booking) {
                    return { content: [{ type: 'text', text: `Lỗi: Không tìm thấy hợp đồng đặt lịch: ${bookErr?.message}` }] };
                }
                // Fetch all session logs ordered by session number
                const { data: sessions, error: sesErr } = await supabase
                    .from('session_logs')
                    .select('id, session_number, assigned_date, completed_date, status, address')
                    .eq('booking_id', parsed.booking_id)
                    .order('session_number', { ascending: true });
                if (sesErr)
                    throw new Error(sesErr.message);
                const sessionLogs = sessions || [];
                const completedSessions = sessionLogs.filter(s => s.status === 'completed');
                const scheduledSessions = sessionLogs.filter(s => s.status === 'scheduled');
                // Check for Gaps (interrupted sessions > 5 days)
                const gaps = [];
                for (let i = 0; i < completedSessions.length - 1; i++) {
                    const date1 = parseISO(completedSessions[i].assigned_date);
                    const date2 = parseISO(completedSessions[i + 1].assigned_date);
                    const diff = differenceInDays(date2, date1);
                    if (diff > 5) {
                        gaps.push({
                            between_sessions: `${completedSessions[i].session_number} & ${completedSessions[i + 1].session_number}`,
                            gap_days: diff,
                            date_from: completedSessions[i].assigned_date,
                            date_to: completedSessions[i + 1].assigned_date
                        });
                    }
                }
                // Fetch any reviews with rating < 4 stars
                const sessionIds = sessionLogs.map(s => s.id);
                let lowRatings = [];
                if (sessionIds.length > 0) {
                    const { data: reviews } = await supabase
                        .from('session_reviews')
                        .select('rating, note')
                        .in('session_log_id', sessionIds)
                        .lt('rating', 4);
                    lowRatings = reviews || [];
                }
                const cust = booking.customers;
                const analysis = {
                    booking_details: {
                        booking_number: booking.booking_number,
                        package_name: booking.package_name,
                        mother_name: cust?.name_mother,
                        baby_name: cust?.name_baby,
                        phone: cust?.phone,
                        start_date: booking.start_date,
                        expected_end_date: booking.end_date
                    },
                    progress_metrics: {
                        total_sessions: sessionLogs.length,
                        completed_count: completedSessions.length,
                        scheduled_count: scheduledSessions.length,
                        percentage_complete: sessionLogs.length > 0 ? `${Math.round((completedSessions.length / sessionLogs.length) * 100)}%` : '0%'
                    },
                    anomalies_detected: {
                        interrupted_gaps_gt_5_days: gaps,
                        low_customer_reviews: lowRatings.map(r => ({
                            rating_stars: r.rating,
                            feedback_content: '[Mã hóa/Bảo mật RLS]' // keep encrypted notes secured
                        }))
                    }
                };
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(analysis, null, 2)
                        }]
                };
            }
            // ---------------------------------------------------------
            // TOOL: propose_zalo_reminders (Zalo OA Draft)
            // ---------------------------------------------------------
            if (name === 'propose_zalo_reminders') {
                const parsed = z.object({
                    tenant_id: z.string().uuid()
                }).parse(args);
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                // Fetch upcoming scheduled session logs today with no Zalo reminder sent
                const { data: sessions, error: sesErr } = await supabase
                    .from('session_logs')
                    .select(`
            id, session_number, assigned_time, assigned_date, address,
            bookings!session_logs_booking_id_fkey(
              package_name,
              customers!bookings_customer_id_fkey(name_mother, name_baby, phone),
              assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name)
            )
          `)
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('assigned_date', todayStr)
                    .eq('status', 'scheduled')
                    .eq('zalo_reminder_sent', false);
                if (sesErr)
                    throw new Error(sesErr.message);
                const proposals = (sessions || []).map(s => {
                    const bookings = s.bookings;
                    const customer = bookings?.customers;
                    const motherName = customer?.name_mother || 'Khách hàng';
                    const babyName = customer?.name_baby ? `bé ${customer.name_baby}` : 'bé';
                    const ktvName = bookings?.assigned_ktv?.full_name || 'KTV Bella Spa';
                    const timeStr = s.assigned_time ? s.assigned_time.substring(0, 5) : '09:00';
                    const messageContent = `Kính gửi chị ${motherName}, Bella Spa xin nhắc lịch hẹn chăm sóc tại nhà cho ${babyName} vào lúc ${timeStr} hôm nay (${s.assigned_date}). KTV phụ trách: ${ktvName}. Địa chỉ: ${s.address || 'Tại nhà'}. Hotline hỗ trợ: 0865 701 493.`;
                    return {
                        session_log_id: s.id,
                        session_number: s.session_number,
                        customer_phone: customer?.phone || 'N/A',
                        customer_mother: motherName,
                        appointment_time: `${timeStr} ngày ${s.assigned_date}`,
                        zalo_zns_template_payload: {
                            phone: customer?.phone,
                            template_id: 'ZNS_REMINDER_V2',
                            template_data: {
                                customer_name: motherName,
                                baby_name: babyName,
                                appointment_time: `${timeStr} ngày ${s.assigned_date}`,
                                ktv_name: ktvName,
                                address: s.address || 'Tại nhà',
                                hotline: '0865 701 493'
                            }
                        },
                        proposed_draft_message: messageContent
                    };
                });
                const result = {
                    date: todayStr,
                    pending_reminders_count: proposals.length,
                    proposed_reminders_list: proposals
                };
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }]
                };
            }
            // ---------------------------------------------------------
            // TOOL: forecast_inventory_depletion (Material usage)
            // ---------------------------------------------------------
            if (name === 'forecast_inventory_depletion') {
                const parsed = z.object({
                    tenant_id: z.string().uuid()
                }).parse(args);
                // Fetch current stock
                const { data: stockItems, error: stockErr } = await supabase
                    .from('inventory_items')
                    .select('id, name, stock_quantity, unit');
                // Check if inventory_items table is empty or error
                if (stockErr || !stockItems || stockItems.length === 0) {
                    // Fallback or empty return
                    return { content: [{ type: 'text', text: 'Thông tin kho vật tư hiện đang trống hoặc chưa được cấu hình định mức.' }] };
                }
                // Fetch upcoming sessions in next 14 days
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const endRangeStr = format(addDays(new Date(), 14), 'yyyy-MM-dd');
                const { data: sessions, error: sesErr } = await supabase
                    .from('session_logs')
                    .select('id')
                    .eq('tenant_id', parsed.tenant_id)
                    .eq('status', 'scheduled')
                    .gte('assigned_date', todayStr)
                    .lte('assigned_date', endRangeStr);
                const scheduledSessionsCount = sessions?.length || 0;
                // Recipes / Consumption defaults (simulated matching package_materials)
                // Assume: Bathing/Massage session consumes 20ml Oil, 15g Herbs
                const recipes = [
                    { name: 'Tinh dầu tràm', usagePerSession: 20 },
                    { name: 'Thảo dược xông tắm', usagePerSession: 15 }
                ];
                const forecasts = stockItems.map(item => {
                    const recipe = recipes.find(r => item.name.toLowerCase().includes(r.name.toLowerCase()));
                    const quantity = Number(item.stock_quantity) || 0;
                    if (!recipe) {
                        return {
                            item_name: item.name,
                            current_stock: `${quantity} ${item.unit}`,
                            status: 'Stable',
                            depletion_date_projection: 'Không có định mức tiêu hao'
                        };
                    }
                    const dailyConsumption = (scheduledSessionsCount / 14) * recipe.usagePerSession;
                    const daysLeft = dailyConsumption > 0 ? Math.round(quantity / dailyConsumption) : 999;
                    let status = 'Stable';
                    let depletionDate = 'An toàn (>14 ngày)';
                    if (daysLeft <= 3) {
                        status = 'CRITICAL (Sắp Hết Kho)';
                        depletionDate = format(addDays(new Date(), daysLeft), 'yyyy-MM-dd');
                    }
                    else if (daysLeft <= 7) {
                        status = 'Warning (Tồn Thấp)';
                        depletionDate = format(addDays(new Date(), daysLeft), 'yyyy-MM-dd');
                    }
                    return {
                        item_name: item.name,
                        current_stock: `${quantity} ${item.unit}`,
                        usage_per_session: `${recipe.usagePerSession} ml/g`,
                        projected_days_remaining: daysLeft === 999 ? 'Vô hạn' : daysLeft,
                        status,
                        depletion_date_projection: daysLeft === 999 ? 'Vô hạn' : depletionDate
                    };
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(forecasts, null, 2)
                        }]
                };
            }
            throw new Error(`Tool not found: ${name}`);
        }
        catch (err) {
            return {
                content: [{
                        type: 'text',
                        text: `Thao tác thất bại: ${err.message}`
                    }],
                isError: true
            };
        }
    });
}
