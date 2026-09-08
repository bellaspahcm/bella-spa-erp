/**
 * BELLA EDUCATION — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella Education product vertical.
 *
 * @module src/products/bella-education/manifest
 */

import type { VerticalManifest } from '@/platform/registry/vertical-registry';

export const bellaEducationManifest: VerticalManifest & { 
  id: string; 
  capabilities: string[];
  workflows?: string[];
} = {
  id: 'bella-education',
  key: 'bella_education',
  name: 'Bella Education OS V1',
  version: '1.0.0',
  themeKey: 'classic-academic-blue',
  defaultRoute: '/dashboard/education',
  capabilities: [
    'course_catalog_query',
    'student_enrollment_command',
    'attendance_checkpoint_command',
    'grade_reporting_command'
  ],
  enabledCapabilities: [
    'course_catalog_query',
    'student_enrollment_command',
    'attendance_checkpoint_command',
    'grade_reporting_command'
  ],
  workflows: [
    'student_academic_lifecycle'
  ],
  menus: [
    { id: 'dashboard', label: 'Tổng Quan Dashboard', href: '/dashboard/education', icon: 'LayoutDashboard' },
    { id: 'courses', label: 'Chương Trình & Lớp Học', href: '/dashboard/education/courses', icon: 'BookOpen' },
    { id: 'enrollment', label: 'Bé Nhập Học & Hồ Sơ', href: '/dashboard/education/enrollments', icon: 'UserPlus' },
    { id: 'attendance', label: 'Điểm Danh & Đưa Đón', href: '/dashboard/education/attendance', icon: 'CalendarCheck' },
    { id: 'grades', label: 'Đánh Giá & Phát Triển', href: '/dashboard/education/grades', icon: 'GraduationCap' }
  ]
};
