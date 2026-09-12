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
  
  /**
   * @deprecated Legacy Person FK compatibility. Production code should NOT provide this.
   * Required only during R3-R4 migration (backfill). After R4 complete (2026-09-12),
   * this parameter is ignored. Removal planned: R6+.
   * See: E0.1A-R Identity Remediation (R5.3 compatibility bridge deprecation)
   */
  readonly personId?: string;
  
  readonly studentCode: string;
  readonly guardianPartyId?: string;
}

export interface IEducationStudentContract {
  registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO>;
  getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null>;
}
