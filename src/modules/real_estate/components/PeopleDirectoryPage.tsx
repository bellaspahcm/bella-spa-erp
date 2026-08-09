'use client';

/**
 * @component PeopleDirectoryPage
 *
 * Trang Danh Mục Nhân Sự — Real Estate
 *
 * Hiển thị toàn bộ nhân sự của tenant với 2 chế độ hiển thị:
 * 1. Dạng Lưới (Card Grid) - Sang trọng, trực quan với các chỉ số thống kê dạng khối.
 * 2. Dạng Danh Sách (Table List) - Gọn gàng, tối ưu hóa không gian cho mật độ thông tin cao.
 *
 * Data source: Foundation Layer (people_directory) via Server Actions.
 *
 * @layer Module UI (Layer 3)
 */

import React, { useCallback, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  User,
  Building2,
  RefreshCw,
  MoreVertical,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  LayoutGrid,
  List,
  AlertCircle,
  UserPlus,
  Pencil,
  UserX,
  Loader2,
} from 'lucide-react';
import { getAllInScopeAction } from '@/modules/real_estate/actions/leadAssignmentActions';
import { deactivatePersonAction } from '@/modules/real_estate/actions/peopleActions';
import { PersonFormModal, type PersonFormData } from '@/modules/real_estate/components/PersonFormModal';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { AssignableReference, AssignableType } from '@/foundation';

// ─── Augmented Person ─────────────────────────────────────────────────────────

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

type TypeFilter = AssignableType | 'all';
type StatusFilter = 'all' | 'active' | 'on_leave' | 'inactive';

