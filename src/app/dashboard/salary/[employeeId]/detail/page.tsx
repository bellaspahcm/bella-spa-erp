import { EmployeeDetailScreen } from '@/components/payroll/EmployeeDetailScreen';

export default async function SalaryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { employeeId } = await params;
  const { month } = await searchParams;

  return <EmployeeDetailScreen employeeId={employeeId} month={month} />;
}
