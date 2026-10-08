/**
 * Healthcare Service Locator - Imaging Wiring
 *
 * Static wiring proof for the minimal Imaging runtime adapter.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const serviceLocatorPath = path.join(repoRoot, 'src/platform/healthcare/service-locator.ts');
const imagingIndexPath = path.join(repoRoot, 'src/platform/healthcare/engines/imaging-engine/index.ts');
const imagingServicePath = path.join(repoRoot, 'src/platform/healthcare/engines/imaging-engine/imaging-engine.service.ts');
const imagingRepositoryPath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/imaging-engine/repositories/supabase-imaging.repository.ts'
);

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Healthcare Service Locator Imaging Wiring', () => {
  it('wires imaging-engine to the public Imaging contract implementation', () => {
    const serviceLocator = read(serviceLocatorPath);
    const imagingIndex = read(imagingIndexPath);
    const imagingService = read(imagingServicePath);
    const imagingRepository = read(imagingRepositoryPath);

    expect(serviceLocator).toContain("import type { IImagingEngine } from './contracts/imaging-engine.contract'");
    expect(serviceLocator).toContain("'imaging-engine': IImagingEngine");
    expect(serviceLocator).toContain("case 'imaging-engine'");
    expect(serviceLocator).toContain("require('./engines/imaging-engine')");
    expect(serviceLocator).toContain('new SupabaseImagingRepository(supabase)');
    expect(serviceLocator).toContain('new ImagingEngineService(repository)');

    expect(imagingIndex).toContain("export { ImagingEngineService } from './imaging-engine.service'");
    expect(imagingIndex).toContain('SupabaseImagingRepository');

    expect(imagingService).toContain('implements IImagingEngine');
    expect(imagingService).toContain('bootstrapImagingOrder(');
    expect(imagingService).toContain('recordImagingResult(');

    expect(imagingRepository).toContain("private readonly TABLE = 'hc_imaging_orders'");
    expect(imagingRepository).toContain(".from('hc_clinical_orders')");
  });
});
