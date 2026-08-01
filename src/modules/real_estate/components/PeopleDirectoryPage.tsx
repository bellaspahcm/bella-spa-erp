'use client';
/**
 * @component PeopleDirectoryPage
 *
 * Trang Danh Mục Nhân Sự — Real Estate
 *
 * Hiển thị toàn bộ nhân sự của tenant với bộ lọc theo:
 * - Loại nhân sự (employee, broker, agency, partner...)
 * - Chi nhánh
 * - Tìm kiếm tên
 *
 * Data source: Foundation Layer (people_directory) via Server Actions.
 * Sử dụng getAllInScopeAction() không filter availability — hiển thị toàn bộ.
 *
 * @layer Module UI (Layer 3)
 */

import { useCallback, useContext, useEffect, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  User,
  Briefcase,
  Building2,
  RefreshCw,
  ChevronRight,
  MoreVertical,
  Phone,
  Mail,
  Star,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { getAllInScopeAction } from '@/modules/real_estate/actions/leadAssignmentActions';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import type { AssignableReference, AssignableType } from '@/foundation';

// ─── Augmented Person (Foundation + demo stats) ──────────────────────────────

interface PersonCard extends AssignableReference {
  email?: string;
  phone?: string;
  branch?: string;
  leadsActive?: number;
  leadsConverted?: number;
  slaBreachCount?: number;
  status?: 'active' | 'on_leave' | 'inactive';
  joinedDate?: string;
}

// ─── Filter types ─────────────────────────────────────────────────────────────

type TypeFilter = AssignableType | 'all';
type StatusFilter = 'all' | 'active' | 'on_leave' | 'inactive';

// ─── Mock augmentation (pha 2 sẽ join với HR module) ─────────────────────────

function augmentPerson(ref: AssignableReference, idx: number): PersonCard {
  const branches = ['Chi nhánh HCM', 'Chi nhánh Bình Dương', 'Chi nhánh Đà Nẵng'];
  const statuses: PersonCard['status'][] = ['active', 'active', 'active', 'on_leave', 'active'];

  return {
    ...ref,
    branch: branches[idx % branches.length],
    leadsActive: [3, 7, 5, 2, 4, 6, 1][idx % 7],
    leadsConverted: [12, 24, 8, 31, 5, 18, 9][idx % 7],
    slaBreachCount: [0, 1, 0, 2, 0, 0, 1][idx % 7],
    status: statuses[idx % statuses.length],
    joinedDate: `202${4 + (idx % 2)}-0${(idx % 9) + 1}-01`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  employee: 'Nhân viên',
  broker: 'Môi giới',
  agency: 'Đại lý',
  partner: 'Đối tác',
  consultant: 'Tư vấn',
  contractor: 'Cộng tác viên',
};

const TYPE_COLOR: Record<string, string> = {
  employee:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  broker:     'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  agency:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partner:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  consultant: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  contractor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  active:   { label: 'Đang làm', icon: <CheckCircle2 className="w-3.5 h-3.5" />, className: 'text-emerald-600 dark:text-emerald-400' },
  on_leave: { label: 'Nghỉ phép', icon: <Clock className="w-3.5 h-3.5" />,         className: 'text-amber-600 dark:text-amber-400' },
  inactive: { label: 'Không hoạt động', icon: <XCircle className="w-3.5 h-3.5" />, className: 'text-slate-400' },
};

function getInitials(name: string): string {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
}

// Hue hash for avatar gradient
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

// ─── PersonCard Component ─────────────────────────────────────────────────────

function PersonCardView({ person }: { person: PersonCard }) {
  const hue = nameToHue(person.displayName);
  const status = person.status ?? 'active';
  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className="group relative flex flex-col gap-3 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
      {/* Top row: avatar + name + type */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ background: `linear-gradient(135deg, hsl(${hue},65%,55%), hsl(${(hue+30)%360},70%,45%))` }}
        >
          {getInitials(person.displayName)}
        </div>

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{person.displayName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[person.type] ?? TYPE_COLOR.contractor}`}>
              {TYPE_LABEL[person.type] ?? person.type}
            </span>
            <span className={`text-xs flex items-center gap-1 ${statusConfig.className}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* More button */}
        <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Branch */}
      {person.branch && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{person.branch}</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{person.leadsActive ?? 0}</span>
          <span className="text-xs text-slate-400">Lead đang có</span>
        </div>
        <div className="flex flex-col items-center border-x border-slate-100 dark:border-slate-800">
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{person.leadsConverted ?? 0}</span>
          <span className="text-xs text-slate-400">Đã chốt</span>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-sm font-bold ${(person.slaBreachCount ?? 0) > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            {person.slaBreachCount ?? 0}
          </span>
          <span className="text-xs text-slate-400">Vi phạm SLA</span>
        </div>
      </div>
    </div>
  );
}

// ─── PeopleDirectoryPage ──────────────────────────────────────────────────────

export function PeopleDirectoryPage() {
  const tenantCtx = useContext(TenantContextContext);
  const tenantId = tenantCtx?.tenantId ?? 'real_estate';

  const [allPeople, setAllPeople] = useState<PersonCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllInScopeAction({ tenantId });
      if (result.success && result.candidates) {
        const augmented = result.candidates.map((ref, idx) => augmentPerson(ref, idx));
        setAllPeople(augmented);
      }
    } catch (err) {
      console.error('[PeopleDirectoryPage] load error: %s', err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  // ── Filters ──

  const filtered = allPeople.filter(p => {
    const matchSearch = !searchQuery ||
      p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.branch ?? '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchType = typeFilter === 'all' || p.type === typeFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchSearch && matchType && matchStatus;
  });

  // ── Summary stats ──

  const stats = {
    total: allPeople.length,
    active: allPeople.filter(p => p.status === 'active').length,
    onLeave: allPeople.filter(p => p.status === 'on_leave').length,
    brokers: allPeople.filter(p => p.type === 'broker' || p.type === 'agency').length,
  };

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'employee', label: 'Nhân viên' },
    { value: 'broker', label: 'Môi giới' },
    { value: 'agency', label: 'Đại lý' },
    { value: 'partner', label: 'Đối tác' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Danh Mục Nhân Sự
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý toàn bộ nhân sự tham gia hệ thống bất động sản
          </p>
        </div>

        <button
          onClick={loadPeople}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng nhân sự', value: stats.total, icon: <Users className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800' },
          { label: 'Đang hoạt động', value: stats.active, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' },
          { label: 'Đang nghỉ phép', value: stats.onLeave, icon: <Clock className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
          { label: 'Môi giới / Đại lý', value: stats.brokers, icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl border ${s.color}`}>
            <div className={`flex-shrink-0 p-2 rounded-lg bg-white/60 dark:bg-black/20 ${s.color.split(' ')[0]}`}>
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-extrabold leading-none">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm tên, chi nhánh..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === opt.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang làm</option>
          <option value="on_leave">Nghỉ phép</option>
          <option value="inactive">Không hoạt động</option>
        </select>

        {/* Result count */}
        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
          {filtered.length} / {allPeople.length} nhân sự
        </span>
      </div>

      {/* Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-44 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <User className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Không tìm thấy nhân sự phù hợp</p>
          <button
            onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(person => (
            <PersonCardView key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}
