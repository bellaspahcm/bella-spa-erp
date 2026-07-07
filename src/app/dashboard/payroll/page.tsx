import { redirect } from 'next/navigation';

/**
 * Payroll index page redirects to salary dashboard
 * since payroll and salary are managed in the same interface
 */
export default function PayrollPage() {
  redirect('/dashboard/salary');
}
