/**
 * BELLA EDUCATION — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella Education product vertical.
 *
 * @module src/products/bella-education/manifest
 */

import type { VerticalManifest } from '@/platform/registry/vertical-registry';

export const bellaEducationManifest: VerticalManifest = {
  key: 'bella_education',
  name: 'Bella Education OS V1',
  version: '1.0.0',
  themeKey: 'classic-academic-blue',
  defaultRoute: '/dashboard/education',
  enabledCapabilities: [
    'course_catalog_query',
    'student_enrollment_command',
    'attendance_checkpoint_command',
    'grade_reporting_command'
  ],
  menus: [
    { id: 'courses', label: 'Chương Trình Học', href: '/dashboard/education/courses', icon: 'BookOpen' },
    { id: 'enrollment', label: 'Đăng Ký Nhập Học', href: '/dashboard/education/enrollments', icon: 'UserPlus' },
    { id: 'attendance', label: 'Điểm Danh Roll-Call', href: '/dashboard/education/attendance', icon: 'CalendarCheck' },
    { id: 'grades', label: 'Bảng Điểm GPA', href: '/dashboard/education/grades', icon: 'GraduationCap' }
  ]
};
