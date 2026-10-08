/**
 * Imaging Public Contract Minimal Semantics
 *
 * Proves the public Imaging/RIS contract boundary exists before Hospital
 * runtime is allowed to consume it.
 */

import fs from 'fs';
import path from 'path';
import type {
  BootstrapImagingOrderRequest,
  IImagingEngine,
  RecordImagingResultRequest,
} from '../imaging-engine.contract';
import { IMAGING_ENGINE_CONTRACT } from '../imaging-engine.contract';
import { ORDER_ENGINE_CONTRACT } from '../order-engine.contract';

const repoRoot = process.cwd();
const imagingContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/imaging-engine.contract.ts');
const contractsIndexPath = path.join(repoRoot, 'src/platform/healthcare/contracts/index.ts');
const serviceLocatorPath = path.join(repoRoot, 'src/platform/healthcare/service-locator.ts');
const orderContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/order-engine.contract.ts');
const legacyRisActionsPath = path.join(repoRoot, 'src/services/healthcare/lis-ris-actions.ts');
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

class ContractShapeProbe implements IImagingEngine {
  private bootstrapped: BootstrapImagingOrderRequest | null = null;

  public async bootstrapImagingOrder(request: BootstrapImagingOrderRequest) {
    const reusedExisting = this.bootstrapped?.tenantId === request.tenantId
      && this.bootstrapped.orderId === request.orderId;
    this.bootstrapped = request;

    return {
      tenantId: request.tenantId,
      patientId: request.patientId,
      encounterId: request.encounterId,
      orderId: request.orderId,
      imagingOrderId: `img-${request.orderId}`,
      modalityCode: request.modalityCode,
      bodyRegion: request.bodyRegion,
      status: 'PENDING' as const,
      reusedExisting,
    };
  }

  public async recordImagingResult(request: RecordImagingResultRequest) {
    return {
      tenantId: request.tenantId,
      imagingOrderId: request.imagingOrderId,
      status: 'VERIFIED' as const,
      radiologistReport: request.radiologistReport,
      radiologistId: request.radiologistId,
      verifiedAt: request.verifiedAt ?? '2026-10-07T00:00:00.000Z',
    };
  }
}

describe('Imaging Public Contract Minimal Semantics', () => {
  const bootstrapRequest: BootstrapImagingOrderRequest = {
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    encounterId: 'encounter-1',
    orderId: 'order-imaging-1',
    modalityCode: 'XRAY',
    bodyRegion: 'Chest',
    clinicalIndication: 'Fever and cough',
    withContrast: false,
  };

  it('exports a public Imaging/RIS contract and metadata', () => {
    const imagingContract = read(imagingContractPath);
    const contractsIndex = read(contractsIndexPath);

    expect(imagingContract).toContain('export interface IImagingEngine');
    expect(imagingContract).toContain('export interface BootstrapImagingOrderRequest');
    expect(imagingContract).toContain('export interface BootstrapImagingOrderResult');
    expect(imagingContract).toContain('bootstrapImagingOrder(request: BootstrapImagingOrderRequest)');
    expect(imagingContract).toContain('recordImagingResult(request: RecordImagingResultRequest)');
    expect(imagingContract).toContain('export const IMAGING_ENGINE_CONTRACT');

    expect(contractsIndex).toContain("export * from './imaging-engine.contract'");
    expect(contractsIndex).toContain('IMAGING_ENGINE_CONTRACT');
    expect(IMAGING_ENGINE_CONTRACT.name).toBe('imaging-engine');
    expect(IMAGING_ENGINE_CONTRACT.metadata).toMatchObject({
      runtimeStatus: 'minimal_runtime_available',
      eventSemantics: 'NO_NEW_EVENT',
      temporalAlignment: 'NOT_PROVEN',
    });
  });

  it('represents Clinical Order to Imaging Order linkage without persistence exposure', async () => {
    const imaging: IImagingEngine = new ContractShapeProbe();

    const result = await imaging.bootstrapImagingOrder(bootstrapRequest);

    expect(result).toEqual({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-imaging-1',
      imagingOrderId: 'img-order-imaging-1',
      modalityCode: 'XRAY',
      bodyRegion: 'Chest',
      status: 'PENDING',
      reusedExisting: false,
    });
  });

  it('exposes idempotency semantics at the public bootstrap boundary', async () => {
    const imaging: IImagingEngine = new ContractShapeProbe();

    const first = await imaging.bootstrapImagingOrder(bootstrapRequest);
    const second = await imaging.bootstrapImagingOrder(bootstrapRequest);

    expect(second.imagingOrderId).toBe(first.imagingOrderId);
    expect(second.reusedExisting).toBe(true);
  });

  it('exposes verified radiology result semantics without creating a runtime proof', async () => {
    const imaging: IImagingEngine = new ContractShapeProbe();

    const result = await imaging.recordImagingResult({
      tenantId: 'tenant-1',
      imagingOrderId: 'img-order-imaging-1',
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
      verifiedAt: '2026-10-07T01:00:00.000Z',
    });

    expect(result).toEqual({
      tenantId: 'tenant-1',
      imagingOrderId: 'img-order-imaging-1',
      status: 'VERIFIED',
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
      verifiedAt: '2026-10-07T01:00:00.000Z',
    });
  });

  it('preserves existing Order Engine IMAGING compatibility', () => {
    const orderContract = read(orderContractPath);
    const orderCreated = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderCreated');

    expect(orderContract).toContain("export type OrderType = 'MEDICATION' | 'LAB' | 'IMAGING' | 'PROCEDURE' | 'DIET' | 'NURSING'");
    expect(orderContract).toContain('export interface ImagingOrderDetails');
    expect(orderContract).toContain('modalityCode: string');
    expect(orderContract).toContain('bodyRegion: string');
    expect(orderCreated?.payloadSchema.schema?.properties?.orderType.enum).toContain('IMAGING');
  });

  it('does not expose repository, database row, or legacy RIS action types', () => {
    const imagingContract = read(imagingContractPath);
    const legacyRisActions = read(legacyRisActionsPath);

    expect(legacyRisActions).toContain("type ImagingOrderInsert = HealthcareTables['hc_imaging_orders']['Insert']");
    expect(imagingContract).not.toContain('ImagingOrderInsert');
    expect(imagingContract).not.toContain('ImagingOrderRow');
    expect(imagingContract).not.toContain('hc_imaging_orders');
    expect(imagingContract).not.toContain('Database');
    expect(imagingContract).not.toContain('Supabase');
    expect(imagingContract).not.toContain('Repository');
  });

  it('exposes service-locator wiring after the minimal runtime slice', () => {
    const serviceLocator = read(serviceLocatorPath);

    expect(serviceLocator).toContain("'imaging-engine': IImagingEngine");
    expect(serviceLocator).toContain("case 'imaging-engine'");
    expect(serviceLocator).toContain('new SupabaseImagingRepository(supabase)');
    expect(serviceLocator).toContain('new ImagingEngineService(repository)');
  });

  it('keeps Hospital Product out of Imaging persistence and legacy RIS services', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateImagingEngine = /platform\/healthcare\/engines\/(?:imaging|radiology|ris)-engine/.test(line);
        const importsLegacyRisService = /from ['"]@?\/?services\/healthcare\/(?:lis-ris-actions|healthcare-actions)/.test(line);
        const directKernelPersistence = /\b(?:hc_imaging_orders|hc_clinical_orders)\b/.test(line);

        if (importsPrivateImagingEngine || importsLegacyRisService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Imaging public contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
