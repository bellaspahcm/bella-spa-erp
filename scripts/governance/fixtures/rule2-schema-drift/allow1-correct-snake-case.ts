// ALLOW: correct snake_case matching schema (no TypeScript errors)
// Expected: No TS2322 errors, clean compilation
// Expected verdict: ALLOW (exit 0)

type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  created_at: string;
};

// Correctly using snake_case properties matching schema
const patient: PatientRow = {
  id: "P001",
  first_name: "John",
  last_name: "Doe",
  date_of_birth: "1990-01-01",
  created_at: new Date().toISOString(),
};

export { patient };
