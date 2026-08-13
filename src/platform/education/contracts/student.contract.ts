/**
 * Education OS — Student public contract interface
 */
export interface EducationStudentDTO {
  readonly partyId: string;
  readonly tenantId: string;
  readonly studentCode: string;
  readonly academicStatus: 'active' | 'probation' | 'suspended' | 'graduated';
  readonly guardianPartyId?: string;
}

export interface RegisterStudentInput {
  readonly tenantId: string;
  readonly partyId: string; // references generic Party profile identity
  readonly studentCode: string;
  readonly guardianPartyId?: string;
}

export interface IEducationStudentContract {
  registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO>;
  getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null>;
}
