import { IEducationStudentContract, RegisterStudentInput, EducationStudentDTO } from './student.contract';
import { StudentService } from '../student/student.service';

export class StudentContractImpl implements IEducationStudentContract {
  public async registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO> {
    const student = await StudentService.createStudent({
      tenantId: input.tenantId,
      personId: input.partyId, // references generic Party profile identity
      studentCode: input.studentCode,
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'primary',
      enrollmentDate: new Date().toISOString().split('T')[0],
      createdBy: '00000000-0000-0000-0000-000000000001',
    });

    return {
      partyId: student.personId,
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
      guardianPartyId: input.guardianPartyId,
    };
  }

  public async getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null> {
    const students = await StudentService.getStudentsByPersonId(partyId, tenantId);
    if (students.length === 0) {
      return null;
    }

    const student = students[0];
    return {
      partyId: student.personId,
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
    };
  }
}
