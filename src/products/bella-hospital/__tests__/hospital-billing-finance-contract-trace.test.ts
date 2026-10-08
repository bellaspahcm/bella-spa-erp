/**
 * BELLA HOSPITAL - BILLING/FINANCE CONTRACT TRACE
 *
 * Proves Hospital billing/payment can reuse the existing Finance OS event
 * boundary and keeps ledger/reconciliation downstream of Finance OS.
 */

import fs from 'fs';
import path from 'path';
import { DefaultSemanticResolver } from '../../../platform/finance/resolvers/semantic-resolver.service';

const repoRoot = process.cwd();
const hospitalFinanceAdapterPath = path.join(
  repoRoot,
  'src/platform/healthcare/finance-integration/hospital-finance-adapter.ts'
);
const financeEventTypesPath = path.join(repoRoot, 'src/platform/integration-hub/finance-event-contract.types.ts');
const financeOutboxWriterPath = path.join(repoRoot, 'src/platform/integration-hub/finance-outbox-writer.ts');
const hospitalBillingFinancePath = path.join(
  repoRoot,
  'src/products/bella-hospital/services/hospital-billing-finance.service.ts'
);
const productRoot = path.join(repoRoot, 'src/products/bella-hospital');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function relative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

describe('Bella Hospital Billing/Finance Contract Trace', () => {
  it('finds existing Hospital Finance adapter public events for charge and payment', () => {
    const adapter = read(hospitalFinanceAdapterPath);
    const eventTypes = read(financeEventTypesPath);
    const outboxWriter = read(financeOutboxWriterPath);

    expect(adapter).toContain('export class HospitalFinanceAdapter');
    expect(adapter).toContain('publishPatientServiceCompleted');
    expect(adapter).toContain('publishPatientPaymentReceived');
    expect(adapter).toContain("eventType: 'PATIENT_SERVICE_COMPLETED'");
    expect(adapter).toContain("eventType: 'PATIENT_PAYMENT_RECEIVED'");

    expect(eventTypes).toContain("'PATIENT_SERVICE_COMPLETED'");
    expect(eventTypes).toContain("'PATIENT_PAYMENT_RECEIVED'");
    expect(eventTypes).toContain("patient_type: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY'");
    expect(eventTypes).toContain("service_type: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'PHARMACY'");

    expect(outboxWriter).toContain("sourceSystem: 'HOSPITAL_OS'");
    expect(outboxWriter).toContain("eventType: 'PATIENT_SERVICE_COMPLETED'");
    expect(outboxWriter).toContain("from('finance_outbox_events')");
  });

  it('proves Finance OS semantic resolver supports Hospital charge and payment events', async () => {
    const resolver = new DefaultSemanticResolver();

    expect(resolver.isEventTypeSupported('PATIENT_SERVICE_COMPLETED')).toBe(true);
    expect(resolver.isEventTypeSupported('PATIENT_PAYMENT_RECEIVED')).toBe(true);
    expect(resolver.getSupportedEventTypes()).toContain('PATIENT_SERVICE_COMPLETED');
    expect(resolver.getSupportedEventTypes()).toContain('PATIENT_PAYMENT_RECEIVED');
  });

  it('keeps Hospital product at adapter boundary without ledger/accounting policy logic', () => {
    const hospitalBillingFinance = read(hospitalBillingFinancePath);
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    expect(hospitalBillingFinance).toContain('HospitalFinanceAdapter');
    expect(hospitalBillingFinance).toContain('publishPatientServiceCompleted');
    expect(hospitalBillingFinance).toContain('publishPatientPaymentReceived');
    expect(hospitalBillingFinance).not.toContain('account_code');
    expect(hospitalBillingFinance).not.toContain('debit_amount');
    expect(hospitalBillingFinance).not.toContain('credit_amount');
    expect(hospitalBillingFinance).not.toContain('.from(');

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const directFinancePersistence =
          /\b(?:finance_outbox_events|finance_receivable_ledger|finance_receivable_positions|accounting_outbox)\b/.test(line);
        const directLedgerLogic =
          /\b(?:account_code|debit_amount|credit_amount|accounting_entries)\b/.test(line);

        if (directFinancePersistence || directLedgerLogic) {
          violations.push(`${relative(file)}:L${index + 1} Hospital Finance boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
