import { redirect } from 'next/navigation';

// Dashboard redirects to students for now (will build proper dashboard in P3.7)
export default function PreschoolDashboardPage() {
  redirect('/preschool/students');
}
