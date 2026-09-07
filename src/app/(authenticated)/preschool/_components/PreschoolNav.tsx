'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/preschool', label: 'Dashboard', exact: true },
  { href: '/preschool/students', label: 'Students' },
  { href: '/preschool/classrooms', label: 'Classrooms' },
  { href: '/preschool/attendance', label: 'Attendance' },
];

export function PreschoolNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16 space-x-8">
          <div className="font-semibold text-lg text-gray-900">
            Bella Preschool
          </div>
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const isActive = item.exact 
                ? pathname === item.href
                : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
