/**
 * Laboratory Order Bootstrap Public Semantics
 *
 * Proves Clinical Order -> LabOrder identity/bootstrap is available through the
 * public Laboratory contract, without requiring Hospital Product code to import
 * Laboratory repositories or direct Kernel persistence.
 */

import fs from 'fs';
import path from 'path';
import { LaboratoryEngineService } from '../../engines/laboratory-engine/laboratory-engine.service';
import { LabOrder } from '../../engines/laboratory-engine/domain/lab-order.entity';
import type { ILaboratoryRepository } from '../../engines/laboratory-engine/repositories/laboratory-repository.interface';
import type {
  BootstrapLabOrderRequest,
  ILaboratoryEngine,
} from '../laboratory-engine.contract';

const repoRoot = process.cwd();
const contractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/laboratory-engine.contract.ts');
const servicePath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/laboratory-engine.service.ts');
const productRoot = path.join(repoRoot, 'src/products/bella-hospital');

class MockLaboratoryRepository implements ILaboratoryRepository {
  public records: LabOrder[] = [];

  public async findById(tenantId: string, id: string): Promise<LabOrder | null> {
    return this.records.find((record) => record.tenantId === tenantId && record.id === id) ?? null;
  }

  public async findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<LabOrder[]> {
    return this.records.filter((record) => (
      record.tenantId === tenantId && record.clinicalOrderId === clinicalOrderId
    ));
  }

  public async save(labOrder: LabOrder): Promise<void> {
    const existingIndex = this.records.findIndex((record) => (
      record.tenantId === labOrder.tenantId && record.id === labOrder.id
    ));

    if (existingIndex >= 0) {
      this.records[existingIndex] = labOrder;
      return;
    }

    this.records.push(labOrder);
  }
}

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

describe('Laboratory Order Bootstrap Public Semantics', () => {
  const request: BootstrapLabOrderRequest = {
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    encounterId: 'encounter-1',
    orderId: 'order-1',
    testCode: 'CBC',
    testName: 'Complete Blood Count',
  };

  it('exposes a public bootstrap semantic with required Clinical Order linkage', () => {
    const contract = read(contractPath);

    expect(contract).toContain('export interface BootstrapLabOrderRequest');
    expect(contract).toContain('patientId: string');
    expect(contract).toContain('encounterId: string');
    expect(contract).toContain('orderId: string');
    expect(contract).toContain('testCode: string');
    expect(contract).toContain('testName: string');
    expect(contract).toContain('bootstrapLabOrder(request: BootstrapLabOrderRequest)');
    expect(contract).toContain('export interface BootstrapLabOrderResult');
    expect(contract).toContain('labOrderId: string');
    expect(contract).not.toContain('ILaboratoryRepository');
    expect(contract).not.toContain('hc_lab_orders');
  });

  it('bootstraps LabOrder through ILaboratoryEngine and returns linkage identifiers', async () => {
    const repository = new MockLaboratoryRepository();
    const laboratory: ILaboratoryEngine = new LaboratoryEngineService(repository);

    const result = await laboratory.bootstrapLabOrder(request);

    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-1',
      testCode: 'CBC',
      testName: 'Complete Blood Count',
      status: 'ORDERED',
      reusedExisting: false,
    });
    expect(result.labOrderId).toBeTruthy();
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0].clinicalOrderId).toBe('order-1');
  });

  it('reuses existing LabOrder for the same tenant, clinical order, and test code', async () => {
    const repository = new MockLaboratoryRepository();
    const laboratory: ILaboratoryEngine = new LaboratoryEngineService(repository);

    const first = await laboratory.bootstrapLabOrder(request);
    const second = await laboratory.bootstrapLabOrder(request);

    expect(second.labOrderId).toBe(first.labOrderId);
    expect(second.reusedExisting).toBe(true);
    expect(repository.records).toHaveLength(1);
  });

  it('keeps the existing Laboratory workflow states unchanged', () => {
    const service = read(servicePath);

    expect(service).toContain('bootstrapLabOrder(');
    expect(service).toContain("status: 'ORDERED'");
    expect(service).toContain('collectSpecimen(');
    expect(service).toContain('receiveSpecimen(');
    expect(service).toContain('startProcessing(');
    expect(service).toContain('recordResult(');
    expect(service).toContain('verifyResult(');
  });

  it('keeps Hospital Product out of Laboratory repository/internal persistence', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateLabEngine = /platform\/healthcare\/engines\/laboratory-engine/.test(line);
        const importsLegacyHealthcareLabService = /from ['"]@?\/?services\/healthcare\/(?:lis-ris-actions|laboratory-service|healthcare-actions)/.test(line);
        const directKernelPersistence = /\b(?:hc_lab_orders|hc_clinical_orders)\b/.test(line);

        if (importsPrivateLabEngine || importsLegacyHealthcareLabService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Laboratory bootstrap boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
