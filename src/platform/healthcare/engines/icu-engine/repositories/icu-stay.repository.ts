/**
 * ICU Stay Repository Interface
 * 
 * Constitution Compliance:
 * - Law 2: Repository abstraction layer
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/repositories
 */

import { IcuStay } from '../domain/icu-stay.entity';

export interface IIcuStayRepository {
  save(icuStay: IcuStay): Promise<IcuStay>;
  findById(tenantId: string, icuStayId: string): Promise<IcuStay | null>;
  findByEncounterId(tenantId: string, encounterId: string): Promise<IcuStay | null>;
  allocateConditional(icuStay: IcuStay): Promise<IcuStay>;
}
