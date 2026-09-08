/**
 * Bella Education — Dashboard Page
 * 
 * Landing page for Education OS
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { BookOpen, Users, CalendarCheck, GraduationCap } from 'lucide-react';

export default function EducationDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Bella Education
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Education Management System
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        <QuickActionCard
          href="/dashboard/education/courses"
          icon={<BookOpen className="w-8 h-8" />}
          title="Courses"
          description="Manage course catalog"
          color="blue"
        />
        <QuickActionCard
          href="/dashboard/education/enrollments"
          icon={<Users className="w-8 h-8" />}
          title="Enrollments"
          description="Student registration"
          color="green"
        />
        <QuickActionCard
          href="/dashboard/education/attendance"
          icon={<CalendarCheck className="w-8 h-8" />}
          title="Attendance"
          description="Daily roll-call"
          color="orange"
        />
        <QuickActionCard
          href="/dashboard/education/grades"
          icon={<GraduationCap className="w-8 h-8" />}
          title="Grades"
          description="Academic performance"
          color="purple"
        />
      </div>
    </div>
  );
}

async function DashboardStats() {
  // TODO: Fetch real stats from Education OS
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard title="Total Courses" value={0} color="blue" />
      <StatCard title="Enrolled Students" value={0} color="green" />
      <StatCard title="Present Today" value={0} color="orange" />
      <StatCard title="Avg GPA" value="0.0" color="purple" />
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  color 
}: { 
  title: string; 
  value: number | string; 
  color: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {title}
      </h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  );
}

function QuickActionCard({
  href,
  icon,
  title,
  description,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    orange: 'bg-orange-500 hover:bg-orange-600',
    purple: 'bg-purple-500 hover:bg-purple-600',
  };

  return (
    <Link
      href={href}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6"
    >
      <div className={`w-16 h-16 rounded-full ${colorClasses[color]} flex items-center justify-center text-white mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32"></div>
      ))}
    </div>
  );
}
