/**
 * BLOCK3: Type incompatibility (TS2322)
 * 
 * Expected: Rule 2 BLOCK
 * Reason: ServiceRow field type mismatch at schema boundary
 */

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};

// ❌ TS2322: Type 'string' is not assignable to type 'number'
const service: ServiceRow = {
  id: "SVC001",
  name: "Massage Therapy",
  duration_minutes: "60", // Wrong type: string instead of number
  price: 100,
  is_active: true,
};

export {};
