'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { ProductService } from '../services/ProductService';
import { ReservationExpiryEngine } from '../services/ReservationExpiryEngine';
import { Database } from '@/types/database.types';
import { revalidatePath } from 'next/cache';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

export interface ProductResult {
  success: boolean;
  data?: ProductRow | ProductRow[] | null;
  error?: string;
}

export async function fetchProductsAction(
  projectId: string
): Promise<ProductResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }
    if (!projectId) {
      return { success: false, error: 'Project ID is required' };
    }

    const products = await ProductService.getProducts(supabase, user.tenant_id, projectId);
    return { success: true, data: products };
  } catch (error) {
    console.error('[productActions] Error in fetchProductsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}

export async function updateProductStatusAction(
  productId: string,
  targetStatus: ProductRow['status'],
  ownerName?: string | null
): Promise<ProductResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const updatedProduct = await ProductService.updateProductStatus(
      supabase,
      user.tenant_id,
      productId,
      targetStatus,
      ownerName
    );

    revalidatePath(`/dashboard/real-estate/projects/${updatedProduct.project_id}`);
    revalidatePath(`/dashboard/real-estate/products/${productId}`);

    return { success: true, data: updatedProduct };
  } catch (error) {
    console.error('[productActions] Error in updateProductStatusAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}

export async function releaseExpiredBookingsAction(
  holdHours: number = 24
): Promise<ProductResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const released = await ReservationExpiryEngine.checkAndReleaseExpiredHoldings(
      supabase,
      user.tenant_id,
      holdHours
    );

    revalidatePath('/dashboard/real-estate');

    return { success: true, data: released };
  } catch (error) {
    console.error('[productActions] Error in releaseExpiredBookingsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}

export async function updateProductDetailsAction(
  productId: string,
  payload: {
    unit_price?: number;
    area?: number;
    product_code?: string;
    product_type?: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | 'land_plot' | 'office';
    block?: string | null;
    floor?: string | null;
  }
): Promise<ProductResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const updatedProduct = await ProductService.updateProductDetails(
      supabase,
      user.tenant_id,
      productId,
      payload
    );

    revalidatePath('/dashboard/real-estate');
    revalidatePath('/dashboard/real-estate/apartments');
    revalidatePath(`/dashboard/real-estate/projects/${updatedProduct.project_id}`);
    revalidatePath(`/dashboard/real-estate/products/${productId}`);

    return { success: true, data: updatedProduct };
  } catch (error) {
    console.error('[productActions] Error in updateProductDetailsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error'
    };
  }
}

