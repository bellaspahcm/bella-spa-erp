import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const financeKernelClientPath = path.join(repoRoot, 'src/platform/finance/resolvers/kernel-client.service.ts');
const f5ReadContractPath = path.join(
  repoRoot,
  'supabase/migrations/20261002030000_reapply_f5_f1_read_contract_source_id_cast.sql'
);
const hospitalFinanceWorkerArtifactPath = path.join(
  repoRoot,
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_FINANCE_WORKER_EXECUTION_PROOF_2026_10_08.md'
);

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Hospital reconciliation read-back trace', () => {
  it('blocks promotion when Hospital Finance worker persistence is not consumed by F5 read contract', () => {
    const kernelClient = read(financeKernelClientPath);
    const f5ReadContract = read(f5ReadContractPath);
    const workerArtifact = read(hospitalFinanceWorkerArtifactPath);

    expect(kernelClient).toContain(".from('journal_entries')");
    expect(kernelClient).toContain(".from('journal_lines')");
    expect(kernelClient).toContain('finance_transaction_metadata');

    expect(f5ReadContract).toContain('CREATE OR REPLACE FUNCTION public.finance_journal_entries_as_of');
    expect(f5ReadContract).toContain('FROM public.finance_transactions ft');
    expect(f5ReadContract).toContain('JOIN public.finance_transaction_lines ftl');

    expect(workerArtifact).toContain('journal_entries');
    expect(workerArtifact).toContain('HOSPITAL_FINANCE_WORKER_EXECUTION_PROOF = PASS');
    expect(workerArtifact).toContain('RECONCILIATION_READ_BACK = NOT_PROVEN');
  });
});
