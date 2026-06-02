'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { recordAuditLog } from './audit-actions';
import { revalidatePath } from 'next/cache';
import type { Database, Json } from '@/types/database.types';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type PromotionRow = Database['public']['Tables']['promotions']['Row'];
type PromotionInsert = Database['public']['Tables']['promotions']['Insert'];
type PromotionUpdate = Database['public']['Tables']['promotions']['Update'];

function getErrorMessage(error: unknown, fallback = 'Lỗi không xác định') {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function promotionToAuditJson(promotion: PromotionRow): Json {
  return {
    id: promotion.id,
    title: promotion.title,
    description: promotion.description,
    image_url: promotion.image_url,
    discount_code: promotion.discount_code,
    discount_percent: promotion.discount_percent,
    start_date: promotion.start_date,
    end_date: promotion.end_date,
    is_active: promotion.is_active,
    tenant_id: promotion.tenant_id,
    created_at: promotion.created_at,
    updated_at: promotion.updated_at,
  };
}

function promotionToInsert(promotion: PromotionRow): PromotionInsert {
  return {
    id: promotion.id,
    title: promotion.title,
    description: promotion.description,
    image_url: promotion.image_url,
    discount_code: promotion.discount_code,
    discount_percent: promotion.discount_percent,
    start_date: promotion.start_date,
    end_date: promotion.end_date,
    is_active: promotion.is_active,
    tenant_id: promotion.tenant_id,
    created_at: promotion.created_at,
    updated_at: promotion.updated_at,
  };
}

async function getPromotionSnapshot(
  supabase: SupabaseClient,
  id: string,
  tenantId: string
): Promise<PromotionRow | null> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(`[getPromotionSnapshot] promotions query failed: ${error.message}`);
  }

  return data;
}

async function rollbackInsertedPromotion(
  supabase: SupabaseClient,
  id: string,
  tenantId: string
) {
  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`[rollbackInsertedPromotion] promotions delete failed: ${error.message}`);
  }
}

async function rollbackPromotionToggle(
  supabase: SupabaseClient,
  snapshot: PromotionRow,
  tenantId: string
) {
  const rollbackPayload: PromotionUpdate = {
    is_active: snapshot.is_active,
    updated_at: snapshot.updated_at,
  };

  const { error } = await supabase
    .from('promotions')
    .update(rollbackPayload)
    .eq('id', snapshot.id)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`[rollbackPromotionToggle] promotions update failed: ${error.message}`);
  }
}

async function restoreDeletedPromotion(
  supabase: SupabaseClient,
  snapshot: PromotionRow
) {
  const { error } = await supabase
    .from('promotions')
    .insert(promotionToInsert(snapshot));

  if (error) {
    throw new Error(`[restoreDeletedPromotion] promotions insert failed: ${error.message}`);
  }
}

/**
 * Lấy tất cả chương trình khuyến mãi thuộc chi nhánh (tenant) của người dùng hiện tại
 */
export async function getPromotions() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    return [];
  }

  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getPromotions] Lỗi lấy danh sách khuyến mãi:', error);
    throw new Error(`Lỗi truy vấn cơ sở dữ liệu: ${error.message}`);
  }

  return data || [];
}

/**
 * Thêm một chương trình khuyến mãi mới
 */
