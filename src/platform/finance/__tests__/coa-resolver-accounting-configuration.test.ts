/**
 * Accounting Configuration Foundation — SERVICE_REVENUE runtime pilot
 *
 * Verifies Business Semantic -> Tenant Accounting Mapping -> GL account resolution.
 */

jest.mock('server-only', () => ({}), { virtual: true });

import { DefaultCOAResolver } from '../resolvers/coa-resolver.service';
import type { AccountingIntent, PolicyContext } from '../finance-event-handler';

type RpcCall = {
  fn: string;
  args: {
    p_tenant_id: string;
    p_semantic_key: string;
    p_as_of: string;
    p_contract_version: string;
  };
};

function createPolicyContext(effectiveDate: string): PolicyContext {
  return {
    version: 'v1.0',
    regime: 'DEFAULT',
    recognition_rules: {
      accounting_effective_date: effectiveDate,
    },
  };
}

function createStrictPolicyContext(effectiveDate: string): PolicyContext {
  return {
    ...createPolicyContext(effectiveDate),
    accounting_mapping_policy: 'CONFIGURATION_REQUIRED',
  };
}

const revenueIntent: AccountingIntent = {
  intent_type: 'RECOGNIZE_REVENUE',
  credit_amount: '100000',
  description: 'Recognize service revenue',
};

const revenueDeductionIntent: AccountingIntent = {
  intent_type: 'REVERSE_REVENUE',
  debit_amount: '100000',
  description: 'Refund service revenue',
};

const goodsRevenueIntent: AccountingIntent = {
  intent_type: 'RECOGNIZE_GOODS_REVENUE',
  credit_amount: '100000',
  description: 'Recognize goods revenue',
};

describe('DefaultCOAResolver accounting configuration pilot', () => {
  it('resolves SERVICE_REVENUE from tenant mapping instead of hardcoded default', async () => {
    const calls: RpcCall[] = [];
    const supabase = {
      rpc: jest.fn(async (fn: string, args: RpcCall['args']) => {
        calls.push({ fn, args });
        return {
          data: [{ gl_account_code: args.p_tenant_id === 'tenant-a' ? '5113' : '5111' }],
          error: null,
        };
      }),
    };
    const resolver = new DefaultCOAResolver(supabase as never);

    const tenantA = await resolver.resolve('tenant-a', [revenueIntent], createPolicyContext('2026-06-30'));
    const tenantB = await resolver.resolve('tenant-b', [revenueIntent], createPolicyContext('2026-06-30'));

    expect(tenantA[0].account_code).toBe('5113');
    expect(tenantB[0].account_code).toBe('5111');
    expect(calls).toEqual([
      {
        fn: 'finance_get_accounting_semantic_gl_map_as_of',
        args: {
          p_tenant_id: 'tenant-a',
          p_semantic_key: 'SERVICE_REVENUE',
          p_as_of: '2026-06-30',
          p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1',
        },
      },
      {
        fn: 'finance_get_accounting_semantic_gl_map_as_of',
        args: {
          p_tenant_id: 'tenant-b',
          p_semantic_key: 'SERVICE_REVENUE',
          p_as_of: '2026-06-30',
          p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1',
        },
      },
    ]);
  });

  it('uses the policy effective date when reading tenant mapping', async () => {
    const supabase = {
      rpc: jest.fn(async () => ({
        data: [{ gl_account_code: '5113' }],
        error: null,
      })),
    };
    const resolver = new DefaultCOAResolver(supabase as never);

    await resolver.resolve('tenant-a', [revenueIntent], createPolicyContext('2027-01-15'));

    expect(supabase.rpc).toHaveBeenCalledWith(
      'finance_get_accounting_semantic_gl_map_as_of',
      expect.objectContaining({
        p_as_of: '2027-01-15',
      })
    );
  });

  it('keeps the pilot compatibility fallback when SERVICE_REVENUE is not configured yet', async () => {
    const supabase = {
      rpc: jest.fn(async () => ({
        data: [],
        error: null,
      })),
    };
    const resolver = new DefaultCOAResolver(supabase as never);

    const mappings = await resolver.resolve('tenant-unconfigured', [revenueIntent], createPolicyContext('2026-06-30'));

    expect(mappings[0].account_code).toBe('4111');
  });

  it.each([
    ['SERVICE_REVENUE', revenueIntent],
    ['REVENUE_DEDUCTION', revenueDeductionIntent],
    ['GOODS_REVENUE', goodsRevenueIntent],
  ])(
    'requires tenant configuration for %s when onboarding strict mapping policy is enabled',
    async (semanticKey, intent) => {
      const supabase = {
        rpc: jest.fn(async () => ({
          data: [],
          error: null,
        })),
      };
      const resolver = new DefaultCOAResolver(supabase as never);

      await expect(
        resolver.resolve('tenant-new', [intent], createStrictPolicyContext('2026-06-30'))
      ).rejects.toThrow(`CONFIGURATION_REQUIRED: Missing tenant accounting mapping for ${semanticKey}`);
    }
  );

  it('resolves REVENUE_DEDUCTION from tenant mapping for refund revenue reversal', async () => {
    const supabase = {
      rpc: jest.fn(async () => ({
        data: [{ gl_account_code: '521' }],
        error: null,
      })),
    };
    const resolver = new DefaultCOAResolver(supabase as never);

    const mappings = await resolver.resolve('tenant-a', [revenueDeductionIntent], createPolicyContext('2026-06-30'));

    expect(mappings[0].account_code).toBe('521');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'finance_get_accounting_semantic_gl_map_as_of',
      expect.objectContaining({
        p_semantic_key: 'REVENUE_DEDUCTION',
        p_as_of: '2026-06-30',
      })
    );
  });

  it('resolves GOODS_REVENUE from tenant mapping for product sale revenue', async () => {
    const supabase = {
      rpc: jest.fn(async () => ({
        data: [{ gl_account_code: '5112' }],
        error: null,
      })),
    };
    const resolver = new DefaultCOAResolver(supabase as never);

    const mappings = await resolver.resolve('tenant-a', [goodsRevenueIntent], createPolicyContext('2026-06-30'));

    expect(mappings[0].account_code).toBe('5112');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'finance_get_accounting_semantic_gl_map_as_of',
      expect.objectContaining({
        p_semantic_key: 'GOODS_REVENUE',
        p_as_of: '2026-06-30',
      })
    );
  });
});
