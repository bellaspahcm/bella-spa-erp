'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  Search, 
  Eye, 
  Clock, 
  User as UserIcon, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  ArrowRight,
  Info
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface AuditLog {
  id: string;
  user_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_data: any;
  created_at: string;
}

const FIELD_TRANSLATIONS: Record<string, string> = {
  // Common / General fields
  amount: "Số tiền",
  notes: "Ghi chú / Tên khoản",
  status: "Trạng thái",
  payment_method: "Hình thức thanh toán",
  revenue_type: "Loại khoản thu",
  description: "Mô tả",
  category: "Danh mục",
  total_price: "Tổng tiền",
  customer_name: "Khách hàng",
  full_name: "Họ và tên",
  phone: "Số điện thoại",
  role: "Chức vụ",
  base_salary: "Lương cơ bản",
  commission_amount: "Tiền hoa hồng",
  allowance_amount: "Tiền phụ cấp",
  deduction_amount: "Tiền phạt/trừ",
  net_salary: "Thực lãnh",
  month: "Tháng",
  year: "Năm",
  item_name: "Tên sản phẩm",
  quantity: "Số lượng",
  unit: "Đơn vị tính",
  unit_price: "Đơn giá",
  type: "Loại",
  received_date: "Ngày nhận",
  booking_id: "Mã lịch hẹn",
  recorded_by_id: "Người ghi nhận",
  completed_by_ktv_id: "KTV thực hiện",
  expense_date: "Ngày chi",
  approved_by_id: "Người duyệt",
  submitted_by_id: "Người yêu cầu",
  commission_rate: "Tỷ lệ hoa hồng",
  rating_bonus: "Thưởng đánh giá",
  salary_advance: "Tạm ứng lương",
  total_salary: "Tổng lương",
  finalized_by_id: "Người chốt lương",
  user_id: "Nhân viên",
  ktv_id: "Kỹ thuật viên",
  email: "Thư điện tử",
  package_name: "Gói dịch vụ",
  deposit: "Số tiền cọc",
  remaining_amount: "Số tiền còn lại",
  price: "Đơn giá",
  customer_id: "Mã khách hàng",
  address: "Địa chỉ",
  notes_private: "Ghi chú nội bộ",
  notes_customer: "Yêu cầu của khách",

  // Customers table new fields
  name_mother: "Tên mẹ",
  name_baby: "Tên bé",
  dob_baby: "Ngày sinh bé",
  dob_expected: "Ngày dự sinh",
  referrer_id: "Người giới thiệu",
  zalo_oa_id: "Zalo OA ID",
  gender_baby: "Giới tính bé",
  loyalty_points: "Điểm tích lũy",

  // Bookings table new fields
  booking_number: "Mã đặt lịch",
  package_id: "Gói liệu trình",
  deposit_amount: "Tiền đặt cọc",
  full_price: "Giá trị gói",
  start_date: "Ngày bắt đầu",
  end_date: "Ngày kết thúc",
  expected_birth_date: "Ngày dự sinh",
  total_sessions: "Tổng số buổi",
  completed_sessions: "Số buổi đã hoàn thành",
  contract_signed: "Đã ký hợp đồng",
  contract_url: "Đường dẫn hợp đồng",
  assigned_ktv_id: "KTV được chỉ định",
  preferred_time: "Khung giờ yêu thích",
  ktv_commission: "Hoa hồng KTV",
  last_updated_date: "Ngày cập nhật cuối",
  is_in_care: "Đang được chăm sóc",
  discount_percent: "Tỷ lệ giảm giá (%)",

  // Session Logs table new fields
  session_number: "Buổi số",
  assigned_date: "Ngày phân ca",
  completed_date: "Ngày hoàn thành",
  assigned_time: "Giờ phân ca",
  is_confirmed: "Đã xác nhận buổi",
  rating_comment: "Đánh giá của khách",
  start_time: "Giờ check-in",
  end_time: "Giờ check-out",
  standard_duration: "Thời lượng chuẩn (phút)",
  actual_duration: "Thời lượng thực tế (phút)",
  time_deviation: "Sai lệch thời gian",
  duration_warning_type: "Cảnh báo thời lượng",
  ktv_checkout_note: "Ghi chú checkout KTV",
  zalo_reminder_sent: "Đã gửi nhắc lịch Zalo",
  zalo_reminder_time: "Thời gian gửi nhắc lịch",

  // Session Reviews table new fields
  session_log_id: "Mã buổi làm việc",
  reviewer_id: "Người đánh giá",
  rating: "Điểm đánh giá",
  note: "Chi tiết phản hồi",
  note_encrypted: "Mã hóa phản hồi",
  is_hidden_from_ktv: "Ẩn với KTV",

  // Attendance table new fields
  checkin_time: "Giờ check-in",
  checkout_time: "Giờ check-out",
  shift_id: "Mã ca trực",

  // Tenants table new fields
  name: "Tên đối tác",
  parent_tenant_id: "Đối tác cha",
  franchise_agreement_date: "Ngày ký hợp đồng nhượng quyền",
  royalty_rate: "Tỷ lệ phí nhượng quyền (%)",
  contact_name: "Tên người liên hệ",
  contact_phone: "Số điện thoại liên hệ",
  company_name: "Tên công ty",
  zalo_app_id: "Zalo App ID",
  zalo_template_reminder_id: "Mẫu nhắc lịch ZNS",
  zalo_template_birthday_id: "Mẫu chúc mừng sinh nhật ZNS",
  zalo_auto_scan: "Tự động gửi Zalo",
  qr_bank_code: "Mã ngân hàng QR",
  qr_account_number: "Số tài khoản QR",
  qr_account_name: "Tên chủ tài khoản QR",

  // Inventory Items / Inventory logs
  sku: "Mã SKU",
  stock_level: "Số lượng tồn kho",
  min_stock_level: "Ngưỡng báo động tồn",
  price_per_unit: "Đơn giá nhập",

  // Package Materials
  quantity_per_session: "Số lượng tiêu hao/buổi"
};

