import { isManualPermittedByRole } from '@/lib/business-rules/permissions';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

export interface GuideListItem {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  modules?: TenantModuleKey[]; // Which modules this guide applies to (undefined = all modules)
}

/**
 * Bella Spa (Baby Care) Guides
 */
const BABYCARE_GUIDES: GuideListItem[] = [
  {
    slug: 'sop',
    title: 'Quy trình SOP',
    subtitle: 'SOP · Chuẩn vận hành',
    icon: '📜',
    description: 'Quy trình vận hành tiêu chuẩn áp dụng bắt buộc cho toàn bộ chi nhánh và mọi vị trí.',
  },
  {
    slug: 'ktv',
    title: 'Sổ tay Kỹ thuật viên',
    subtitle: 'KTV · Mobile Experience',
    icon: '💆',
    description: 'Hướng dẫn check-in GPS, check-out, xem lịch hẹn chuẩn, và hoa hồng cá nhân.',
  },
  {
    slug: 'hr',
    title: 'Sổ tay Nhân sự',
    subtitle: 'HR · Employee Lifecycle',
    icon: '👥',
    description: 'Quy trình tuyển dụng, onboarding, chấm công, phê duyệt nghỉ phép và chốt lương.',
  },
  {
    slug: 'accountant',
    title: 'Sổ tay Kế toán',
    subtitle: 'Accountant · Sổ cái',
    icon: '📚',
    description: 'Đối soát sao kê ngân hàng, lương AI, quản lý hệ thống tài khoản COA và đóng kỳ.',
  },
  {
    slug: 'admin',
    title: 'Sổ tay Quản trị viên',
    subtitle: 'Admin · Full Control',
    icon: '👑',
    description: 'Cấu hình chi nhánh, thiết lập Zalo OA, phân quyền nhân sự tối cao và bảo mật hệ thống.',
  },
];

/**
 * Beauty Spa Guides
 */
const BEAUTY_SPA_GUIDES: GuideListItem[] = [
  {
    slug: 'sop-beauty',
    title: 'Quy trình SOP Spa',
    subtitle: 'SOP · Vận hành Spa',
    icon: '📋',
    description: 'Quy trình vận hành tiêu chuẩn cho spa làm đẹp: check-in, tư vấn, liệu trình, thanh toán.',
  },
  {
    slug: 'therapist',
    title: 'Sổ tay Chuyên viên',
    subtitle: 'Therapist · Thực hiện liệu trình',
    icon: '💅',
    description: 'Hướng dẫn thực hiện liệu trình chăm sóc da, massage, nail, và các dịch vụ spa làm đẹp.',
  },
  {
    slug: 'hr-beauty',
    title: 'Sổ tay Nhân sự Spa',
    subtitle: 'HR · Quản lý nhân viên',
    icon: '👥',
    description: 'Tuyển dụng chuyên viên spa, đào tạo kỹ năng, chấm công và quản lý hoa hồng.',
  },
  {
    slug: 'accountant-beauty',
    title: 'Sổ tay Kế toán Spa',
    subtitle: 'Accountant · Tài chính Spa',
    icon: '💰',
    description: 'Quản lý doanh thu dịch vụ, chi phí nguyên vật liệu, đối soát công nợ khách hàng.',
  },
];

/**
 * Industrial Cleaning Guides
 */
const CLEANING_GUIDES: GuideListItem[] = [
  {
    slug: 'sop-cleaning',
    title: 'Quy trình SOP Vệ sinh',
    subtitle: 'SOP · Vận hành Dịch vụ',
    icon: '🧹',
    description: 'Quy trình vận hành tiêu chuẩn cho dịch vụ vệ sinh công nghiệp: an toàn, chất lượng, báo cáo.',
  },
  {
    slug: 'worker',
    title: 'Sổ tay Nhân viên vệ sinh',
    subtitle: 'NVS · Thực hiện công việc',
    icon: '🧤',
    description: 'Hướng dẫn check-in tại địa điểm, thực hiện ca vệ sinh, báo cáo hoàn thành và an toàn lao động.',
  },
  {
    slug: 'supervisor',
    title: 'Sổ tay Giám sát',
    subtitle: 'Supervisor · Quản lý hiện trường',
    icon: '🎯',
    description: 'Quản lý đội ngũ NVS, phân công công việc, kiểm tra chất lượng và xử lý sự cố.',
  },
  {
    slug: 'hr-cleaning',
    title: 'Sổ tay Nhân sự Dịch vụ',
    subtitle: 'HR · Quản lý NVS',
    icon: '👷',
    description: 'Tuyển dụng NVS, đào tạo kỹ năng, chấm công ca làm việc và quản lý lương.',
  },
  {
    slug: 'accountant-cleaning',
    title: 'Sổ tay Kế toán Dịch vụ',
    subtitle: 'Accountant · Tài chính B2B',
    icon: '📊',
    description: 'Quản lý hợp đồng doanh nghiệp, thanh toán định kỳ, chi phí vật tư và lương NVS.',
  },
];

