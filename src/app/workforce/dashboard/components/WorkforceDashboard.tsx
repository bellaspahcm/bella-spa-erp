'use client';

import { CurrentUser } from '@/types/domain';
import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Calendar, DollarSign, Users, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { WorkforceBottomNav } from '../../components/WorkforceBottomNav';

interface DashboardStats {
  newLeads: number;
  todayTasks: number;
  upcomingAppointments: number;
  pendingCommission: number;
}

interface WorkforceDashboardProps {
  user: CurrentUser;
}

/**
 * Workforce Dashboard - Main UI
 * 
 * Sections:
 * 1. Header with user info and online status
 * 2. AI Daily Brief card (personalized insights)
 * 3. Quick Stats grid (4 cards)
 * 4. Shortcut tiles to main modules
 * 5. Bottom navigation
 * 
 * Design: Blue theme (#1E40AF) for Real Estate
 */
export function WorkforceDashboard({ user }: WorkforceDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    newLeads: 0,
    todayTasks: 0,
    upcomingAppointments: 0,
    pendingCommission: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dailyBrief, setDailyBrief] = useState<string>('');

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        // TODO: Call getWorkforceDashboardData() server action
        // For now, use mock data
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setStats({
          newLeads: 3,
          todayTasks: 5,
          upcomingAppointments: 2,
          pendingCommission: 15500000,
        });

        // Generate AI Daily Brief
        const brief = generateDailyBrief(user.full_name || 'Bạn', {
          newLeads: 3,
          todayTasks: 5,
          upcomingAppointments: 2,
        });
        setDailyBrief(brief);
      } catch (error) {
        console.error('[WorkforceDashboard] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboardData();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-900 dark:to-indigo-900 px-6 pt-8 pb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Chào {user.full_name || 'Bạn'}!
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {getRoleDisplayName(user.role)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-blue-100">Online</span>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-6 pb-8">
        {/* AI Daily Brief Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-800 dark:to-indigo-800 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <h2 className="font-bold text-lg">AI Daily Brief</h2>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-white/20 rounded animate-pulse" />
              <div className="h-4 bg-white/20 rounded animate-pulse w-3/4" />
            </div>
          ) : (
            <p className="text-blue-50 leading-relaxed text-sm">
              {dailyBrief}
            </p>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={Users}
            label="Lead mới"
            value={isLoading ? '...' : stats.newLeads.toString()}
            color="blue"
            href="/workforce/leads"
          />
          <StatCard
            icon={CheckCircle}
            label="Việc hôm nay"
            value={isLoading ? '...' : stats.todayTasks.toString()}
            color="green"
            href="/workforce/tasks"
          />
          <StatCard
            icon={Calendar}
            label="Lịch hẹn"
            value={isLoading ? '...' : stats.upcomingAppointments.toString()}
            color="purple"
            href="/workforce/calendar"
          />
          <StatCard
            icon={DollarSign}
            label="Hoa hồng tạm"
            value={isLoading ? '...' : formatCurrency(stats.pendingCommission)}
            color="emerald"
            href="/workforce/commission"
          />
        </div>

        {/* Module Shortcuts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">
            Truy cập nhanh
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <ShortcutTile
              href="/workforce/leads"
              icon="👥"
              label="Quản lý Lead"
            />
            <ShortcutTile
              href="/workforce/customers"
              label="Khách hàng"
              icon="🏘️"
            />
            <ShortcutTile
              href="/workforce/calendar"
              icon="📅"
              label="Lịch làm việc"
            />
            <ShortcutTile
              href="/workforce/attendance"
              icon="📍"
              label="Chấm công"
            />
            <ShortcutTile
              href="/workforce/inventory"
              icon="🏢"
              label="Bảng hàng"
            />
            <ShortcutTile
              href="/workforce/kpi"
              icon="📊"
              label="KPI của tôi"
            />
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <WorkforceBottomNav />
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'purple' | 'emerald';
  href: string;
}

function StatCard({ icon: Icon, label, value, color, href }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
    green: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700',
    purple: 'from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700',
    emerald: 'from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700',
  };

  return (
    <Link
      href={href}
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 text-white shadow-lg active:scale-95 transition-transform`}
    >
      <Icon className="w-6 h-6 mb-2 opacity-90" />
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs opacity-90">{label}</div>
    </Link>
  );
}

interface ShortcutTileProps {
  href: string;
  icon: string;
  label: string;
}

function ShortcutTile({ href, icon, label }: ShortcutTileProps) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 active:scale-95 transition-all"
    >
      <div className="text-3xl">{icon}</div>
      <span className="text-xs text-gray-700 dark:text-gray-300 text-center font-medium">
        {label}
      </span>
    </Link>
  );
}

function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    sale: 'Nhân viên Kinh doanh',
    team_lead: 'Trưởng nhóm',
    branch_manager: 'Quản lý Chi nhánh',
    admin: 'Quản trị viên',
  };
  return roleMap[role] || role;
}

function generateDailyBrief(name: string, stats: { newLeads: number; todayTasks: number; upcomingAppointments: number }): string {
  const greetings = [
    `Chào buổi sáng, ${name}!`,
    `Chúc ${name} một ngày làm việc hiệu quả!`,
    `Xin chào ${name}, sẵn sàng chinh phục mục tiêu hôm nay!`,
  ];
  
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  const briefParts = [greeting];
  
  if (stats.newLeads > 0) {
    briefParts.push(`Bạn có ${stats.newLeads} lead mới cần chăm sóc.`);
  }
  
  if (stats.todayTasks > 0) {
    briefParts.push(`Hôm nay bạn có ${stats.todayTasks} công việc đang chờ xử lý.`);
  }
  
  if (stats.upcomingAppointments > 0) {
    briefParts.push(`Đừng quên ${stats.upcomingAppointments} cuộc hẹn sắp tới!`);
  }
  
  if (stats.newLeads === 0 && stats.todayTasks === 0 && stats.upcomingAppointments === 0) {
    briefParts.push('Hôm nay bạn không có việc gì cấp bách. Hãy dành thời gian cập nhật hồ sơ khách hàng và học hỏi về sản phẩm mới!');
  }
  
  return briefParts.join(' ');
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toString();
}
