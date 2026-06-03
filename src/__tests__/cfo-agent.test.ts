import { runCFOAgent } from '../services/ai/agents/cfo';

const baseArgs = [
  'tenant-1',
  new Date('2026-06-03T00:00:00.000Z'),
  '2026-06-03',
  '2026-06-01',
] as const;

function createSupabaseMock(result: { data?: unknown; error?: { message: string } | null }) {
  return {
    rpc: jest.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
  } as any;
}

describe('runCFOAgent reconciliation report handling', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('throws immediately when reconciliation RPC returns an error', async () => {
    const supabase = createSupabaseMock({
      error: { message: 'reconciliation rpc failed' },
    });

    await expect(
      runCFOAgent(supabase, ...baseArgs, 'đối soát sổ sách')
    ).rejects.toMatchObject({ message: 'reconciliation rpc failed' });

    expect(supabase.rpc).toHaveBeenCalledWith('get_reconciliation_report', {
      p_tenant_id: 'tenant-1',
      p_from_date: '2026-06-01',
      p_to_date: '2026-06-03',
    });
  });

  it('accepts an empty reconciliation array as a valid no-difference report', async () => {
    const supabase = createSupabaseMock({ data: [] });

    const result = await runCFOAgent(supabase, ...baseArgs, 'đối soát sổ sách');

    expect(result.reportType).toBe('reconciliation');
    expect(result.summary).toContain('Phát hiện 0 chênh lệch');
    expect(result.data).toEqual([]);
    expect(result.draftProposals).toEqual([]);
  });

  it('creates a reconciliation audit draft proposal when major differences exist', async () => {
    const rows = [
      { status: 'OK', amount: 1000 },
      { status: 'MAJOR_DIFF', amount: 250000 },
    ];
    const supabase = createSupabaseMock({ data: rows });

    const result = await runCFOAgent(supabase, ...baseArgs, 'đối soát sổ sách');

    expect(result.summary).toContain('Phát hiện 1 chênh lệch');
    expect(result.data).toEqual(rows);
    expect(result.draftProposals).toEqual([
      expect.objectContaining({
        type: 'reconciliation_audit',
      }),
    ]);
  });

  it('throws when reconciliation RPC returns a non-array payload without an error', async () => {
    const supabase = createSupabaseMock({
      data: { status: 'MAJOR_DIFF' },
    });

    await expect(
      runCFOAgent(supabase, ...baseArgs, 'đối soát sổ sách')
    ).rejects.toThrow('Invalid get_reconciliation_report response: expected an array');
  });
});
