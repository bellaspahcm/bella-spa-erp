/**
 * React Hook: useOrderEngine
 *
 * Hook for consuming CPOE Order Engine operations in Hospital UI components.
 * Per Law 2: No direct DB queries, frontend consumes engine services.
 * Per Law 11: Strictly typed, zero `any` types.
 *
 * **STATUS:** ✅ MIGRATED TO CONTRACT-FIRST (Week 2 Day 3 - P1 Remediation)
 *
 * @module hooks/use-order-engine
 */

'use client';

import { useState, useMemo } from 'react';
import { getHealthcareService } from '@/platform/healthcare';
import { createClient } from '@/lib/supabase-client';
import type { OrderEngineContract } from '@/platform/healthcare/contracts/order-engine.contract';
import type {
  CreateOrderRequest,
  CreateOrderResult,
  ApproveOrderRequest,
  DiscontinueOrderRequest,
  OverrideCdsWarningRequest,
  GetActiveOrdersRequest,
  ClinicalOrder,
  CdsOverrideRecord,
} from '@/platform/healthcare/contracts/order-engine.contract';
import type { EngineResponse } from '@/platform/healthcare/shared-kernel/types';

export function useOrderEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();
  const orderEngine = useMemo(
    () => getHealthcareService<OrderEngineContract>('order-engine', supabase),
    [supabase]
  );

  const createOrder = async (
    request: CreateOrderRequest
  ): Promise<EngineResponse<CreateOrderResult>> => {
    setLoading(true);
    setError(null);
    try {
      return await orderEngine.createOrder(request);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in createOrder');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const approveOrder = async (
    request: ApproveOrderRequest
  ): Promise<EngineResponse<ClinicalOrder>> => {
    setLoading(true);
    setError(null);
    try {
      return await orderEngine.approveOrder(request);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in approveOrder');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const discontinueOrder = async (
    request: DiscontinueOrderRequest
  ): Promise<EngineResponse<ClinicalOrder>> => {
    setLoading(true);
    setError(null);
    try {
      return await orderEngine.discontinueOrder(request);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in discontinueOrder');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const getActiveOrders = async (
    request: GetActiveOrdersRequest
  ): Promise<EngineResponse<ClinicalOrder[]>> => {
    setLoading(true);
    setError(null);
    try {
      return await orderEngine.getActiveOrders(request);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in getActiveOrders');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  const overrideCdsWarning = async (
    request: OverrideCdsWarningRequest
  ): Promise<EngineResponse<CdsOverrideRecord>> => {
    setLoading(true);
    setError(null);
    try {
      return await orderEngine.overrideCdsWarning(request);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error('Unknown error in overrideCdsWarning');
      setError(e);
      return {
        success: false,
        error: { code: 'HOOK_ERROR', message: e.message, timestamp: new Date().toISOString() },
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createOrder,
    approveOrder,
    discontinueOrder,
    getActiveOrders,
    overrideCdsWarning,
  };
}
