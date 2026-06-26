/**
 * React Hook: useModuleVocabulary
 * 
 * Provides module-specific vocabulary for UI components.
 * Automatically updates when tenant module changes.
 * 
 * Usage:
 * ```tsx
 * const vocab = useModuleVocabulary();
 * 
 * <h1>Danh sách {vocab.worker.plural}</h1>
 * <button>Thêm {vocab.worker.singular}</button>
 * <p>{vocab.workUnit.singular} đã hoàn thành</p>
 * ```
 */

import { useMemo } from 'react';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';
import { getModuleVocabulary, type ModuleVocabulary } from '@/lib/business-rules/module-vocabulary';

export function useModuleVocabulary(): ModuleVocabulary {
  const { tenantModuleKey } = useTenantModuleKey();
  
  return useMemo(() => getModuleVocabulary(tenantModuleKey), [tenantModuleKey]);
}

