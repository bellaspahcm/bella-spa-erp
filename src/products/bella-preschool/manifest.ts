/**
 * BELLA PRESCHOOL — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella Preschool product (preschool/kindergarten management).
 *
 * @module src/products/bella-preschool/manifest
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

export const bellaPreschoolManifest: ProductManifest = {
  id: 'bella-preschool',
  name: 'Bella Preschool',
  version: '1.0.0',
  themeKey: 'cheerful-kids-primary',
  capabilities: [
    'student_management',
    'guardian_management',
    'classroom_management',
    'enrollment_management',
    'attendance_tracking',
    'daily_care_records',
    'health_records'
  ],
  workflows: [
    'student_enrollment_lifecycle',
    'daily_attendance_checkin_checkout'
  ],
  menus: [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard/preschool', icon: 'Home' },
    { id: 'students', label: 'Students', href: '/dashboard/preschool/students', icon: 'Users' },
    { id: 'classrooms', label: 'Classrooms', href: '/dashboard/preschool/classrooms', icon: 'School' },
    { id: 'attendance', label: 'Attendance', href: '/dashboard/preschool/attendance', icon: 'CalendarCheck' }
  ]
};
