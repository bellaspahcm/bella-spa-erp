import { readFileSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();

function readSource(path: string): string {
  return readFileSync(join(projectRoot, path), 'utf8');
}

describe('Accounting semantic configuration UI wiring', () => {
  it('keeps the MVP UI scoped to proven accounting semantics and COA selections', () => {
    const tabSource = readSource('src/app/dashboard/settings/components/AccountingConfigTab.tsx');
    const serviceSource = readSource('src/core/services/accounting/semantic-config.ts');
    const typeSource = readSource('src/core/services/accounting/semantic-config.types.ts');

    expect(typeSource).toContain("'SERVICE_REVENUE' | 'REVENUE_DEDUCTION' | 'GOODS_REVENUE'");
    expect(tabSource).toContain('getAccountingSemanticConfig');
    expect(tabSource).toContain('saveAccountingSemanticMapping');
    expect(tabSource).toContain('<select');
    expect(tabSource).not.toContain('ACCOUNT_521');
    expect(serviceSource).toContain('finance_save_accounting_semantic_gl_mapping');
    expect(serviceSource).toContain("['admin', 'super_admin', 'accountant']");
  });
});
