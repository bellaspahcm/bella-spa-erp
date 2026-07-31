/**
 * Real Estate Internal Public Contracts (v1)
 * Used for inter-module communication within BELLA EIP platform.
 */

export interface RealEstateProjectLookupDTO {
  id: string;
  name: string;
  code: string;
  location?: string;
  totalProducts: number;
}

export interface RealEstateProductSummaryDTO {
  id: string;
  unitCode: string;
  floor: number;
  block: string;
  status: 'available' | 'reserved' | 'sold' | 'locked';
  price: number;
  area: number;
}

export interface IRealEstatePublicService {
  getProjects(tenantId: string): Promise<RealEstateProjectLookupDTO[]>;
  getProductByCode(tenantId: string, unitCode: string): Promise<RealEstateProductSummaryDTO | null>;
}
