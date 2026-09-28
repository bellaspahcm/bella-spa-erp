import { IEducationStudentContract, RegisterStudentInput, EducationStudentDTO } from './student.contract';
import { StudentService } from '../student/student.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type EducationStudentClient = SupabaseClient<Database>;

export class StudentContractImpl implements IEducationStudentContract {
  constructor(private readonly supabase?: EducationStudentClient) {}

  public async registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO> {
    const student = await StudentService.createStudent({
      tenantId: input.tenantId,
      partyId: input.partyId,
      studentCode: input.studentCode,
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'primary',
      enrollmentDate: new Date().toISOString().split('T')[0],
      createdBy: '00000000-0000-0000-0000-000000000001',
    }, this.supabase);

    return {
      partyId: student.partyId ?? input.partyId,
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
      guardianPartyId: input.guardianPartyId,
    };
  }

  public async getStudent(tenantId: string, partyId: string): Promise<EducationStudentDTO | null> {
    const students = await StudentService.getStudentsByPartyId(partyId, tenantId, this.supabase);
    if (students.length === 0) {
      return null;
    }

    const student = students[0];
    return {
      partyId: student.partyId ?? partyId,
      tenantId: student.tenantId,
      studentCode: student.studentCode,
      academicStatus: student.academicStatus === 'enrolled' ? 'active' : 'suspended',
    };
  }
}
