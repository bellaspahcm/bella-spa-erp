/**
 * BELLA HOSPITAL - IMAGING CONTRACT TRACE
 *
 * Trace guard. This suite separates public Order Engine imaging support from
 * the missing public Imaging/RIS contract and keeps runtime semantics unproven.
 */

import fs from 'fs';
import path from 'path';
import { ORDER_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/order-engine.contract';

const repoRoot = process.cwd();

const orderContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/order-engine.contract.ts');
const contractsIndexPath = path.join(repoRoot, 'src/platform/healthcare/contracts/index.ts');
const imagingContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/imaging-engine.contract.ts');
const serviceLocatorPath = path.join(repoRoot, 'src/platform/healthcare/service-locator.ts');
const legacyRisActionsPath = path.join(repoRoot, 'src/services/healthcare/lis-ris-actions.ts');
const healthcareActionsPath = path.join(repoRoot, 'src/services/healthcare/healthcare-actions.ts');
const hospitalAncillaryPagePath = path.join(repoRoot, 'src/app/dashboard/hospital/ancillary/page.tsx');
const hospitalClinicalOrdersPath = path.join(
  repoRoot,
  'src/products/bella-hospital/services/hospital-clinical-orders.service.ts'
);
const hospitalLaboratoryRuntimeTestPath = path.join(
  repoRoot,
  'src/products/bella-hospital/services/__tests__/hospital-laboratory-workflow-result-minimal-runtime.test.ts'
);
const financeAdapterPath = path.join(repoRoot, 'src/platform/healthcare/finance-integration/hospital-finance-adapter.ts');
const temporalContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/temporal-engine.contract.ts');
const productRoot = path.join(repoRoot, 'src/products/bella-hospital');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
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

describe('Bella Hospital Imaging Contract Trace', () => {
  it('finds imaging order detail support in the public Order Engine contract', () => {
    const orderContract = read(orderContractPath);
    const orderCreated = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderCreated');
    const orderApproved = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderApproved');
    const orderActivated = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderActivated');

    expect(orderContract).toContain("export type OrderType = 'MEDICATION' | 'LAB' | 'IMAGING' | 'PROCEDURE' | 'DIET' | 'NURSING'");
    expect(orderContract).toContain('export interface ImagingOrderDetails');
    expect(orderContract).toContain('modalityCode: string');
    expect(orderContract).toContain('bodyRegion: string');
    expect(orderContract).toContain('withContrast: boolean');
    expect(orderContract).toContain('clinicalIndication: string');
    expect(orderContract).toContain("orderType: { type: 'string', enum: ['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING'] }");

    expect(orderCreated?.subscribers).not.toContain('imaging-engine');
    expect(orderApproved?.subscribers).not.toContain('imaging-engine');
    expect(orderActivated?.subscribers).not.toContain('imaging-engine');
  });

  it('finds the public Imaging/RIS contract and minimal service-locator runtime', () => {
    const contractsIndex = read(contractsIndexPath);
    const imagingContract = read(imagingContractPath);
    const serviceLocator = read(serviceLocatorPath);

    expect(exists('src/platform/healthcare/contracts/imaging-engine.contract.ts')).toBe(true);
    expect(exists('src/platform/healthcare/contracts/radiology-engine.contract.ts')).toBe(false);
    expect(exists('src/platform/healthcare/contracts/ris-engine.contract.ts')).toBe(false);
    expect(exists('src/platform/healthcare/engines/imaging-engine')).toBe(true);
    expect(exists('src/platform/healthcare/engines/radiology-engine')).toBe(false);
    expect(exists('src/platform/healthcare/engines/ris-engine')).toBe(false);

    expect(imagingContract).toContain('export interface IImagingEngine');
    expect(imagingContract).toContain('bootstrapImagingOrder(request: BootstrapImagingOrderRequest)');
    expect(imagingContract).toContain('recordImagingResult(request: RecordImagingResultRequest)');
    expect(imagingContract).toContain('runtimeStatus: \'minimal_runtime_available\'');

    expect(contractsIndex).toContain("export * from './imaging-engine.contract'");
    expect(contractsIndex).toContain('IMAGING_ENGINE_CONTRACT');
    expect(contractsIndex).not.toContain('RADIOLOGY_ENGINE_CONTRACT');
    expect(contractsIndex).not.toContain('RIS_ENGINE_CONTRACT');

    expect(serviceLocator).toContain("'imaging-engine': IImagingEngine");
    expect(serviceLocator).toContain("case 'imaging-engine'");
    expect(serviceLocator).toContain('new SupabaseImagingRepository(supabase)');
    expect(serviceLocator).toContain('new ImagingEngineService(repository)');
    expect(serviceLocator).not.toContain("'radiology-engine'");
    expect(serviceLocator).not.toContain("'ris-engine'");
  });

  it('classifies current RIS actions as legacy direct persistence, not public Healthcare contract proof', () => {
    const legacyRisActions = read(legacyRisActionsPath);
    const healthcareActions = read(healthcareActionsPath);

    expect(legacyRisActions).toContain("type ImagingOrderInsert = HealthcareTables['hc_imaging_orders']['Insert']");
    expect(legacyRisActions).toContain("type ImagingOrderRow = HealthcareTables['hc_imaging_orders']['Row']");
    expect(legacyRisActions).toContain("order_type: 'imaging'");
    expect(legacyRisActions).toContain(".from('hc_clinical_orders')");
    expect(legacyRisActions).toContain(".from('hc_imaging_orders')");
    expect(legacyRisActions).toContain('export async function createImagingOrderAction');
    expect(legacyRisActions).toContain('export async function updateImagingReportAction');

    expect(healthcareActions).toContain("order_type: 'imaging'");
    expect(healthcareActions).toContain(".from('hc_imaging_orders')");
    expect(healthcareActions).toContain('export async function createImagingOrderAction');
    expect(healthcareActions).toContain('export async function verifyImagingResultAction');
  });

  it('keeps Hospital UI imaging surface as legacy/mock evidence, not product runtime proof', () => {
    const ancillaryPage = read(hospitalAncillaryPagePath);

    expect(ancillaryPage).toContain("from '@/services/healthcare/lis-ris-actions'");
    expect(ancillaryPage).toContain('MOCK_IMAGING_ORDERS');
    expect(ancillaryPage).toContain('createImagingOrderAction');
    expect(ancillaryPage).toContain('updateImagingReportAction');
    expect(ancillaryPage).toContain('PACSReport');
  });

  it('keeps sealed Hospital runtime services from depending on Imaging internals', () => {
    const clinicalOrders = read(hospitalClinicalOrdersPath);
    const laboratoryRuntimeTest = read(hospitalLaboratoryRuntimeTestPath);
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    expect(clinicalOrders).toContain('OrderEngineContract');
    expect(clinicalOrders).not.toContain('imaging-engine');
    expect(clinicalOrders).not.toContain('radiology-engine');
    expect(clinicalOrders).not.toContain('ris-engine');
    expect(clinicalOrders).not.toContain('hc_imaging_orders');

    expect(laboratoryRuntimeTest).toContain("orderType: 'IMAGING'");
    expect(laboratoryRuntimeTest).toContain('LABORATORY_RUNTIME_UNSUPPORTED_ORDER_TYPE: IMAGING');

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateImagingEngine = /platform\/healthcare\/engines\/(?:imaging|radiology|ris)-engine/.test(line);
        const importsLegacyRisService = /from ['"]@?\/?services\/healthcare\/(?:lis-ris-actions|healthcare-actions)/.test(line);
        const directKernelPersistence = /\b(?:hc_imaging_orders|hc_clinical_orders)\b/.test(line);

        if (importsPrivateImagingEngine || importsLegacyRisService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Imaging contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('finds downstream categories but keeps Imaging runtime, temporal, and finance semantics unproven', () => {
    const financeAdapter = read(financeAdapterPath);
    const temporalContract = read(temporalContractPath);

    expect(financeAdapter).toContain("serviceType?: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'PHARMACY'");
    expect(temporalContract).toContain("'MEDICATIONS' | 'ALLERGIES' | 'LAB_RESULTS' | 'VITAL_SIGNS' | 'ORDERS' | 'DECISIONS'");
    expect(temporalContract).not.toContain('IMAGING_RESULTS');
    expect(temporalContract).not.toContain('RADIOLOGY_RESULTS');
  });
});
