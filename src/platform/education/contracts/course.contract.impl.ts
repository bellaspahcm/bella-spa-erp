import { IEducationCourseContract, CreateCourseInput, EducationCourseDTO } from './course.contract';
import { CourseService } from '../course/course.service';
import { CourseStatus } from '../shared-kernel/course-types';

/**
 * Map domain CourseStatus to contract status
 * Contract exposes simplified 3-state model: draft | active | archived
 */
function mapCourseStatus(domainStatus: CourseStatus): 'draft' | 'active' | 'archived' {
  switch (domainStatus) {
    case 'draft':
      return 'draft';
    case 'active':
    case 'full':
    case 'in_progress':
      return 'active';
    case 'completed':
    case 'cancelled':
    case 'archived':
      return 'archived';
  }
}

export class CourseContractImpl implements IEducationCourseContract {
  public async createCourse(input: CreateCourseInput): Promise<EducationCourseDTO> {
    const result = await CourseService.createCourse({
      tenantId: input.tenantId,
      courseCode: input.courseCode,
      courseName: input.title,
      credits: 3, // default credits for course creation
      createdBy: '00000000-0000-0000-0000-000000000001',
    });

    if (!result.success || !result.course) {
      throw new Error(result.error || 'Failed to create course');
    }

    return {
      id: result.course.courseId,
      tenantId: result.course.tenantId,
      courseCode: result.course.courseCode,
      title: result.course.courseName,
      status: mapCourseStatus(result.course.status),
      prerequisites: result.course.prerequisiteCourseIds || [],
    };
  }

  public async getCourse(tenantId: string, courseId: string): Promise<EducationCourseDTO | null> {
    const result = await CourseService.getCourseById(courseId, tenantId);
    if (!result.success || !result.course) {
      return null;
    }

    return {
      id: result.course.courseId,
      tenantId: result.course.tenantId,
      courseCode: result.course.courseCode,
      title: result.course.courseName,
      status: mapCourseStatus(result.course.status),
      prerequisites: result.course.prerequisiteCourseIds || [],
    };
  }

  public async listCourses(tenantId: string): Promise<readonly EducationCourseDTO[]> {
    const result = await CourseService.queryCourses({ tenantId });
    if (!result.success) {
      return [];
    }

    return result.courses.map(course => ({
      id: course.courseId,
      tenantId: course.tenantId,
      courseCode: course.courseCode,
      title: course.courseName,
      status: mapCourseStatus(course.status),
      prerequisites: course.prerequisiteCourseIds || [],
    }));
  }
}
