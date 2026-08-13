/**
 * Education OS — Course public contract interface
 */
export interface EducationCourseDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly courseCode: string;
  readonly title: string;
  readonly status: 'draft' | 'active' | 'archived';
  readonly prerequisites: string[]; // array of courseCodes required
}

export interface CreateCourseInput {
  readonly tenantId: string;
  readonly courseCode: string;
  readonly title: string;
  readonly prerequisites?: string[];
}

export interface IEducationCourseContract {
  createCourse(input: CreateCourseInput): Promise<EducationCourseDTO>;
  getCourse(tenantId: string, courseId: string): Promise<EducationCourseDTO | null>;
  listCourses(tenantId: string): Promise<readonly EducationCourseDTO[]>;
}
