/**
 * ALLOW3: Optional field correctly omitted
 * 
 * Expected: Rule 2 ALLOW
 * Reason: StaffInsert with optional field omitted is valid schema usage
 */

type StaffInsert = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string; // Optional
  role: 'therapist' | 'receptionist' | 'manager';
};

// ✓ Valid: phone is optional, can be omitted
const staff: StaffInsert = {
  first_name: "Jane",
  last_name: "Smith",
  email: "jane@spa.com",
  role: "therapist",
  // phone omitted - valid because it's optional
};

export {};