const VALUE_TRANSLATIONS: Record<string, string> = {
  // General / Common
  confirmed: "Đã xác nhận",
  pending: "Chờ xử lý",
  cancelled: "Đã hủy",
  deposit: "Tiền cọc",
  full_payment: "Thanh toán đủ",
  installment: "Trả góp",
  bank_transfer: "Chuyển khoản",
  cash: "Tiền mặt",
  card: "Quẹt thẻ",
  admin: "Quản trị viên",
  ktv: "Kỹ thuật viên",
  receptionist: "Lễ tân",
  accountant: "Kế toán",
  paid: "Đã thanh toán",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  completed: "Đã hoàn thành",
  active: "Hoạt động",
  inactive: "Ngừng hoạt động",
  in_progress: "Đang thực hiện",
  success: "Thành công",
  failed: "Thất bại",
  additional: "Thu phát sinh",

  // Bookings / Shifts
  booked: "Đã đặt lịch",
  deposit_pending: "Chờ đặt cọc",
  inquiry: "Đang tư vấn",
  scheduled: "Đã xếp ca",

  // Reviews
  pending_review: "Chờ duyệt đánh giá",
  published: "Đã công bố",

  // Attendance
  present: "Đúng giờ",
  late: "Đi muộn",
  absent: "Vắng mặt",
  half_day: "Nửa ngày",

  // Tenants
  suspended: "Tạm ngưng nhượng quyền",
  terminated: "Chấm dứt nhượng quyền",

  // Session Logs KPIs
  under_time: "Thiếu giờ",
  over_time: "Thừa giờ",
  normal: "Bình thường",

  // Salary Records
  draft: "Bản nháp",
  pending_approval: "Chờ phê duyệt",
  disputed: "Khiếu nại",
  finalized: "Đã chốt"
};

const TABLE_TRANSLATIONS: Record<string, string> = {
  revenue: "Doanh thu",
  expenses: "Chi phí",
  bookings: "Lịch hẹn",
  inventory_items: "Kho hàng",
  users: "Nhân viên",
  salary_records: "Chốt lương",
  session_logs: "Ca làm việc KTV",
  customers: "Khách hàng",
  session_reviews: "Đánh giá của khách",
  attendance: "Chấm công nhân viên",
  tenants: "Đối tác nhượng quyền",
  packages: "Gói dịch vụ",
  package_materials: "Định mức tiêu hao"
};

