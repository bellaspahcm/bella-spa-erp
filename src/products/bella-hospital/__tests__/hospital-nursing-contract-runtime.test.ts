/**
 * BELLA HOSPITAL - NURSING CONTRACT/RUNTIME TRACE
 *
 * Proves the Hospital Nursing branch consumes the public Nursing contract and
 * that the Healthcare Nursing engine uses canonical vital-sign persistence.
 */

import fs from 'fs';
import path from 'path';
import { NURSING_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/nursing-engine.contract';

const repoRoot = process.cwd();
const contractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/nursing-engine.contract.ts');
const serviceLocatorPath = path.join(repoRoot, 'src/platform/healthcare/service-locator.ts');
const engineServicePath = path.join(repoRoot, 'src/platform/healthcare/engines/nursing-engine/nursing-engine.service.ts');
const hospitalServicePath = path.join(repoRoot, 'src/products/bella-hospital/services/hospital-nursing.service.ts');
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

describe('Bella Hospital Nursing Contract Runtime', () => {
  it('finds active public Nursing contract semantics for vital signs', () => {
    const contract = read(contractPath);

    expect(NURSING_ENGINE_CONTRACT.status).toBe('active');
    expect(contract).toContain('export interface NursingEngineContract');
    expect(contract).toContain('recordVitalSigns(request: RecordVitalsRequest)');
    expect(contract).toContain('getVitalSigns(tenantId: string, encounterId: string, limit?: number)');
    expect(contract).toContain('createNursingNote(request:');
    expect(contract).toContain('eventType: \'VitalsRecorded\'');
  });

  it('wires nursing-engine through the Healthcare service locator', () => {
    const serviceLocator = read(serviceLocatorPath);

    expect(serviceLocator).toContain("import type { NursingEngineContract } from './contracts/nursing-engine.contract'");
    expect(serviceLocator).toContain("'nursing-engine': NursingEngineContract");
    expect(serviceLocator).toContain("case 'nursing-engine'");
    expect(serviceLocator).toContain("require('./engines/nursing-engine')");
    expect(serviceLocator).toContain('new NursingEngineService(supabase)');
  });

  it('aligns Nursing engine vitals runtime to canonical hc_nursing_vital_signs schema', () => {
    const engineService = read(engineServicePath);

    expect(engineService).toContain("Database['public']['Tables']['hc_nursing_vital_signs']['Row']");
    expect(engineService).toContain("Database['public']['Tables']['hc_nursing_vital_signs']['Insert']");
    expect(engineService).toContain(".from('hc_nursing_vital_signs')");
    expect(engineService).toContain('nurse_practitioner_id: request.recordedBy');
    expect(engineService).toContain('systolic_bp: bloodPressure.systolic');
    expect(engineService).toContain('diastolic_bp: bloodPressure.diastolic');
    expect(engineService).toContain('spo2: oxygenSaturation.value');
    expect(engineService).not.toContain(".from('hc_vital_signs')");
    expect(engineService).toContain('NURSING_NOTE_PERSISTENCE_NOT_SUPPORTED');
  });

  it('keeps Hospital Nursing on the public contract and away from direct healthcare persistence', () => {
    const hospitalService = read(hospitalServicePath);
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    expect(hospitalService).toContain("from '../../../platform/healthcare/contracts/nursing-engine.contract'");
    expect(hospitalService).not.toContain('platform/healthcare/engines/nursing-engine');
    expect(hospitalService).not.toContain('hc_nursing_vital_signs');
    expect(hospitalService).not.toContain('hc_vital_signs');
    expect(hospitalService).not.toContain('hc_nursing_notes');

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateNursingEngine = /platform\/healthcare\/engines\/nursing-engine/.test(line);
        const directNursingPersistence = /\b(?:hc_nursing_vital_signs|hc_vital_signs|hc_nursing_notes)\b/.test(line);

        if (importsPrivateNursingEngine || directNursingPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Nursing contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