export async function createPromotion(payload: {
  title: string;
  description: string;
  image_url?: string | null;
  discount_code?: string | null;
  discount_percent?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return { success: false, error: 'Không có quyền thực hiện. Vui lòng đăng nhập.' };
  }

  const tenantId = currentUser.tenant_id;
  if (!tenantId) {
    return { success: false, error: 'Không xác định được chi nhánh của người dùng.' };
  }

  if (!payload.title || !payload.description) {
    return { success: false, error: 'Tiêu đề và Mô tả là bắt buộc.' };
  }

  const insertData: PromotionInsert = {
    title: payload.title,
    description: payload.description,
    image_url: payload.image_url ?? null,
    discount_code: payload.discount_code ?? null,
    discount_percent: payload.discount_percent !== undefined ? Number(payload.discount_percent) : null,
    start_date: payload.start_date ?? null,
    end_date: payload.end_date ?? null,
    is_active: payload.is_active !== undefined ? payload.is_active : true,
    tenant_id: tenantId,
  };

  const { data, error } = await supabase
    .from('promotions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[createPromotion] Lỗi thêm khuyến mãi:', error);
    return { success: false, error: error.message };
  }

  try {
    await recordAuditLog({
      action: 'INSERT',
      table_name: 'promotions',
      record_id: data.id,
      new_data: promotionToAuditJson(data),
    });
  } catch (auditError) {
    try {
      await rollbackInsertedPromotion(supabase, data.id, tenantId);
    } catch (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after promotion insert: ${getErrorMessage(auditError)}. Rollback failed: ${getErrorMessage(rollbackError)}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after promotion insert: ${getErrorMessage(auditError)}`,
    };
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/crm');
  return { success: true, data };
}

/**
 * Kích hoạt hoặc hủy kích hoạt một chương trình khuyến mãi
 */
export async function togglePromotionActive(id: string, is_active: boolean) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: 'Không có quyền thực hiện. Vui lòng đăng nhập.' };
  }

  const tenantId = currentUser.tenant_id;
  if (!tenantId) {
    return { success: false, error: 'Không xác định được chi nhánh của người dùng.' };
  }

  let snapshot: PromotionRow | null;
  try {
    snapshot = await getPromotionSnapshot(supabase, id, tenantId);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }

  if (!snapshot) {
    return { success: false, error: 'Không tìm thấy khuyến mãi thuộc chi nhánh hiện tại.' };
  }

  const updatePayload: PromotionUpdate = {
    is_active,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('promotions')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[togglePromotionActive] Lỗi cập nhật trạng thái khuyến mãi:', error);
    return { success: false, error: error.message };
  }

  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'promotions',
      record_id: id,
      old_data: promotionToAuditJson(snapshot),
      new_data: promotionToAuditJson(data),
    });
  } catch (auditError) {
    try {
      await rollbackPromotionToggle(supabase, snapshot, tenantId);
    } catch (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after promotion update: ${getErrorMessage(auditError)}. Rollback failed: ${getErrorMessage(rollbackError)}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after promotion update: ${getErrorMessage(auditError)}`,
    };
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/crm');
  return { success: true, data };
}

/**
 * Xóa một chương trình khuyến mãi
 */
export async function deletePromotion(id: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, error: 'Không có quyền thực hiện. Vui lòng đăng nhập.' };
  }

  const tenantId = currentUser.tenant_id;
  if (!tenantId) {
    return { success: false, error: 'Không xác định được chi nhánh của người dùng.' };
  }

  let snapshot: PromotionRow | null;
  try {
    snapshot = await getPromotionSnapshot(supabase, id, tenantId);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }

  if (!snapshot) {
    return { success: false, error: 'Không tìm thấy khuyến mãi thuộc chi nhánh hiện tại.' };
  }

  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[deletePromotion] Lỗi xóa khuyến mãi:', error);
    return { success: false, error: error.message };
  }

  try {
    await recordAuditLog({
      action: 'DELETE',
      table_name: 'promotions',
      record_id: id,
      old_data: promotionToAuditJson(snapshot),
    });
  } catch (auditError) {
    try {
      await restoreDeletedPromotion(supabase, snapshot);
    } catch (rollbackError) {
      return {
        success: false,
        error: `Audit log failed after promotion delete: ${getErrorMessage(auditError)}. Rollback failed: ${getErrorMessage(rollbackError)}`,
      };
    }

    return {
      success: false,
      error: `Audit log failed after promotion delete: ${getErrorMessage(auditError)}`,
    };
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/crm');
  return { success: true };
}
