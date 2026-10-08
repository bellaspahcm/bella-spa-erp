/**
 * BELLA HOSPITAL - LABORATORY CONTRACT TRACE
 *
 * Trace guard. This suite proves Laboratory has a reusable Healthcare contract
 * and keeps Hospital Lab workflow/result/downstream semantics explicitly
 * NOT_PROVEN.
 */

import fs from 'fs';
import path from 'path';
import { ORDER_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/order-engine.contract';

const repoRoot = process.cwd();

const orderContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/order-engine.contract.ts');
const labContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/laboratory-engine.contract.ts');
const contractsIndexPath = path.join(repoRoot, 'src/platform/healthcare/contracts/index.ts');
const serviceLocatorPath = path.join(repoRoot, 'src/platform/healthcare/service-locator.ts');
const labServicePath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/laboratory-engine.service.ts');
const labSubscriberPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/events/order-approved-subscriber.ts');
const labOrderPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/domain/lab-order.entity.ts');
const labEventsPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/events/laboratory.events.ts');
const labClinicalOrderReaderPath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/laboratory-engine/repositories/supabase-clinical-order-reader.ts'
);
const labRepositoryPath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/laboratory-engine/repositories/supabase-laboratory.repository.ts'
);
const temporalContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/temporal-engine.contract.ts');
const financeAdapterPath = path.join(repoRoot, 'src/platform/healthcare/finance-integration/hospital-finance-adapter.ts');
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

describe('Bella Hospital Laboratory Contract Trace', () => {
  it('finds LAB order support in the public Order Engine contract', () => {
    const orderContract = read(orderContractPath);
    const orderApproved = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderApproved');
    const orderCreated = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderCreated');
    const orderActivated = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderActivated');

    expect(orderContract).toContain("export type OrderType = 'MEDICATION' | 'LAB' | 'IMAGING' | 'PROCEDURE' | 'DIET' | 'NURSING'");
    expect(orderContract).toContain('export interface LabOrderDetails');
    expect(orderContract).toContain('testCode: string');
    expect(orderContract).toContain('testName: string');

    expect(orderCreated?.description).toContain('lab notification (if LAB)');
    expect(orderCreated?.subscribers).toContain('laboratory-engine');
    expect(orderApproved?.description).toContain('lab collection workflow (if LAB)');
    expect(orderApproved?.subscribers).toContain('laboratory-engine');
    expect(orderActivated?.subscribers).toContain('laboratory-engine');
  });

  it('finds a Laboratory contract file and public index/metadata exposure', () => {
    const labContract = read(labContractPath);
    const contractsIndex = read(contractsIndexPath);

    expect(labContract).toContain('export interface ILaboratoryEngine');
    expect(labContract).toContain('collectSpecimen(');
    expect(labContract).toContain('receiveSpecimen(tenantId: string, labOrderId: string)');
    expect(labContract).toContain('startProcessing(tenantId: string, labOrderId: string)');
    expect(labContract).toContain('recordResult(');
    expect(labContract).toContain('verifyResult(');
    expect(labContract).toContain('acknowledgeCritical(');
    expect(labContract).toContain('export const LABORATORY_ENGINE_CONTRACT');

    expect(contractsIndex).toContain("export * from './laboratory-engine.contract'");
    expect(contractsIndex).toContain('LABORATORY_ENGINE_CONTRACT');
  });

  it('captures service-locator typing and construction through the Laboratory repository', () => {
    const serviceLocator = read(serviceLocatorPath);
    const labService = read(labServicePath);

    expect(serviceLocator).toContain("'laboratory-engine': ILaboratoryEngine");
    expect(serviceLocator).toContain("case 'laboratory-engine'");
    expect(serviceLocator).toContain('new SupabaseLaboratoryRepository(supabase)');
    expect(serviceLocator).toContain('new LaboratoryEngineService(repository)');

    expect(labService).toContain('export class LaboratoryEngineService implements ILaboratoryEngine');
    expect(labService).toContain('private readonly repository: ILaboratoryRepository');
    expect(labService).not.toContain('constructor(private readonly supabase');
  });

  it('captures LAB value alignment at the order-to-laboratory boundary', () => {
    const subscriber = read(labSubscriberPath);
    const clinicalOrderReader = read(labClinicalOrderReaderPath);

    expect(subscriber).toContain("const LAB_ORDER_TYPES = new Set(['LAB', 'laboratory'])");
    expect(subscriber).toContain('if (!LAB_ORDER_TYPES.has(snapshot.orderType))');
    expect(clinicalOrderReader).toContain('orderType: data.order_type');

    const orderContract = read(orderContractPath);
    expect(orderContract).toContain("orderType: { type: 'string', enum: ['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING'] }");
  });

  it('traces Lab workflow states, result events, and linkage semantics gaps', () => {
    const labOrder = read(labOrderPath);
    const labEvents = read(labEventsPath);
    const clinicalOrderReader = read(labClinicalOrderReaderPath);
    const repository = read(labRepositoryPath);

    expect(labOrder).toContain("'ORDERED'");
    expect(labOrder).toContain("'COLLECTED'");
    expect(labOrder).toContain("'RECEIVED'");
    expect(labOrder).toContain("'PROCESSING'");
    expect(labOrder).toContain("'RESULTED'");
    expect(labOrder).toContain("'VERIFIED'");
    expect(labOrder).toContain('clinicalOrderId: string');
    expect(labOrder).toContain('encounterId: string');
    expect(labOrder).toContain('patientId: string');

    expect(labEvents).toContain("eventType: 'SpecimenCollected'");
    expect(labEvents).toContain("eventType: 'ResultVerified'");
    expect(labEvents).toContain("eventType: 'CriticalResultEscalated'");
    expect(labEvents).toContain('encounterId: string');
    expect(labEvents).toContain('labOrderId: string');

    expect(clinicalOrderReader).toContain('patientId: data.encounter_id');
    expect(repository).toContain('patientId: row.encounter_id');
  });

  it('finds downstream contracts/categories but keeps runtime semantics not proven', () => {
    const temporalContract = read(temporalContractPath);
    const financeAdapter = read(financeAdapterPath);

    expect(temporalContract).toContain("'MEDICATIONS' | 'ALLERGIES' | 'LAB_RESULTS' | 'VITAL_SIGNS' | 'ORDERS' | 'DECISIONS'");
    expect(financeAdapter).toContain("serviceType?: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'PHARMACY'");
  });

  it('does not introduce direct Lab persistence or legacy Lab actions in Hospital Product implementation', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateLabEngine = /platform\/healthcare\/engines\/laboratory-engine/.test(line);
        const importsLegacyHealthcareLabService = /from ['"]@?\/?services\/healthcare\/(?:lis-ris-actions|laboratory-service|healthcare-actions)/.test(line);
        const directKernelPersistence = /\b(?:hc_lab_orders|hc_clinical_orders)\b/.test(line);

        if (importsPrivateLabEngine || importsLegacyHealthcareLabService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Laboratory contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
