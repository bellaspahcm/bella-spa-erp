/**
 * BELLA EDUCATION — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella Education product vertical.
 *
 * @module src/products/bella-education/manifest
 */

export interface ProductManifest {
  id: string;
  name: string;
  version: string;
  themeKey: string;
  capabilities: string[];
  workflows: string[];
  menus: Array<{ id: string; label: string; href: string; icon?: string }>;
}

export const bellaEducationManifest: ProductManifest = {
  id: 'bella-education',
  name: 'Bella Education OS V1',
  version: '1.0.0',
  themeKey: 'classic-academic-blue',
  capabilities: [
    'course_catalog_query',
    'student_enrollment_command',
    'attendance_checkpoint_command',
    'grade_reporting_command'
  ],
  workflows: [
    'student_academic_lifecycle'
  ],
  menus: [
    { id: 'courses', label: 'Chương Trình Học', href: '/dashboard/education/courses', icon: 'BookOpen' },
    { id: 'enrollment', label: 'Đăng Ký Nhập Học', href: '/dashboard/education/enrollments', icon: 'UserPlus' },
    { id: 'attendance', label: 'Điểm Danh Roll-Call', href: '/dashboard/education/attendance', icon: 'CalendarCheck' },
    { id: 'grades', label: 'Bảng Điểm GPA', href: '/dashboard/education/grades', icon: 'GraduationCap' }
  ]
};
