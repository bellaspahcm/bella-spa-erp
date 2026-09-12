import { IEducationStudentContract, RegisterStudentInput, EducationStudentDTO } from './student.contract';
import { StudentService } from '../student/student.service';

export class StudentContractImpl implements IEducationStudentContract {
  public async registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO> {
    // R3 FIX: partyId → party_id (canonical identity)
    const student = await StudentService.createStudent({
      tenantId: input.tenantId,
      partyId: input.partyId,         // FIXED: map to party_id field
      personId: input.personId || input.partyId, // LEGACY FK compatibility (R6.5: use partyId if personId not provided)
      studentCode: input.studentCode,
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'primary',
      enrollmentDate: new Date().toISOString().split('T')[0],
      createdBy: undefined, // Optional
    });

    // R3 FIX: Return party_id (NOT person_id)
    return {
      partyId: student.partyId!,      // FIXED: use party_id
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
      guardianPartyId: input.guardianPartyId,
    };
  }

  public async getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null> {
    // R3 FIX: Query by party_id (NOT person_id)
    const students = await StudentService.getStudentsByPartyId(partyId, tenantId);
    if (students.length === 0) {
      return null;
    }

    const student = students[0];
    // R3 FIX: Return party_id (NOT person_id)
    return {
      partyId: student.partyId!,      // FIXED: use party_id
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
    };
  }
}
