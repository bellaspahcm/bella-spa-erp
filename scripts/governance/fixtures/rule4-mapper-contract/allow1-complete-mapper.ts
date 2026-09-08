/**
 * ALLOW1: Complete mapper
 * 
 * Expected: Rule 4 ALLOW
 * Reason: Mapper provides all required properties for ServiceInsert
 */

type ServiceInsert = {
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

function mapToServiceInsert(raw: {
  serviceName: string;
  duration: number;
  cost: number;
}): ServiceInsert {
  // ✓ All required properties provided
  return {
    name: raw.serviceName,
    duration_minutes: raw.duration,
    price: raw.cost,
    is_active: true, // Explicit default
  };
}

export {};
