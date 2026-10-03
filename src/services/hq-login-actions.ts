'use server';

import { checkHqAuth } from './hq-actions';

export async function verifyHqLogin() {
  const auth = await checkHqAuth();

  if (!auth.authorized) {
    return {
      success: false,
      error: auth.error || 'Tài khoản này không có quyền truy cập Tổng bộ.',
    };
  }

  return { success: true };
}
