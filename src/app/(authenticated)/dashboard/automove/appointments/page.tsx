/**
 * Bella AutoMove — Appointments Page
 *
 * Service appointment scheduling and management.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Clock } from 'lucide-react';
import { listAppointmentsAction } from '@/products/bella-automove/actions';
import { format } from 'date-fns';

export default function AppointmentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Appointments
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Service appointment scheduling
          </p>
        </div>
        <Link
          href="/dashboard/automove/appointments/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Appointment
        </Link>
      </div>

      <Suspense fallback={<AppointmentListSkeleton />}>
        <AppointmentList />
      </Suspense>
    </div>
  );
}

async function AppointmentList() {
  const result = await listAppointmentsAction();

  if (!result.success || !result.data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">
          {result.error || 'Failed to load appointments'}
        </p>
      </div>
    );
  }

  const appointments = result.data;

  if (appointments.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No appointments scheduled
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Schedule your first service appointment.
        </p>
        <Link
          href="/dashboard/automove/appointments/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Schedule First Appointment
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Appointment #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Service Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {appointments.map((appointment) => (
              <tr
                key={appointment.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                  {appointment.appointment_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {format(new Date(appointment.appointment_date), 'MMM dd, yyyy HH:mm')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {appointment.vehicle?.vin || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {appointment.customer_id || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {appointment.service_type || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AppointmentStatusBadge status={appointment.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link
                    href={`/dashboard/automove/appointments/${appointment.id}`}
                    className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    },
    confirmed: {
      label: 'Confirmed',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    },
    checked_in: {
      label: 'Checked In',
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    },
    in_service: {
      label: 'In Service',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function AppointmentListSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
