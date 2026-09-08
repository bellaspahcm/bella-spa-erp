/**
 * Bella AutoMove — Invoices Page
 *
 * Invoice generation and tracking.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Receipt, DollarSign } from 'lucide-react';
import { listInvoicesAction } from '@/products/bella-automove/actions';

export default function InvoicesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Invoices
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track and manage invoices
          </p>
        </div>
      </div>

      <Suspense fallback={<InvoiceListSkeleton />}>
        <InvoiceList />
      </Suspense>
    </div>
  );
}

async function InvoiceList() {
  const result = await listInvoicesAction();

  if (!result.success || !result.data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400">
          {result.error || 'Failed to load invoices'}
        </p>
      </div>
    );
  }

  const invoices = result.data;

  if (invoices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
        <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No invoices yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Invoices will appear here when repair orders are completed.
        </p>
        <Link
          href="/dashboard/automove/repair-orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          View Repair Orders
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
                Invoice #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Issue Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Balance
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
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                  {invoice.invoice_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {/* Customer name would come from join */}
                  —
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {new Date(invoice.issue_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {new Date(invoice.due_date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    {invoice.total_amount.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    {invoice.balance.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <InvoiceStatusBadge status={invoice.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link
                    href={`/dashboard/automove/invoices/${invoice.id}`}
                    className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
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

function InvoiceStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    draft: {
      label: 'Draft',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
    issued: {
      label: 'Issued',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    },
    paid: {
      label: 'Paid',
      className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    },
    overdue: {
      label: 'Overdue',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

  return (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function InvoiceListSkeleton() {
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
