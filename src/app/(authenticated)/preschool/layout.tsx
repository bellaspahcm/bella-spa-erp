import { ReactNode } from 'react';
import { PreschoolNav } from './_components/PreschoolNav';

export default function PreschoolLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PreschoolNav />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