/**
 * Real Estate Module Guides
 */
const REAL_ESTATE_GUIDES: GuideListItem[] = [
  {
    slug: 're-sop',
    title: 'Quy trình vận hành BĐS',
    subtitle: 'SOP · Chuẩn vận hành',
    icon: '🏢',
    description: 'Quy trình tiếp nhận lead, phân công Sale, theo dõi SLA và chốt hợp đồng đặt cọc.',
  },
  {
    slug: 're-sale',
    title: 'Sổ tay Sale Agent',
    subtitle: 'Sale · Quy trình bán hàng',
    icon: '🤝',
    description: 'Hướng dẫn tiếp nhận lead, theo dõi tiến trình tư vấn, đặt lịch xem căn hộ và chốt cọc.',
  },
  {
    slug: 're-broker',
    title: 'Sổ tay Môi giới',
    subtitle: 'Broker · Hợp tác phân phối',
    icon: '🏘️',
    description: 'Đăng ký môi giới, nhận lead từ hệ thống, tra cứu bảng hàng và theo dõi hoa hồng.',
  },
  {
    slug: 're-contracts',
    title: 'Quy trình Hợp đồng & Đặt cọc',
    subtitle: 'Legal · Pháp lý giao dịch',
    icon: '📝',
    description: 'Lập hợp đồng đặt cọc, kiểm tra pháp lý căn hộ, quản lý tiến độ thanh toán và bàn giao.',
  },
  {
    slug: 're-hr',
    title: 'Sổ tay Nhân sự BĐS',
    subtitle: 'HR · Quản lý nhân sự',
    icon: '👥',
    description: 'Tuyển dụng Sale Agent và Môi giới, phân quyền chi nhánh, chấm công và tính hoa hồng.',
  },
  {
    slug: 're-finance',
    title: 'Sổ tay Kế toán BĐS',
    subtitle: 'Accountant · Tài chính dự án',
    icon: '💰',
    description: 'Quản lý dòng tiền đặt cọc, đối soát công nợ khách đầu tư, báo cáo doanh thu theo dự án.',
  },
  {
    slug: 're-admin',
    title: 'Sổ tay Quản trị BĐS',
    subtitle: 'Admin · Cấu hình hệ thống',
    icon: '⚙️',
    description: 'Cấu hình dự án, thiết lập ma trận phân quyền, quản lý SLA tự động và tích hợp dữ liệu.',
  },
];

/**
 * Get guides for a specific module
 */
export function getModuleGuides(moduleKey: TenantModuleKey | null | undefined): GuideListItem[] {
  if (moduleKey === 'real_estate') {
    return REAL_ESTATE_GUIDES;
  }

  if (moduleKey === 'industrial_cleaning') {
    return CLEANING_GUIDES;
  }
  
  if (moduleKey === 'beauty_spa') {
    return BEAUTY_SPA_GUIDES;
  }
  
  // Default: Bella Spa (Baby Care)
  return BABYCARE_GUIDES;
}

export const ALL_GUIDES: GuideListItem[] = [
  ...BABYCARE_GUIDES,
  ...BEAUTY_SPA_GUIDES,
  ...CLEANING_GUIDES,
  ...REAL_ESTATE_GUIDES,
];

/**
 * Kiểm tra quyền truy cập của role đối với tài liệu tương ứng
 */
export function isManualPermitted(role: string | null | undefined, slug: string): boolean {
  return isManualPermittedByRole(role, slug);
}
