import { redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase-server';
import { Brain, Scale } from 'lucide-react';

const ALLOWED_ROLES = ['admin', 'super_admin', 'accountant'] as const;

const NAV_TABS = [
  { label: 'AI COO Chat',       href: '/dashboard/ai-copilot',                       icon: Brain  },
  { label: 'Đối soát Lương',    href: '/dashboard/ai-copilot/salary-reconciliation', icon: Scale  },
] as const;

/**
 * Server-side role guard + sub-nav cho toàn bộ /dashboard/ai-copilot.
 * KTV, receptionist và các role khác bị redirect về dashboard chính.
 */
export default async function AICopilotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.tenant_id || !ALLOWED_ROLES.includes(userData.role as typeof ALLOWED_ROLES[number])) {
    redirect('/dashboard');
  }

  // Lấy pathname để highlight tab active
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
      {/* Sub-nav */}
      <nav className="shrink-0 px-6 pt-4 border-b border-border bg-card/40 backdrop-blur-md flex items-center gap-1">
        {NAV_TABS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard/ai-copilot' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2.5 mb-[-1px] border-b-2 text-xs font-black uppercase tracking-widest transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
