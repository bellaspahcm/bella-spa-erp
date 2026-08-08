/**
 * React Hook: useOrderEngine
 *
 * Hook for consuming CPOE Order Engine operations in Hospital UI components.
 * Per Law 2: No direct DB queries, frontend consumes engine services.
 * Per Law 11: Strictly typed, zero `any` types.
 *
 * @module hooks/use-order-engine
 */

'use client';

import { useState, useMemo } from 'react';
import { OrderEngineService } from '@/platform/healthcare/engines/order-engine';
import { createClient } from '@/lib/supabase-client';
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
  const orderEngine = useMemo(() => new OrderEngineService(supabase), [supabase]);

  const createOrder = async (
    request: CreateOrderRequest
  ): Promise<EngineResponse<CreateOrderResult>> => {
    setLoading(true);
    setError(null);
    try {
      return await orderEngine.createOrder(request);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
