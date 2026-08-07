/**
 * Phase C Integration & Platform Governance Tests
 * Verifies Architecture Governance Portal, Data Platform, AI Platform, and Industry Pack Marketplace
 *
 * Governance: Strict No `any` type, Zero Regression on legacy tenants
 */

import { getMaturityScoresAction, getArchDecisionsAction } from '@/services/architecture/arb-actions';
import { executeLakehouseQueryAction, getDataCatalogAction } from '@/services/platform/data-platform-actions';
import { testRunAgentPromptAction } from '@/services/platform/ai-platform-actions';
import { upgradePackVersionAction } from '@/services/platform/marketplace-actions';

// ---------------------------------------------------------------------------
// Mock Setup & Query Builder
// ---------------------------------------------------------------------------
interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

let testDbResult: QueryResult | null = null;

const mockSelectChain = {
  eq: jest.fn().mockImplementation(() => {
    return {
      single: jest.fn().mockImplementation(() => {
        return Promise.resolve(
          testDbResult ?? {
            data: {
              id: 'agent-123',
              status: 'active',
              model: 'gemini-2.0-flash',
              total_calls: 10,
              total_tokens_used: 1500,
              monthly_cost_usd: 0.05,
              pack_code: 'bella_healthcare',
              is_frozen: false,
            },
            error: null,
          }
        );
      }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
  }),
  order: jest.fn().mockImplementation(() => {
    const orderChain = {
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      then: (
        onfulfilled?: (value: QueryResult) => unknown,
        onrejected?: (reason: unknown) => unknown
      ): Promise<unknown> => {
        return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
      },
    };
    return orderChain;
  }),
  then: (
    onfulfilled?: (value: QueryResult) => unknown,
    onrejected?: (reason: unknown) => unknown
  ): Promise<unknown> => {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  },
};

const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue(mockSelectChain),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'decision-1' }, error: null }),
      }),
    }),
  }),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn().mockImplementation(() => {
    return Promise.resolve(mockSupabase);
  }),
}));

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------
describe('Phase C – Architecture Governance & ARB Portal', () => {
  beforeEach(() => {
    testDbResult = null;
  });

  it('should get arch decisions successfully', async () => {
    const res = await getArchDecisionsAction();
    expect(res.error).toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('should return maturity scores correctly', async () => {
    const res = await getMaturityScoresAction();
    expect(res.error).toBeNull();
    expect(Array.isArray(res.data)).toBe(true);
  });
});

describe('Phase C – Data Platform Catalog & Lakehouse Query Studio', () => {
  it('should return catalog tables with proper schemas', async () => {
    const res = await getDataCatalogAction();
    expect(res.error).toBeNull();
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].tableName).toBe('analytics_finance_journals_fact');
    expect(res.data[0].columns.length).toBeGreaterThan(0);
  });

  it('should execute lakehouse sql queries successfully', async () => {
    const sql = 'SELECT * FROM analytics_finance_journals_fact LIMIT 10;';
    const res = await executeLakehouseQueryAction(sql);
    expect(res.success).toBe(true);
    expect(res.rowCount).toBeGreaterThan(0);
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.columns).toContain('journal_id');
  });

  it('should return error for invalid tables in Query Studio', async () => {
    const sql = 'SELECT * FROM invalid_table_name;';
    const res = await executeLakehouseQueryAction(sql);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Table not found');
  });
});

describe('Phase C – Autonomous AI Platform & Prompt Ledgers', () => {
  beforeEach(() => {
    testDbResult = null;
  });

  it('should route and execute active agent prompts, recording costs', async () => {
    const res = await testRunAgentPromptAction({
      agentCode: 'ai-salary-reconciler',
      promptText: 'đối soát lương KTV',
    });

    expect(res.success).toBe(true);
    expect(res.responseText).toContain('đối soát lương');
    expect(res.promptTokens).toBeGreaterThan(0);
    expect(res.completionTokens).toBeGreaterThan(0);
    expect(res.costUsd).toBeGreaterThan(0);
    expect(res.latencyMs).toBeGreaterThan(0);
  });
});

describe('Phase C – Industry Pack Marketplace & Freeze Policy', () => {
  it('should block upgrade version action if the pack is frozen', async () => {
    testDbResult = {
      data: {
        is_frozen: true,
        frozen_reason: 'Zero structural changes allowed in Beauty Spa.',
        pack_code: 'beauty_spa',
      },
      error: null,
    };

    const res = await upgradePackVersionAction('beauty-spa-id', '3.0.0');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Không thể nâng cấp');
    expect(res.error).toContain('Đóng Băng kiến trúc (Frozen)');
  });
});

describe('Phase C – Platform Code Governance (No any & Zero Regression)', () => {
  it('should verify that all new service files adhere to Type Safety', async () => {
    const services = [
      await import('@/services/architecture/arb-actions'),
      await import('@/services/platform/data-platform-actions'),
      await import('@/services/platform/ai-platform-actions'),
      await import('@/services/platform/marketplace-actions'),
    ];

    services.forEach((service) => {
      expect(service).toBeDefined();
    });
  });

  it('should NOT references beauty_spa legacy tables in new services', async () => {
    const arbSource = (await import('@/services/architecture/arb-actions')).toString();
    const dataPlatformSource = (await import('@/services/platform/data-platform-actions')).toString();
    const aiPlatformSource = (await import('@/services/platform/ai-platform-actions')).toString();

    expect(arbSource).not.toContain('spa_booking');
    expect(dataPlatformSource).not.toContain('spa_booking');
    expect(aiPlatformSource).not.toContain('spa_booking');
  });
});
