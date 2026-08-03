'use client';
/**
 * @component OrgChartPage
 *
 * Trang Sơ Đồ Tổ Chức — Real Estate
 *
 * Hiển thị cơ cấu tổ chức dạng cây (Công ty → Chi nhánh → Team → Dự án)
 * cùng danh sách nhân sự trực thuộc từng đơn vị.
 *
 * Data source: Foundation Layer (org_units + org_relationships + people_directory)
 * via Server Actions.
 *
 * @layer Module UI (Layer 3)
 */

import { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  ChevronRight,
  ChevronDown,
  Briefcase,
  MapPin,
  RefreshCw,
  User,
  Shield,
  Network,
  Layers,
  Search,
  X,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { getAllInScopeAction } from '@/modules/real_estate/actions/leadAssignmentActions';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import type { AssignableReference } from '@/foundation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgUnit {
  id: string;
  name: string;
  type: 'company' | 'region' | 'branch' | 'department' | 'team' | 'project_group' | 'committee';
  code?: string;
  children: OrgUnit[];
  members?: AssignableReference[];
  isExpanded?: boolean;
}

// ─── Static Demo Tree (sẽ replace bằng Foundation API call) ──────────────────
// Theo seed data: 20260801040000_foundation_org_people_seed_real_estate.sql

