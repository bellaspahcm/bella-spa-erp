/**
 * Bella AutoMove — Dashboard
 *
 * Main dashboard for automotive service & repair management.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Car, Calendar, Wrench, Receipt } from 'lucide-react';

export default function AutoMoveDashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Bella AutoMove
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Automotive Service & Repair Management
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Suspense fallback={<StatCardSkeleton />}>
          <StatsCards />
        </Suspense>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickActionCard
          title="Vehicles"
          description="Manage vehicle inventory"
          icon={<Car className="w-8 h-8" />}
          href="/dashboard/automove/vehicles"
          color="blue"
        />
        <QuickActionCard
          title="Appointments"
          description="Schedule service appointments"
          icon={<Calendar className="w-8 h-8" />}
          href="/dashboard/automove/appointments"
          color="green"
        />
        <QuickActionCard
          title="Repair Orders"
          description="Manage repair work orders"
          icon={<Wrench className="w-8 h-8" />}
          href="/dashboard/automove/repair-orders"
          color="orange"
        />
        <QuickActionCard
          title="Invoices"
          description="Generate and track invoices"
          icon={<Receipt className="w-8 h-8" />}
          href="/dashboard/automove/invoices"
          color="purple"
        />
      </div>
    </div>
  );
}

async function StatsCards() {
  // TODO: Fetch actual stats from actions
  const stats = {
    activeAppointments: 0,
    inProgressOrders: 0,
    completedToday: 0,
    pendingInvoices: 0,
  };

  return (
    <>
      <StatCard
        title="Active Appointments"
        value={stats.activeAppointments}
        color="blue"
      />
      <StatCard
        title="In Progress Orders"
        value={stats.inProgressOrders}
        color="orange"
      />
      <StatCard
        title="Completed Today"
        value={stats.completedToday}
        color="green"
      />
      <StatCard
        title="Pending Invoices"
        value={stats.pendingInvoices}
        color="purple"
      />
    </>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    orange:
      'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    purple:
      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {title}
      </h3>
      <p
        className={`text-3xl font-bold ${colorClasses[color as keyof typeof colorClasses]}`}
      >
        {value}
      </p>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
    green:
      'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
    orange:
      'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
    purple:
      'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
  };

  return (
    <Link href={href}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors ${
          colorClasses[color as keyof typeof colorClasses]
        }`}
      >
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </Link>
  );
}
