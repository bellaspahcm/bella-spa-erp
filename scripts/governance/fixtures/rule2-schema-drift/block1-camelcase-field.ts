// BLOCK: Schema drift - excess property at Insert boundary
// Expected: TypeScript TS2561 at schema boundary
// Expected verdict: BLOCK (exit 2)

type TreatmentInsert = {
  tooth_number: number;
  tube_color: string;  // Schema expects snake_case
  treatment_date: string;
};

// Excess property at Insert boundary - violates schema contract
const treatment: TreatmentInsert = {
  tooth_number: 12,
  tubeColor: "blue",  // ❌ TS2561: 'tubeColor' does not exist, should be 'tube_color'
  treatment_date: "2024-01-01",
};

export { treatment };
