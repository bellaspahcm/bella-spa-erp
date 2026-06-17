/**
 * Spa Package Types
 * 
 * Spa-specific package and service catalog types.
 * These extend the core CoreServiceCatalogItem with spa-specific fields.
 */

import type { Database } from '@/types/database.types';

// Database row types
export type ServicePackage = Database['public']['Tables']['packages']['Row'];
export type ServicePackageInsert = Database['public']['Tables']['packages']['Insert'];
export type ServicePackageUpdate = Database['public']['Tables']['packages']['Update'];

// Package configuration types
export type ServiceStatus = 'active' | 'inactive';
export type ServiceStatusFilter = 'all' | ServiceStatus;
export type ServiceModalMode = 'add' | 'edit';
export type ServiceModuleKey = 'babycare' | 'beauty_spa';
export type ServiceModuleFilter = 'all' | ServiceModuleKey;
export type ServiceKind = 'single_service' | 'treatment_package' | 'retail_product' | 'consultation';

// Package session multiplier types
export type PackageMultiplierLike = {
  name: string | null;
  session_multiplier: number | string | null;
};

export type SessionPackageLike = {
  name?: string | null;
  session_multiplier?: number | string | null;
};

// Package material types
export type PackageMaterialInput = {
  item_id?: string | null;
  quantity_per_session?: number | string | null;
};

export type PackageMaterialRow = Database['public']['Tables']['package_materials']['Row'];
export type PackageMaterialInsert = Database['public']['Tables']['package_materials']['Insert'];

export type MaterialRow = {
  item_id: string;
  quantity_per_session: number | '';
  name?: string;
  unit?: string;
};

// Session material types
export type SessionMaterialLike = {
  quantity_per_session?: number | string | null;
  inventory_items?: {
    name?: string | null;
    unit?: string | null;
  } | null;
};

// Package action types
export type PackageActionInput = {
  name: string;
  price?: number | string | null;
  duration?: string | null;
  total_sessions?: number | string | null;
  offer?: string | null;
  details?: string[] | null;
  ktv_commission?: number | string | null;
  status?: string | null;
  module_key?: string | null;
  service_kind?: string | null;
  service_category?: string | null;
  default_duration_minutes?: number | string | null;
  requires_resource?: boolean | null;
  default_resource_type?: string | null;
  before_after_required?: boolean | null;
  care_note_template?: string | null;
  session_multiplier?: number | string | null;
};

// Service form state
export type ServiceFormState = {
  name: string;
  price: string;
  duration: string;
  sessions: string;
  offer: string;
  details: string;
  ktvCommission: string;
  status: ServiceStatus;
  moduleKey: ServiceModuleKey;
  serviceKind: ServiceKind;
  serviceCategory: string;
  defaultDurationMinutes: string;
  requiresResource: boolean;
  defaultResourceType: 'bed' | 'room' | 'machine' | 'chair' | 'other';
  beforeAfterRequired: boolean;
  careNoteTemplate: string;
};

// HQ Package Template types
export interface HqPackageTemplate {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration?: string | null;
  total_sessions: number;
  details?: string[] | null;
  ktv_commission?: number | null;
  offer?: string | null;
  status?: string | null;
  is_hq_template: boolean;
  template_id?: string | null;
  price_cap?: number | null;
  price_floor?: number | null;
  allowed_franchise_override: boolean;
  created_at?: string;
  updated_at?: string;
}

// Landing page package types
export type PackageRow = Database['public']['Tables']['packages']['Row'];
export type LandingCategoryKey = 'bau' | 'sau-sinh' | 'baby' | 'combo';