// Mock augmentation
function augmentPerson(ref: AssignableReference, idx: number): PersonCard {
  const branches = ['Chi nhánh HCM', 'Chi nhánh Bình Dương', 'Chi nhánh Đà Nẵng'];
  const statuses: PersonCard['status'][] = ['active', 'active', 'active', 'on_leave', 'active'];
  const emails = ['g.group@bellaland.vn', 'dang.dh@bellaland.vn', 'vanf.broker@gmail.com', 'binh.lq@bellaland.vn', 'minh.nv@bellaland.vn', 'cam.pt@bellaland.vn', 'anh.tt@bellaland.vn', 'broker.e@gmail.com'];

  return {
    ...ref,
    branch: branches[idx % branches.length],
    leadsActive: [3, 7, 5, 2, 4, 6, 1, 3][idx % 8],
    leadsConverted: [12, 24, 8, 31, 5, 18, 9, 12][idx % 8],
    slaBreachCount: [0, 1, 0, 2, 0, 0, 1, 0][idx % 8],
    status: statuses[idx % statuses.length],
    email: emails[idx % emails.length] || 'agent@bellaland.vn',
    phone: `090${idx}876543`,
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

const TYPE_COLOR_CLASSES: Record<string, string> = {
  employee: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  broker: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/20',
  agency: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  partner: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  consultant: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20',
  contractor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; colorClass: string; dotClass: string }> = {
  active: {
    label: 'Đang làm',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/10',
    dotClass: 'bg-emerald-500',
  },
  on_leave: {
    label: 'Nghỉ phép',
    icon: <Clock className="w-3.5 h-3.5" />,
    colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-amber-500/10',
    dotClass: 'bg-amber-500',
  },
  inactive: {
    label: 'Không hoạt động',
    icon: <XCircle className="w-3.5 h-3.5" />,
    colorClass: 'text-slate-400 bg-slate-500/5 border border-slate-500/10',
    dotClass: 'bg-slate-400',
  },
};

function getInitials(name: string): string {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
}

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

// ─── PersonCardView Component (Grid Mode) ─────────────────────────────────────

function PersonCardView({
  person,
  onEdit,
  onDeactivate,
}: {
  person: PersonCard;
  onEdit: (p: PersonCard) => void;
  onDeactivate: (p: PersonCard) => void;
}) {
  const router = useRouter();
  const hue = nameToHue(person.displayName);
  const status = person.status ?? 'active';
  const statusConfig = STATUS_CONFIG[status];
  
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div className="group relative flex flex-col gap-4 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 hover:border-violet-500/40 hover:shadow-xl dark:hover:shadow-violet-950/20 hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
      {/* Top row: avatar + identity */}
      <div className="flex items-start gap-4">
        {/* Avatar with dynamic hue gradient */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-md"
          style={{ background: `linear-gradient(135deg, hsl(${hue},70%,60%), hsl(${(hue+40)%360},80%,45%))` }}
        >
          {getInitials(person.displayName)}
        </div>

        {/* Name + Labels */}
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
            {person.displayName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider ${TYPE_COLOR_CLASSES[person.type] ?? TYPE_COLOR_CLASSES.contractor}`}>
              {TYPE_LABEL[person.type] ?? person.type}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${statusConfig.colorClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Actions Button & Menu */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-all duration-200"
            id={`card-opt-btn-${person.id}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden text-xs py-1">
              <button
                onClick={() => {
                  router.push(`/dashboard/real-estate/hr?personId=${person.id}`);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                Xem Hồ Sơ HR
              </button>
              <button
                onClick={() => {
                  onEdit(person);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-violet-50 dark:hover:bg-violet-500/10 font-semibold text-violet-700 dark:text-violet-400 transition flex items-center gap-2"
                id={`card-edit-btn-${person.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Chỉnh sửa thông tin
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <button
                onClick={() => {
                  onDeactivate(person);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold text-rose-600 dark:text-rose-400 transition flex items-center gap-2"
                id={`card-deactivate-btn-${person.id}`}
              >
                <UserX className="w-3.5 h-3.5" />
                Vô hiệu hóa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info items */}
      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 px-1">
        {person.branch && (
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <span className="truncate font-medium">{person.branch}</span>
          </div>
        )}
        {person.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <span className="truncate font-medium">{person.email}</span>
          </div>
        )}
      </div>

      {/* Structured metrics grid */}
      <div className="grid grid-cols-3 gap-1 p-2 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 mt-2">
        <div className="flex flex-col items-center py-1">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Đang có</span>
          <span className="text-sm font-black text-slate-950 dark:text-white mt-0.5">{person.leadsActive ?? 0}</span>
        </div>
        <div className="flex flex-col items-center py-1 border-x border-slate-200/60 dark:border-slate-850">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Đã chốt</span>
          <span className="text-sm font-black text-emerald-600 dark:text-emerald-450 mt-0.5">{person.leadsConverted ?? 0}</span>
        </div>
        <div className="flex flex-col items-center py-1">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Lỗi SLA</span>
          <span className={`text-sm font-black mt-0.5 ${(person.slaBreachCount ?? 0) > 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-600'}`}>
            {person.slaBreachCount ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PersonRowView Component (List/Table Mode) ────────────────────────────────

function PersonRowView({
  person,
  onEdit,
  onDeactivate,
}: {
  person: PersonCard;
  onEdit: (p: PersonCard) => void;
  onDeactivate: (p: PersonCard) => void;
}) {
  const router = useRouter();
  const hue = nameToHue(person.displayName);
  const status = person.status ?? 'active';
  const statusConfig = STATUS_CONFIG[status];
  
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition duration-150">
      {/* Identity Column */}
      <td className="p-4 pl-6">
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-xs shadow"
            style={{ background: `linear-gradient(135deg, hsl(${hue},70%,60%), hsl(${(hue+40)%360},80%,45%))` }}
          >
            {getInitials(person.displayName)}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white text-sm">{person.displayName}</p>
            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 ${TYPE_COLOR_CLASSES[person.type] ?? TYPE_COLOR_CLASSES.contractor}`}>
              {TYPE_LABEL[person.type] ?? person.type}
            </span>
          </div>
        </div>
      </td>

      {/* Branch & Contact */}
      <td className="p-4">
        <p className="font-semibold text-slate-850 dark:text-slate-200 text-xs">{person.branch || '—'}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{person.email || '—'}</p>
      </td>

      {/* Active Leads */}
      <td className="p-4 text-center font-bold text-slate-900 dark:text-white">
        {person.leadsActive ?? 0}
      </td>

      {/* Converted Leads */}
      <td className="p-4 text-center font-black text-emerald-600 dark:text-emerald-400">
        {person.leadsConverted ?? 0}
      </td>

      {/* SLA Breach Count */}
      <td className="p-4 text-center">
        <span className={`font-bold ${(person.slaBreachCount ?? 0) > 0 ? 'text-rose-500 font-extrabold' : 'text-slate-400 dark:text-slate-600'}`}>
          {person.slaBreachCount ?? 0}
        </span>
      </td>

      {/* Status */}
      <td className="p-4">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${statusConfig.colorClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
          {statusConfig.label}
        </span>
      </td>

      {/* Actions */}
      <td className="p-4 pr-6 text-right relative">
        <div className="inline-block text-left" ref={dropdownRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
            id={`row-opt-btn-${person.id}`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden text-xs py-1">
              <button
                onClick={() => {
                  router.push(`/dashboard/real-estate/hr?personId=${person.id}`);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                Xem Hồ Sơ HR
              </button>
              <button
                onClick={() => { onEdit(person); setMenuOpen(false); }}
                className="w-full text-left px-3.5 py-2 hover:bg-violet-50 dark:hover:bg-violet-500/10 font-semibold text-violet-700 dark:text-violet-400 transition flex items-center gap-2"
                id={`row-edit-btn-${person.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Chỉnh sửa thông tin
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <button
                onClick={() => { onDeactivate(person); setMenuOpen(false); }}
                className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold text-rose-600 dark:text-rose-400 transition flex items-center gap-2"
                id={`row-deactivate-btn-${person.id}`}
              >
                <UserX className="w-3.5 h-3.5" />
                Vô hiệu hóa
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export function PeopleDirectoryPage() {
  const tenantCtx = useContext(TenantContextContext);
  const tenantId = tenantCtx?.tenantId ?? 'real_estate';

  const [allPeople, setAllPeople] = useState<PersonCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonFormData | undefined>(undefined);

  // ── Deactivate confirm dialog state ──
  const [deactivateTarget, setDeactivateTarget] = useState<PersonCard | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllInScopeAction({ tenantId });
      if (result.success && result.candidates) {
        const augmented = result.candidates.map((ref, idx) => augmentPerson(ref, idx));
        setAllPeople(augmented);
      }
    } catch (err: unknown) {
      console.error('[PeopleDirectoryPage] load error: %s', err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  // ── Handlers ──

  function handleOpenCreate() {
    setEditTarget(undefined);
    setModalOpen(true);
  }

  function handleOpenEdit(person: PersonCard) {
    setEditTarget({
      personId: person.id,
      displayName: person.displayName,
      type: person.type,
      email: person.email ?? '',
      phone: person.phone ?? '',
      branch: person.branch ?? '',
    });
    setModalOpen(true);
  }

  function handleModalSuccess(personId: string, displayName: string) {
    // Optimistic update + reload
    loadPeople();
  }

  function handleOpenDeactivate(person: PersonCard) {
    setDeactivateTarget(person);
    setDeactivateError(null);
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    setDeactivateError(null);
    const result = await deactivatePersonAction({
      personId: deactivateTarget.id,
      tenantId,
    });
    setIsDeactivating(false);
    if (!result.success) {
      setDeactivateError(result.error);
      return;
    }
    setDeactivateTarget(null);
    // Remove from list optimistically
    setAllPeople(prev => prev.filter(p => p.id !== deactivateTarget.id));
  }

  // ── Filters ──

  const filtered = useMemo(() => {
    return allPeople.filter(p => {
      const matchSearch = !searchQuery ||
        p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.branch ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = typeFilter === 'all' || p.type === typeFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [allPeople, searchQuery, typeFilter, statusFilter]);

  // ── Stats ──

  const stats = useMemo(() => {
    return {
      total: allPeople.length,
      active: allPeople.filter(p => p.status === 'active').length,
      onLeave: allPeople.filter(p => p.status === 'on_leave').length,
      brokers: allPeople.filter(p => p.type === 'broker' || p.type === 'agency').length,
    };
  }, [allPeople]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'employee', label: 'Nhân viên' },
    { value: 'broker', label: 'Môi giới' },
    { value: 'agency', label: 'Đại lý' },
    { value: 'partner', label: 'Đối tác' },
  ];

  return (
    <>
    {/* ── Person Form Modal ── */}
    <PersonFormModal
      tenantId={tenantId}
      open={modalOpen}
      initialData={editTarget}
      onClose={() => setModalOpen(false)}
      onSuccess={handleModalSuccess}
    />

    {/* ── Deactivate Confirmation Dialog ── */}
    {deactivateTarget && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeactivating && setDeactivateTarget(null)} />
        <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-700/60 p-6 flex flex-col gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto">
            <UserX className="w-6 h-6 text-rose-500" />
          </div>
          <div className="text-center">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Vô hiệu hóa nhân sự?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
              Hành động này sẽ đưa <span className="font-bold text-slate-800 dark:text-slate-200">{deactivateTarget.displayName}</span> vào trạng thái không hoạt động. Họ sẽ không còn nhận được lead mới.
            </p>
          </div>
          {deactivateError && (
            <p className="text-xs text-rose-500 text-center flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />{deactivateError}
            </p>
          )}
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => setDeactivateTarget(null)}
              disabled={isDeactivating}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
              id="deactivate-cancel-btn"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirmDeactivate}
              disabled={isDeactivating}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              id="deactivate-confirm-btn"
            >
              {isDeactivating ? <><Loader2 className="w-4 h-4 animate-spin" />Đang xử lý...</> : 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-6 max-w-[1600px] mx-auto p-2">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-600" />
            Danh Mục Nhân Sự
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Quản lý toàn bộ nhân sự tham gia hệ thống bất động sản
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Dạng lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="Dạng danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadPeople}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          {/* Thêm nhân sự */}
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold hover:from-violet-500 hover:to-indigo-500 shadow-md hover:shadow-violet-500/25 transition-all active:scale-95"
            id="add-person-btn"
          >
            <UserPlus className="w-4 h-4" />
            Thêm nhân sự
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng nhân sự', value: stats.total, color: 'border-violet-100 dark:border-violet-800/80 bg-violet-500/5 text-violet-600 dark:text-violet-400' },
          { label: 'Đang hoạt động', value: stats.active, color: 'border-emerald-100 dark:border-emerald-800/80 bg-emerald-500/5 text-emerald-600 dark:text-emerald-450' },
          { label: 'Đang nghỉ phép', value: stats.onLeave, color: 'border-amber-100 dark:border-amber-800/80 bg-amber-500/5 text-amber-600 dark:text-amber-400' },
          { label: 'Môi giới / Đại lý', value: stats.brokers, color: 'border-blue-100 dark:border-blue-800/80 bg-blue-500/5 text-blue-600 dark:text-blue-400' },
        ].map(s => (
          <div key={s.label} className={`border rounded-2xl p-4 shadow-sm flex items-center justify-between ${s.color}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{s.label}</p>
              <p className="text-2xl font-black mt-1">{s.value}</p>
            </div>
            <div className="opacity-10 shrink-0">
              <Users className="w-8 h-8" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm tên, chi nhánh..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  typeFilter === opt.value
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <PremiumSelect
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang làm' },
              { value: 'on_leave', label: 'Nghỉ phép' },
              { value: 'inactive', label: 'Không hoạt động' },
            ]}
            value={statusFilter}
            onChange={val => setStatusFilter(val as StatusFilter)}
            buttonClassName="py-2 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700"
          />

          <span className="text-xs text-slate-400 font-medium ml-2 shrink-0">
            {filtered.length} / {allPeople.length} nhân sự
          </span>
        </div>
      </div>

      {/* ── Content rendering ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 rounded-3xl bg-slate-100 dark:bg-slate-800/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <AlertCircle className="w-12 h-12 mb-3 opacity-30 text-violet-500" />
          <p className="text-sm font-medium">Không tìm thấy nhân sự phù hợp</p>
          <button
            onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }}
            className="mt-2 text-xs text-violet-600 hover:underline font-semibold"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        // Grid View
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(person => (
            <PersonCardView
              key={person.id}
              person={person}
              onEdit={handleOpenEdit}
              onDeactivate={handleOpenDeactivate}
            />
          ))}
        </div>
      ) : (
        // List View (Table Layout)
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Nhân Sự</th>
                  <th className="p-4">Chi Nhánh / Liên Hệ</th>
                  <th className="p-4 text-center">Lead Đang Có</th>
                  <th className="p-4 text-center">Đã Chốt Cọc</th>
                  <th className="p-4 text-center">Vi Phạm SLA</th>
                  <th className="p-4">Trạng Thái</th>
                  <th className="p-4 pr-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(person => (
                  <PersonRowView
                    key={person.id}
                    person={person}
                    onEdit={handleOpenEdit}
                    onDeactivate={handleOpenDeactivate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