const EXCLUDED_KEYS = [
  'id', 
  'tenant_id', 
  'created_at', 
  'updated_at', 
  'booking_id', 
  'recorded_by_id', 
  'password_hash', 
  'zalo_secret_key', 
  'zalo_access_token', 
  'zalo_refresh_token', 
  'share_token'
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatReadableValueOuter = (key: string, val: any) => String(val);

export default function AuditPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTable, setFilterTable] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Reference maps to translate IDs
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [packagesMap, setPackagesMap] = useState<Record<string, string>>({});
  const [customersMap, setCustomersMap] = useState<Record<string, string>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatReadableValue = (key: string, val: any) => {
    if (val === null || val === undefined || val === '') return 'Trống';
    if (typeof val === 'boolean') return val ? 'Có' : 'Không';
    
    // Format currency
    if (
      key === 'amount' || 
      key.includes('salary') || 
      key.includes('price') || 
      key === 'deposit_amount' || 
      key === 'full_price' || 
      key === 'ktv_commission' || 
      key === 'price_per_unit'
    ) {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val));
    }
    
    // Format reference IDs
    if (key === 'assigned_ktv_id' || key === 'completed_by_ktv_id' || key === 'ktv_id' || key === 'user_id' || key === 'recorded_by_id' || key === 'approved_by_id' || key === 'submitted_by_id' || key === 'finalized_by_id') {
      return usersMap[val] || `Nhân viên (${String(val).slice(0, 8)})`;
    }
    if (key === 'package_id') {
      return packagesMap[val] || `Gói dịch vụ (${String(val).slice(0, 8)})`;
    }
    if (key === 'customer_id' || key === 'referrer_id') {
      return customersMap[val] || `Khách hàng (${String(val).slice(0, 8)})`;
    }
    
    // Format standard values translations
    if (typeof val === 'string' && VALUE_TRANSLATIONS[val]) {
      return VALUE_TRANSLATIONS[val];
    }
    
    // Format objects
    if (typeof val === 'object') return JSON.stringify(val);
    
    return String(val);
  };

  const renderReadableChanges = (log: AuditLog) => {
    if (log.action === 'INSERT' && log.new_data) {
      // Custom presentation for core tables
      if (log.table_name === 'revenue') {
        const amount = formatReadableValue('amount', log.new_data.amount);
        const method = formatReadableValue('payment_method', log.new_data.payment_method);
        const type = formatReadableValue('revenue_type', log.new_data.revenue_type);
        const notes = log.new_data.notes ? ` (${log.new_data.notes})` : '';
        return (
          <span>
            Đã ghi nhận doanh thu <strong className="text-emerald-600 font-semibold">{amount}</strong> (Loại: <span className="font-medium text-slate-700">{type}</span>, Hình thức: <span className="font-medium text-slate-700">{method}</span>){notes}.
          </span>
        );
      }
      
      if (log.table_name === 'bookings') {
        const pkg = formatReadableValue('package_id', log.new_data.package_id);
        const fullPrice = formatReadableValue('full_price', log.new_data.full_price);
        const deposit = formatReadableValue('deposit_amount', log.new_data.deposit_amount);
        return (
          <span>
            Đã tạo lịch hẹn mới cho gói <strong className="text-slate-800 font-semibold">{pkg}</strong> (Giá trị: <span className="font-semibold text-slate-700">{fullPrice}</span>, Đã cọc: <span className="font-semibold text-emerald-600">{deposit}</span>).
          </span>
        );
      }
      
      if (log.table_name === 'session_logs') {
        const num = log.new_data.session_number;
        const date = log.new_data.assigned_date;
        const time = log.new_data.assigned_time;
        const ktv = log.new_data.completed_by_ktv_id ? ` cho KTV ${formatReadableValue('completed_by_ktv_id', log.new_data.completed_by_ktv_id)}` : '';
        return (
          <span>
            Đã xếp ca <strong className="text-rose-600 font-semibold">Buổi {num}</strong> vào ngày <span className="font-medium text-slate-700">{date}</span> lúc <span className="font-medium text-slate-700">{time}</span>{ktv}.
          </span>
        );
      }

      if (log.table_name === 'customers') {
        const mother = log.new_data.name_mother || 'Trống';
        const baby = log.new_data.name_baby ? ` (Bé: ${log.new_data.name_baby})` : '';
        const phone = log.new_data.phone ? ` - SĐT: ${log.new_data.phone}` : '';
        return (
          <span>
            Đã đăng ký khách hàng mới: Mẹ <strong className="text-slate-800 font-semibold">{mother}</strong>{baby}{phone}.
          </span>
        );
      }

      if (log.table_name === 'users') {
        const name = log.new_data.full_name;
        const role = formatReadableValue('role', log.new_data.role);
        return (
          <span>
            Đã thêm mới nhân sự: <strong className="text-slate-800 font-semibold">{name}</strong> (Chức vụ: <span className="font-medium text-slate-700">{role}</span>).
          </span>
        );
      }

      if (log.table_name === 'expenses') {
        const amount = formatReadableValue('amount', log.new_data.amount);
        const cat = formatReadableValue('category', log.new_data.category);
        const notes = log.new_data.notes ? ` (${log.new_data.notes})` : '';
        return (
          <span>
            Đã ghi nhận chi phí <strong className="text-rose-600 font-semibold">{amount}</strong> cho mục <span className="font-medium text-slate-700">{cat}</span>{notes}.
          </span>
        );
      }

      if (log.table_name === 'tenants') {
        const name = log.new_data.name;
        const addr = log.new_data.address ? ` tại ${log.new_data.address}` : '';
        return (
          <span>
            Đã khởi tạo đối tác chi nhánh mới: <strong className="text-slate-800 font-semibold">{name}</strong>{addr}.
          </span>
        );
      }

      // Generic fallback for insert
      const fields = Object.entries(log.new_data)
        .filter(([k, v]) => !EXCLUDED_KEYS.includes(k) && v !== null && v !== '');
      return (
        <span>
          Đã thêm mới bản ghi:
          <span className="inline-flex flex-wrap gap-x-2 gap-y-1 mt-1 text-xs">
            {fields.map(([k, v]) => (
              <span key={k} className="bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                <span className="text-slate-500">{FIELD_TRANSLATIONS[k] || k}:</span>{' '}
                <strong className="text-slate-700 font-medium">{formatReadableValue(k, v)}</strong>
              </span>
            ))}
          </span>
        </span>
      );
    }
    
    if (log.action === 'DELETE' && log.old_data) {
      const fields = Object.entries(log.old_data)
        .filter(([k, v]) => !EXCLUDED_KEYS.includes(k) && v !== null && v !== '');
      return (
        <span>
          Đã xóa bản ghi. Dữ liệu cũ:
          <span className="inline-flex flex-wrap gap-x-2 gap-y-1 mt-1 text-xs">
            {fields.map(([k, v]) => (
              <span key={k} className="bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                <span className="text-slate-500">{FIELD_TRANSLATIONS[k] || k}:</span>{' '}
                <span className="text-slate-700 line-through">{formatReadableValue(k, v)}</span>
              </span>
            ))}
          </span>
        </span>
      );
    }

    if (log.action === 'UPDATE' && log.old_data && log.new_data) {
      const changes = [];
      for (const key in log.new_data) {
        if (EXCLUDED_KEYS.includes(key)) continue;
        const oldVal = log.old_data[key];
        const newVal = log.new_data[key];
        if (oldVal !== newVal) {
          changes.push({ key, oldVal, newVal });
        }
      }
      if (changes.length === 0) return <span className="text-slate-400">Không có thay đổi cụ thể.</span>;
      
      // For a single change, render inline for elegance
      if (changes.length === 1) {
        const c = changes[0];
        return (
          <span>
            Thay đổi <span className="font-medium text-slate-700">{FIELD_TRANSLATIONS[c.key] || c.key}</span>:{' '}
            <span className="line-through text-slate-400 bg-slate-50 px-1 rounded">{formatReadableValue(c.key, c.oldVal)}</span>
            <span className="mx-1.5 text-rose-500">➔</span>
            <strong className="text-rose-600 font-semibold bg-rose-50 px-1 rounded">{formatReadableValue(c.key, c.newVal)}</strong>
          </span>
        );
      }

      // For multiple changes, render a clean list or stacked format
      return (
        <span className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Đã cập nhật {changes.length} thông tin:</span>
          <span className="flex flex-col gap-1.5 mt-1.5 pl-3 border-l border-rose-100 text-xs">
            {changes.map((c) => (
              <span key={c.key} className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 min-w-[120px]">{FIELD_TRANSLATIONS[c.key] || c.key}:</span>
                <span className="line-through text-slate-400 bg-slate-50 px-1 rounded">{formatReadableValue(c.key, c.oldVal)}</span>
                <span className="text-rose-500">➔</span>
                <strong className="text-rose-600 font-semibold bg-rose-50 px-1 rounded">{formatReadableValue(c.key, c.newVal)}</strong>
              </span>
            ))}
          </span>
        </span>
      );
    }
    
    return <span>Không có thông tin chi tiết.</span>;
  };

  const fetchReferenceMaps = async () => {
    try {
      const { data: users } = await supabase.from('users').select('id, full_name');
      const { data: packages } = await supabase.from('packages').select('id, name');
      const { data: customers } = await supabase.from('customers').select('id, name_mother, name_baby');
      
      const uMap: Record<string, string> = {};
      users?.forEach(u => { uMap[u.id] = u.full_name; });
      setUsersMap(uMap);
      
      const pMap: Record<string, string> = {};
      packages?.forEach(p => { pMap[p.id] = p.name; });
      setPackagesMap(pMap);
      
      const cMap: Record<string, string> = {};
      customers?.forEach(c => {
        cMap[c.id] = c.name_mother ? `Mẹ ${c.name_mother}${c.name_baby ? ` (Bé ${c.name_baby})` : ''}` : c.name_baby || 'Khách hàng';
      });
      setCustomersMap(cMap);
    } catch (err) {
      console.error('Error fetching reference maps:', err);
    }
  };

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Vui lòng đăng nhập để xem nhật ký.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
        
      if (!userData?.tenant_id) {
        toast.error('Lỗi hệ thống: Không xác định được Tenant ID.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      const tenantId = userData.tenant_id;

      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          users:changed_by_id(full_name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching logs:', error);
        toast.error('Lỗi khi tải nhật ký: ' + error.message);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedLogs = data?.map((log: any) => ({
        id: log.id,
        user_name: log.users?.full_name || 'Hệ thống',
        action: log.action,
        table_name: log.table_name,
        record_id: log.record_id,
        old_data: log.old_data,
        new_data: log.new_data,
        created_at: log.created_at
      })) || [];

      setLogs(formattedLogs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error('Không thể tải nhật ký hệ thống: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReferenceMaps();
    const timer = setTimeout(() => {
      fetchLogs();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTable, filterAction]);

  // Derived state to avoid cascading state update eslint warnings
  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = log.record_id.toLowerCase().includes(term) ||
                    log.user_name.toLowerCase().includes(term) ||
                    log.table_name.toLowerCase().includes(term);
      if (!match) return false;
    }

    if (filterTable !== 'all' && log.table_name !== filterTable) {
      return false;
    }

    if (filterAction !== 'all' && log.action !== filterAction) {
      return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatValue = (val: any) => {
    if (val === null || val === undefined) return 'N/A';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'UPDATE': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'DELETE': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 min-h-screen pb-20">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <History className="w-6 h-6 text-rose-500" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Audit Trail
            </h1>
          </div>
          <p className="text-slate-500 ml-11">
            Theo dõi và kiểm soát mọi thay đổi dữ liệu trong hệ thống.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <button 
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </motion.div>
      </div>

      {/* Filters section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm ID, User, Bảng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-rose-500/20 text-sm"
          />
        </div>

        <PremiumSelect
          value={filterTable}
          onChange={setFilterTable}
          options={[
            { value: 'all', label: 'Tất cả các bảng' },
            { value: 'revenue', label: 'Doanh thu' },
            { value: 'expenses', label: 'Chi phí' },
            { value: 'bookings', label: 'Lịch hẹn' },
            { value: 'session_logs', label: 'Ca làm việc KTV' },
            { value: 'customers', label: 'Khách hàng' },
            { value: 'users', label: 'Nhân viên' },
            { value: 'salary_records', label: 'Chốt lương' },
            { value: 'attendance', label: 'Chấm công nhân viên' },
            { value: 'packages', label: 'Gói dịch vụ' },
            { value: 'inventory_items', label: 'Kho hàng' },
            { value: 'package_materials', label: 'Định mức tiêu hao' },
            { value: 'session_reviews', label: 'Đánh giá của khách' },
            { value: 'tenants', label: 'Đối tác nhượng quyền' },
          ]}
        />

        <PremiumSelect
          value={filterAction}
          onChange={setFilterAction}
          options={[
            { value: 'all', label: 'Tất cả hành động' },
            { value: 'INSERT', label: 'Thêm mới' },
            { value: 'UPDATE', label: 'Cập nhật' },
            { value: 'DELETE', label: 'Xóa' },
          ]}
        />
        
        <div className="flex items-center justify-center text-slate-400 text-xs italic">
          Đang hiển thị {filteredLogs.length} bản ghi
        </div>
      </motion.div>

      {/* Table section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[180px] whitespace-nowrap">Thời gian</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[180px] whitespace-nowrap">Người thực hiện</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[120px] whitespace-nowrap">Hành động</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 w-[160px] whitespace-nowrap">Bảng dữ liệu</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 whitespace-nowrap">Chi tiết thay đổi</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right w-[80px] whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8 h-16 bg-slate-50/20 whitespace-nowrap"></td>
                  </tr>
                ))
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Clock className="w-4 h-4 text-slate-400 animate-pulse group-hover:text-rose-500 transition-colors shrink-0" />
                        <span className="text-sm text-slate-600 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                        <span className="text-sm font-medium text-slate-700 whitespace-nowrap">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${getActionColor(log.action)}`}>
                        {log.action === 'INSERT' ? 'Thêm mới' : log.action === 'UPDATE' ? 'Cập nhật' : 'Xóa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 whitespace-nowrap">
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {TABLE_TRANSLATIONS[log.table_name] || log.table_name}
                        </span>
                        <code className="text-[10px] text-slate-400 font-mono self-start bg-slate-50 px-1 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                          {log.table_name}
                        </code>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-[600px] break-words leading-relaxed">
                        {renderReadableChanges(log)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center whitespace-nowrap">
                    <div className="flex flex-col items-center gap-2 opacity-40 whitespace-nowrap">
                      <AlertCircle className="w-12 h-12" />
                      <p>Không có dữ liệu nhật ký nào.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Trang {currentPage} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Log Details Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Chi tiết thay đổi</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
                    Record ID: {selectedLog.record_id}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="mb-8 bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-blue-900 uppercase tracking-widest flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4" /> Diễn giải nội dung thay đổi (Dành cho Quản lý)
                  </h4>
                  <p className="text-slate-700 leading-relaxed text-sm">
                    {renderReadableChanges(selectedLog)}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Old Data */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      Dữ liệu cũ
                    </h4>
                    <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto min-h-[200px]">
                      <pre className="text-emerald-400 text-xs font-mono">
                        {formatValue(selectedLog.old_data)}
                      </pre>
                    </div>
                  </div>

                  {/* New Data */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-rose-500 uppercase tracking-widest flex items-center gap-2">
                      Dữ liệu mới
                      <ArrowRight className="w-4 h-4" />
                    </h4>
                    <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto min-h-[200px]">
                      <pre className="text-rose-400 text-xs font-mono">
                        {formatValue(selectedLog.new_data)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold">Lưu ý an ninh</p>
                    <p>Mọi thay đổi đều được mã hóa và lưu trữ vĩnh viễn. Chỉ quản trị viên cấp cao mới có quyền xem nhật ký này.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition-all"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
