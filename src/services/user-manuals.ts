'use server';

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
