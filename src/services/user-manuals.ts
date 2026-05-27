'use server';

import fs from 'fs';
import path from 'path';
import { getCurrentUser } from './user-actions';
import { ALL_GUIDES, isManualPermitted } from './user-manuals-utils';
import type { GuideListItem } from './user-manuals-utils';

export type { GuideListItem };


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
