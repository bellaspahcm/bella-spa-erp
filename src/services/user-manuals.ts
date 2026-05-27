'use server';

import fs from 'fs';
import path from 'path';
import { getCurrentUser } from './user-actions';

export interface GuideListItem {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  description: string;
}

const ALL_GUIDES: GuideListItem[] = [
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
  if (!role) return false;
  const normalizedRole = role.toLowerCase();
  const normalizedSlug = slug.toLowerCase();

  // SOP & Hub index are visible to everyone authenticated
  if (normalizedSlug === 'sop' || normalizedSlug === 'index') {
    return true;
  }

  // Admin has absolute access
  if (normalizedRole === 'admin') {
    return true;
  }

  // KTV guide: visible to ktv, ktv_lead, hr, admin
  if (normalizedSlug === 'ktv') {
    return ['ktv', 'ktv_lead', 'hr'].includes(normalizedRole);
  }

  // HR guide: visible to hr, admin
  if (normalizedSlug === 'hr') {
    return normalizedRole === 'hr';
  }

  // Accountant guide: visible to accountant, admin
  if (normalizedSlug === 'accountant') {
    return normalizedRole === 'accountant';
  }

  // Admin guide is restricted solely to admin
  return false;
}

/**
 * Lấy danh sách tài liệu hướng dẫn được phép xem của người dùng hiện tại
 */
export async function getPermittedGuides(): Promise<GuideListItem[]> {
  const user = await getCurrentUser();
  if (!user || !user.role) {
    return [];
  }
  
  return ALL_GUIDES.filter((guide) => isManualPermitted(user.role, guide.slug));
}

/**
 * Đọc nội dung HTML của tài liệu
 */
export async function getGuideHtml(slug: string): Promise<{ success: boolean; content?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !user.role) {
    return { success: false, error: 'Unauthorized: Vui lòng đăng nhập lại.' };
  }

  if (!isManualPermitted(user.role, slug)) {
    return { success: false, error: 'Access Denied: Bạn không có quyền xem tài liệu này.' };
  }

  try {
    const filename = `${slug.toLowerCase()}.html`;
    const filePath = path.join(process.cwd(), 'docs', 'user-manuals', filename);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File Not Found: Tài liệu không tồn tại.' };
    }

    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content: htmlContent };
  } catch (err: any) {
    console.error('Error reading manual file:', err);
    return { success: false, error: `Internal Server Error: ${err.message}` };
  }
}