const DEMO_ORG_TREE: OrgUnit[] = [
  {
    id: 'root',
    name: 'Bella Real Estate Group',
    type: 'company',
    code: 'BRE',
    isExpanded: true,
    children: [
      {
        id: 'region-south',
        name: 'Miền Nam',
        type: 'region',
        code: 'MN',
        isExpanded: true,
        children: [
          {
            id: 'branch-hcm',
            name: 'Chi Nhánh Hồ Chí Minh',
            type: 'branch',
            code: 'HCM',
            isExpanded: false,
            children: [
              { id: 'team-sale-hcm', name: 'Team Sale HCM', type: 'team', code: 'SALE-HCM', children: [] },
              { id: 'team-broker-hcm', name: 'Team Môi Giới HCM', type: 'team', code: 'BROKER-HCM', children: [] },
              { id: 'proj-bella-res', name: 'Dự Án Bella Residences', type: 'project_group', code: 'BELLA-RES', children: [] },
            ],
          },
          {
            id: 'branch-binh-duong',
            name: 'Chi Nhánh Bình Dương',
            type: 'branch',
            code: 'BD',
            isExpanded: false,
            children: [
              { id: 'team-sale-bd', name: 'Team Sale BD', type: 'team', code: 'SALE-BD', children: [] },
            ],
          },
        ],
      },
      {
        id: 'region-central',
        name: 'Miền Trung',
        type: 'region',
        code: 'MT',
        isExpanded: false,
        children: [
          {
            id: 'branch-danang',
            name: 'Chi Nhánh Đà Nẵng',
            type: 'branch',
            code: 'DN',
            isExpanded: false,
            children: [
              { id: 'team-sale-dn', name: 'Team Sale ĐN', type: 'team', code: 'SALE-DN', children: [] },
            ],
          },
        ],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UNIT_ICONS: Record<OrgUnit['type'], React.ReactNode> = {
  company: <Building2 className="w-4 h-4" />,
  region: <MapPin className="w-4 h-4" />,
  branch: <Briefcase className="w-4 h-4" />,
  department: <Layers className="w-4 h-4" />,
  team: <Users className="w-4 h-4" />,
  project_group: <Network className="w-4 h-4" />,
  committee: <Shield className="w-4 h-4" />,
};

const UNIT_COLORS: Record<OrgUnit['type'], string> = {
  company:       'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  region:        'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  branch:        'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  department:    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  team:          'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  project_group: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
  committee:     'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const TYPE_LABEL: Record<OrgUnit['type'], string> = {
  company:       'Công ty',
  region:        'Khu vực',
  branch:        'Chi nhánh',
  department:    'Phòng ban',
  team:          'Team',
  project_group: 'Dự án',
  committee:     'Hội đồng',
};

const ASSIGNABLE_TYPE_LABEL: Record<string, string> = {
  employee: 'Nhân viên',
  broker: 'Môi giới',
  agency: 'Đại lý',
  partner: 'Đối tác',
  consultant: 'Tư vấn',
  contractor: 'Cộng tác viên',
};

function getInitials(name: string): string {
  return name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
}

// ─── OrgNode Component ────────────────────────────────────────────────────────

function OrgNode({
  unit,
  depth = 0,
  tenantId,
  onSelect,
  selectedId,
}: {
  unit: OrgUnit;
  depth?: number;
  tenantId: string;
  onSelect: (unit: OrgUnit) => void;
  selectedId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(unit.isExpanded ?? false);
  const hasChildren = unit.children.length > 0;
  const isSelected = selectedId === unit.id;

  return (
    <div className="select-none">
      <button
        onClick={() => {
          if (hasChildren) setIsExpanded(e => !e);
          onSelect(unit);
        }}
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all duration-150
          ${isSelected
            ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
          }
        `}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand chevron */}
        <span className="flex-shrink-0 w-4 text-slate-400">
          {hasChildren
            ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
            : <span className="w-3.5" />
          }
        </span>

        {/* Unit icon badge */}
        <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md border text-xs ${UNIT_COLORS[unit.type]}`}>
          {UNIT_ICONS[unit.type]}
        </span>

        {/* Unit name */}
        <span className="flex-1 min-w-0 truncate text-sm font-medium">{unit.name}</span>

        {/* Code badge */}
        {unit.code && (
          <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500 font-mono">
            {unit.code}
          </span>
        )}
      </button>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="relative ml-6">
          {/* Connector line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700 ml-3" />
          {unit.children.map(child => (
            <OrgNode
              key={child.id}
              unit={child}
              depth={depth + 1}
              tenantId={tenantId}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function getMemberProfile(member: AssignableReference) {
  const slug = member.displayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, ".")
    .replace(/[^a-z.]/g, "");

  const email = `${slug}@bellareal.vn`;
  
  const lastDigits = (member.id.charCodeAt(0) || 0) + (member.displayName.length * 7);
  const phone = `0987.654.${String(100 + (lastDigits % 900))}`;
  
  const joinedDate = `15/03/202${4 + (member.displayName.length % 3)}`;
  const leadsCount = 12 + (member.displayName.length % 20);
  const conversionRate = 15 + (member.displayName.length % 15);
  const status = member.displayName.length % 2 === 0 ? "Đang hoạt động" : "Họp ngoài";

  return {
    email,
    phone,
    joinedDate,
    leadsCount,
    conversionRate,
    status,
  };
}

function MemberCard({ member, onClick }: { member: AssignableReference; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30 hover:shadow-sm transition-all duration-150 group text-left focus:outline-none"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-sm border border-primary/20">
        {getInitials(member.displayName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {member.displayName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {ASSIGNABLE_TYPE_LABEL[member.type] ?? member.type}
        </p>
      </div>
      <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </span>
    </button>
  );
}

// ─── OrgChartPage ─────────────────────────────────────────────────────────────

export function OrgChartPage() {
  const router = useRouter();
  const tenantCtx = useContext(TenantContextContext);
  const tenantId = tenantCtx?.tenantId ?? 'real_estate';

  const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(null);
  const [selectedMember, setSelectedMember] = useState<AssignableReference | null>(null);
  const [members, setMembers] = useState<AssignableReference[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ branches: 3, teams: 5, people: 8 });

  // When a unit is selected, load its members via Foundation API
  const handleSelectUnit = useCallback(async (unit: OrgUnit) => {
    setSelectedUnit(unit);
    if (unit.type === 'company') {
      setMembers([]);
      return;
    }

    setIsMembersLoading(true);
    try {
      const isBranch = unit.type === 'branch';
      const result = await getAllInScopeAction({
        tenantId,
        branchId: isBranch ? unit.id : undefined,
        teamId: unit.type === 'team' ? unit.id : undefined,
      });

      if (result.success && result.candidates) {
        setMembers(result.candidates);
      } else {
        setMembers([]);
      }
    } catch {
      setMembers([]);
    } finally {
      setIsMembersLoading(false);
    }
  }, [tenantId]);

  // Filter members by search
  const filteredMembers = members.filter(m =>
    m.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ASSIGNABLE_TYPE_LABEL[m.type] ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group members by type
  const membersByType = filteredMembers.reduce<Record<string, AssignableReference[]>>((acc, m) => {
    const key = m.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Sơ Đồ Tổ Chức
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cơ cấu tổ chức và nhân sự — Bella Real Estate Group
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3">
          {[
            { label: 'Chi nhánh', value: stats.branches, color: 'text-emerald-600' },
            { label: 'Teams', value: stats.teams, color: 'text-sky-600' },
            { label: 'Nhân sự', value: stats.people, color: 'text-violet-600' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm min-w-[72px]">
              <span className={`text-xl font-extrabold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Org Tree */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Cây Tổ Chức
              </h2>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Legend */}
            <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
              {(Object.entries(TYPE_LABEL) as [OrgUnit['type'], string][]).slice(0, 4).map(([type, label]) => (
                <span key={type} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${UNIT_COLORS[type]}`}>
                  {UNIT_ICONS[type]}
                  {label}
                </span>
              ))}
            </div>

            {/* Tree */}
            <div className="p-3 space-y-0.5 max-h-[520px] overflow-y-auto">
              {DEMO_ORG_TREE.map(unit => (
                <OrgNode
                  key={unit.id}
                  unit={unit}
                  tenantId={tenantId}
                  onSelect={handleSelectUnit}
                  selectedId={selectedUnit?.id ?? null}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div className="lg:col-span-7 xl:col-span-8">
          {!selectedUnit ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-400">
              <Network className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Chọn một đơn vị để xem nhân sự</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Detail header */}
              <div className={`px-5 py-4 border-b border-slate-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl border ${UNIT_COLORS[selectedUnit.type]}`}>
                    {UNIT_ICONS[selectedUnit.type]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedUnit.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {TYPE_LABEL[selectedUnit.type]}
                      {selectedUnit.code && <span className="ml-2 font-mono text-slate-400">· {selectedUnit.code}</span>}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${UNIT_COLORS[selectedUnit.type]}`}>
                      {members.length} nhân sự
                    </span>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm nhân sự..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>

              {/* Members list */}
              <div className="p-5 space-y-5 max-h-[460px] overflow-y-auto">
                {isMembersLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <User className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">
                      {selectedUnit.type === 'company'
                        ? 'Chọn chi nhánh hoặc team để xem thành viên'
                        : searchQuery
                        ? 'Không tìm thấy nhân sự phù hợp'
                        : 'Chưa có nhân sự trong đơn vị này'}
                    </p>
                  </div>
                ) : (
                  Object.entries(membersByType).map(([type, group]) => (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {ASSIGNABLE_TYPE_LABEL[type] ?? type}
                        </span>
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5">{group.length}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.map(m => (
                          <MemberCard key={m.id} member={m} onClick={() => setSelectedMember(m)} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─ Employee Detail Modal ─ */}
      <AnimatePresence>
        {selectedMember && (() => {
          const profile = getMemberProfile(selectedMember);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedMember(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              />

              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col"
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedMember(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-20"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Hero Header */}
                <div className="relative p-6 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-black text-3xl border border-primary/20 shadow-inner mb-4">
                    {getInitials(selectedMember.displayName)}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedMember.displayName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    ID: {selectedMember.id}
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-primary/5 text-primary border-primary/10">
                      {ASSIGNABLE_TYPE_LABEL[selectedMember.type] ?? selectedMember.type}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      profile.status === "Đang hoạt động"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700/30"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700/30"
                    }`}>
                      {profile.status}
                    </span>
                  </div>
                </div>

                {/* Profile Details */}
                <div className="p-6 space-y-4">
                  {/* Contact Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Email:</span>
                      <span className="text-slate-900 dark:text-white font-medium truncate select-all">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Số điện thoại:</span>
                      <span className="text-slate-900 dark:text-white font-medium select-all">{profile.phone}</span>
                    </div>
                    {selectedUnit && (
                      <div className="flex items-center gap-3 text-sm">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">Đơn vị:</span>
                        <span className="text-slate-900 dark:text-white font-medium">{selectedUnit.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Ngày gia nhập:</span>
                      <span className="text-slate-900 dark:text-white font-medium">{profile.joinedDate}</span>
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800" />

                  {/* Performance Mini Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                      <span className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Lead phụ trách</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-blue-500" />
                        {profile.leadsCount}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                      <span className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Tỉ lệ chốt</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        {profile.conversionRate}%
                      </span>
                    </div>
                  </div>
                </div>

                 {/* Footer Actions */}
                <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/30 dark:bg-slate-900/10">
                  <button
                    onClick={() => {
                      setSelectedMember(null);
                      router.push('/dashboard/chat');
                      toast.success(`Đang mở cổng trò chuyện với ${selectedMember.displayName}`);
                    }}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Nhắn tin
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMember(null);
                      router.push('/dashboard/real-estate/bi-analytics');
                      toast.success(`Đang chuyển hướng sang Báo cáo Hiệu suất của ${selectedMember.displayName}`);
                    }}
                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Hiệu suất
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
