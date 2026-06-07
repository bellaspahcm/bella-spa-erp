import { isManualPermittedByRole } from '@/lib/business-rules/permissions';

export interface GuideListItem {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
}

export const ALL_GUIDES: GuideListItem[] = [
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
 * Kiểm tra quyền truy cập của role đối với tài liệu tương ứng
 */
export function isManualPermitted(role: string | null | undefined, slug: string): boolean {
  return isManualPermittedByRole(role, slug);
}
