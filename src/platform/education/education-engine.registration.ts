/**
 * Education OS — Platform Contract Registration
 * 
 * Registers Education OS contract into Common Core PlatformContractRegistry.
 * 
 * @module platform/education/education-engine.registration
 */

import { PlatformContractRegistry } from '../core/contracts';
import { EducationEngineService } from './education-engine.service';

export const EDUCATION_ENGINE_CONTRACT = 'education-engine';

export function registerEducationEngine(
  registry: PlatformContractRegistry,
  service: EducationEngineService
): void {
  registry.registerContract(EDUCATION_ENGINE_CONTRACT, service, {
    version: '1.0.0',
    type: 'engine',
    description: 'Education OS Engine managing Courses and Enrollments',
    owner: 'Education Platform Team',
    status: 'active',
  });
  console.log(`[PlatformBootstrap] Registered Education Engine contract: ${EDUCATION_ENGINE_CONTRACT}`);
}
