/**
 * Preschool Test Data Helpers
 * 
 * Provides isolated test data provisioning for P3.1 + P3.2 E2E tests
 * Each helper creates independent data that can be cleaned up
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface TestStudent {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  tenant_id: string;
}

export interface TestCustomer {
  id: string;
  name_mother: string;
  phone: string;
  tenant_id: string;
}

export interface TestGuardianLink {
  id: string;
  student_id: string;
  guardian_customer_id: string;
  relationship_type: string;
  is_primary_contact: boolean;
}

export interface TestClassroom {
  id: string;
  classroom_name: string;
  classroom_code: string | null;
  age_group: string | null;
  capacity: number | null;
  tenant_id: string;
}

export interface TestEnrollment {
  id: string;
  student_id: string;
  classroom_id: string;
  enrollment_date: string;
  tenant_id: string;
}

/**
 * Create a test student with unique data
 */
export async function createTestStudent(
  supabase: SupabaseClient,
  tenantId: string,
  overrides?: Partial<TestStudent>
): Promise<TestStudent> {
  const timestamp = Date.now();
  const studentData = {
    tenant_id: tenantId,
    student_code: `TEST${timestamp}`,
    first_name: overrides?.first_name || 'TestStudent',
    last_name: overrides?.last_name || `Last${timestamp}`,
    date_of_birth: overrides?.date_of_birth || '2021-05-15',
    gender: null,
    enrollment_date: new Date().toISOString().split('T')[0],
    status: 'active',
    ...overrides,
  };

  const { data: student, error } = await supabase
    .from('preschool_students')
    .insert(studentData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test student: ${error.message}`);
  }

  return student as TestStudent;
}

/**
 * Create a test customer (guardian)
 */
export async function createTestCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  overrides?: Partial<TestCustomer>
): Promise<TestCustomer> {
  const timestamp = Date.now();
  const customerData = {
    tenant_id: tenantId,
    name_mother: overrides?.name_mother || `TestGuardian${timestamp}`,
    phone: overrides?.phone || `+1555${timestamp.toString().slice(-7)}`,
    ...overrides,
  };

  const { data: customer, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test customer: ${error.message}`);
  }

  return customer as TestCustomer;
}

/**
 * Create a test classroom
 */
export async function createTestClassroom(
  supabase: SupabaseClient,
  tenantId: string,
  overrides?: Partial<TestClassroom>
): Promise<TestClassroom> {
  const timestamp = Date.now();
  const classroomData = {
    tenant_id: tenantId,
    classroom_name: overrides?.classroom_name || `TestClassroom${timestamp}`,
    classroom_code: overrides?.classroom_code || null,
    age_group: overrides?.age_group || null,
    capacity: overrides?.capacity || null,
    room_location: (overrides as any)?.room_location || null,
    is_active: true,
  };

  const { data: classroom, error } = await supabase
    .from('preschool_classrooms')
    .insert(classroomData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test classroom: ${error.message}`);
  }

  return classroom as TestClassroom;
}

/**
 * Enroll a student in a classroom
 */
export async function enrollTestStudent(
  supabase: SupabaseClient,
  tenantId: string,
  data: {
    student_id: string;
    classroom_id: string;
    enrollment_date?: string;
  }
): Promise<TestEnrollment> {
  const enrollmentData = {
    tenant_id: tenantId,
    student_id: data.student_id,
    classroom_id: data.classroom_id,
    enrollment_date: data.enrollment_date || new Date().toISOString().split('T')[0],
    status: 'active',
  };

  const { data: enrollment, error } = await supabase
    .from('preschool_enrollments')
    .insert(enrollmentData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to enroll student: ${error.message}`);
  }

  return enrollment as TestEnrollment;
}

/**
 * Link a guardian to a student
 */
export async function linkGuardianToStudent(
  supabase: SupabaseClient,
  studentId: string,
  customerId: string,
  tenantId: string,
  options?: {
    relationship_type?: 'parent' | 'grandparent' | 'guardian' | 'other';
    is_primary_contact?: boolean;
    is_authorized_pickup?: boolean;
    is_emergency_contact?: boolean;
  }
): Promise<TestGuardianLink> {
  const linkData = {
    tenant_id: tenantId,
    student_id: studentId,
    guardian_customer_id: customerId,
    relationship_type: options?.relationship_type || 'parent',
    is_primary_contact: options?.is_primary_contact ?? false,
    is_authorized_pickup: options?.is_authorized_pickup ?? true,
    is_emergency_contact: options?.is_emergency_contact ?? false,
  };

  const { data: link, error } = await supabase
    .from('preschool_student_guardians')
    .insert(linkData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to link guardian: ${error.message}`);
  }

  return link as TestGuardianLink;
}

/**
 * Delete test student (cleanup)
 */
export async function deleteTestStudent(studentId: string): Promise<void> {
  await supabaseAdmin.from('preschool_students').delete().eq('id', studentId);
}

/**
 * Delete test customer (cleanup)
 */
export async function deleteTestCustomer(customerId: string): Promise<void> {
  await supabaseAdmin.from('customers').delete().eq('id', customerId);
}

/**
 * Delete guardian link (cleanup)
 */
export async function deleteGuardianLink(linkId: string): Promise<void> {
  await supabaseAdmin.from('preschool_student_guardians').delete().eq('id', linkId);
}

/**
 * Get or create a fallback customer for tenant (used when test needs existing customer)
 */
export async function getOrCreateFallbackCustomer(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TestCustomer> {
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (existing) {
    return existing as TestCustomer;
  }

  return createTestCustomer(supabase, tenantId, { name_mother: 'Fallback Test Guardian' });
}
