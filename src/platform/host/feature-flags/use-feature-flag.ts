/**
 * React Hook: useFeatureFlag
 * 
 * React hook for evaluating feature flags in components.
 * 
 * @module platform/host/feature-flags
 */

'use client';

import { useState, useEffect } from 'react';
import { FeatureFlagService } from './feature-flag.service';
import type { FeatureFlagContext, FeatureFlagEvaluationResult } from './types';

/**
 * React hook for feature flag evaluation
 * 
 * @param flagKey - Feature flag key
 * @param context - Evaluation context (tenant, user, etc.)
 * @returns Object with enabled state, loading state, and evaluation result
 * 
 * @example
 * ```tsx
 * const { enabled, loading } = useFeatureFlag('healthcare.new-engine-architecture', {
 *   tenantId: tenant.id,
 *   userId: user.id
 * });
 * 
 * if (loading) return <Spinner />;
 * 
 * return enabled ? <NewEngineUI /> : <LegacyServiceUI />;
 * ```
 */
export function useFeatureFlag(
  flagKey: string,
  context: FeatureFlagContext = {}
) {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [result, setResult] = useState<FeatureFlagEvaluationResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const evaluateFlag = async () => {
      try {
        setLoading(true);
        setError(null);

        const featureFlagService = FeatureFlagService.getInstance();
        const evaluation = await featureFlagService.evaluate(flagKey, context);

        if (mounted) {
          setResult(evaluation);
          setEnabled(evaluation.enabled);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to evaluate feature flag'));
          setEnabled(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void evaluateFlag();

    return () => {
      mounted = false;
    };
  }, [flagKey, context.tenantId, context.userId]);

  return {
    enabled,
    loading,
    result,
    error,
  };
}

/**
 * React hook for batch feature flag evaluation
 * 
 * @param flagKeys - Array of feature flag keys
 * @param context - Evaluation context
 * @returns Map of flag key to evaluation result + loading state
 * 
 * @example
 * ```tsx
 * const { flags, loading } = useFeatureFlags([
 *   'healthcare.new-engine-architecture',
 *   'platform.event-bus-publishing',
 *   'platform.strict-type-safety'
 * ], { tenantId: tenant.id });
 * 
 * if (loading) return <Spinner />;
 * 
 * const useNewEngines = flags.get('healthcare.new-engine-architecture')?.enabled ?? false;
 * const useEventBus = flags.get('platform.event-bus-publishing')?.enabled ?? false;
 * ```
 */
export function useFeatureFlags(
  flagKeys: string[],
  context: FeatureFlagContext = {}
) {
  const [flags, setFlags] = useState<Map<string, FeatureFlagEvaluationResult>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const evaluateFlags = async () => {
      try {
        setLoading(true);
        setError(null);

        const featureFlagService = FeatureFlagService.getInstance();
        const evaluations = await featureFlagService.evaluateBatch(flagKeys, context);

        if (mounted) {
          setFlags(evaluations);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to evaluate feature flags'));
          setFlags(new Map());
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void evaluateFlags();

    return () => {
      mounted = false;
    };
  }, [flagKeys.join(','), context.tenantId, context.userId]);

  return {
    flags,
    loading,
    error,
    isEnabled: (key: string) => flags.get(key)?.enabled ?? false,
  };
}
