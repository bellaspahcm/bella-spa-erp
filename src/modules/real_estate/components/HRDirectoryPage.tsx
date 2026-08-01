'use client';

/**
 * @module modules/real_estate/components/HRDirectoryPage
 *
 * HR Directory UI — Real Estate module view.
 * Displays employee profiles with contracts, department grouping, and profile details.
 *
 * Data source: HR Capability (Layer 2) via hrActions Server Actions
 * Design: Premium, dark-mode, card-based layout with animated transitions
 */

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import {
  listActiveEmployeesAction,
  getEmployeeProfileAction,
  getActiveContractAction,
} from '@/modules/real_estate/actions/hrActions';
import type {
  HREmployeeSummaryRow,
  HREmployeeProfileView,
  HRContract,
} from '@/capabilities/hr/contracts';

// ─── Icons (inline SVG for zero dependency) ───────────────────────────────────

const Icons = {
  User: () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Briefcase: () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  FileText: () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Building: () => (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Calendar: () => (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: 'Đang làm việc',
  on_leave: 'Đang nghỉ phép',
  probation: 'Thử việc',
  suspended: 'Tạm đình chỉ',
  terminated: 'Đã nghỉ',
  resigned: 'Tự nghỉ',
};

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  on_leave: '#f59e0b',
  probation: '#6366f1',
  suspended: '#ef4444',
  terminated: '#6b7280',
  resigned: '#6b7280',
};

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  probation: 'Hợp đồng thử việc',
  fixed_term_1y: 'HĐLĐ 1 năm',
  fixed_term_3y: 'HĐLĐ 3 năm',
  indefinite: 'HĐLĐ không xác định thời hạn',
  freelance: 'Cộng tác viên',
  service_contract: 'Hợp đồng dịch vụ',
  amendment: 'Phụ lục hợp đồng',
  termination: 'Thỏa thuận chấm dứt',
};

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  pending: '#f59e0b',
  active: '#10b981',
  expired: '#ef4444',
  terminated: '#ef4444',
  superseded: '#6b7280',
};

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  contract: 'Hợp đồng',
  probation: 'Thử việc',
  intern: 'Thực tập',
  freelance: 'Cộng tác viên',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function HRDirectoryPage() {
  const tenantCtx = useContext(TenantContextContext);
  const tenantId = tenantCtx?.tenantId ?? 'real_estate';

  // Data
  const [employees, setEmployees] = useState<HREmployeeSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected employee detail panel
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [profileDetail, setProfileDetail] = useState<HREmployeeProfileView | null>(null);
  const [activeContract, setActiveContract] = useState<HRContract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load employee list ─────────────────────────────────────────────────────

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listActiveEmployeesAction({ tenantId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEmployees(result.employees);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // ── Load detail when selected ──────────────────────────────────────────────

  useEffect(() => {
    if (!selectedPersonId) {
      setProfileDetail(null);
      setActiveContract(null);
      return;
    }
    setDetailLoading(true);
    Promise.all([
      getEmployeeProfileAction({ personId: selectedPersonId, tenantId }),
      getActiveContractAction({ personId: selectedPersonId, tenantId }),
    ]).then(([profileRes, contractRes]) => {
      if (profileRes.success) setProfileDetail(profileRes.profile);
      if (contractRes.success) setActiveContract(contractRes.contract);
    }).finally(() => setDetailLoading(false));
  }, [selectedPersonId, tenantId]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = employees.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.displayName.toLowerCase().includes(q) ||
      (e.positionTitle ?? '').toLowerCase().includes(q) ||
      (e.departmentName ?? '').toLowerCase().includes(q)
    );
  });

  // ── Group by department ────────────────────────────────────────────────────

  const grouped = filtered.reduce<Record<string, HREmployeeSummaryRow[]>>((acc, emp) => {
    const dept = emp.departmentName ?? 'Chưa phân phòng';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {});

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>HR Directory</h1>
          <p style={styles.subtitle}>
            {loading ? 'Đang tải...' : `${employees.length} nhân viên đang làm việc`}
          </p>
        </div>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}><Icons.Search /></span>
          <input
            style={styles.searchInput}
            placeholder="Tìm nhân viên, vị trí, phòng ban..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="hr-search"
          />
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error} — Đang hiển thị dữ liệu trống.
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div style={styles.layout}>

        {/* Employee list */}
        <div style={styles.listPanel}>
          {loading ? (
            <div style={styles.emptyState}>
              <div style={styles.spinner} />
              <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16 }}>Đang tải danh sách nhân viên...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={styles.emptyState}>
              <Icons.User />
              <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>
                {search ? 'Không tìm thấy kết quả' : 'Chưa có nhân viên nào'}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([dept, emps]) => (
              <div key={dept} style={styles.deptGroup}>
                <div style={styles.deptHeader}>
                  <Icons.Building />
                  <span style={styles.deptName}>{dept}</span>
                  <span style={styles.deptCount}>{emps.length}</span>
                </div>
                {emps.map(emp => (
                  <button
                    key={emp.personId}
                    id={`hr-emp-${emp.personId}`}
                    style={{
                      ...styles.empCard,
                      ...(selectedPersonId === emp.personId ? styles.empCardSelected : {}),
                    }}
                    onClick={() => setSelectedPersonId(
                      selectedPersonId === emp.personId ? null : emp.personId
                    )}
                  >
                    {/* Avatar */}
                    <div style={{
                      ...styles.avatar,
                      background: `hsl(${Math.abs(emp.personId.charCodeAt(0) * 37) % 360}, 60%, 40%)`,
                    }}>
                      {emp.displayName.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={styles.empInfo}>
                      <div style={styles.empName}>{emp.displayName}</div>
                      <div style={styles.empMeta}>
                        <span>{emp.positionTitle ?? EMPLOYMENT_TYPE_LABEL[emp.employmentType]}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div style={{
                      ...styles.statusBadge,
                      background: STATUS_COLOR[emp.employmentStatus] + '22',
                      color: STATUS_COLOR[emp.employmentStatus],
                      border: `1px solid ${STATUS_COLOR[emp.employmentStatus]}44`,
                    }}>
                      {STATUS_LABEL[emp.employmentStatus]}
                    </div>

                    <div style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
                      <Icons.ChevronRight />
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedPersonId && (
          <div style={styles.detailPanel}>
            {detailLoading ? (
              <div style={styles.emptyState}><div style={styles.spinner} /></div>
            ) : profileDetail ? (
              <EmployeeDetailPanel
                profile={profileDetail}
                activeContract={activeContract}
                onClose={() => setSelectedPersonId(null)}
              />
            ) : (
              <div style={styles.emptyState}>
                <p style={{ color: 'rgba(255,255,255,0.4)' }}>Chưa có hồ sơ HR</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Employee Detail Panel ────────────────────────────────────────────────────

interface DetailPanelProps {
  profile: HREmployeeProfileView;
  activeContract: HRContract | null;
  onClose: () => void;
}

function EmployeeDetailPanel({ profile, activeContract, onClose }: DetailPanelProps) {
  const fmtSalary = (n?: number) => n
    ? n.toLocaleString('vi-VN') + ' đ'
    : '—';

  const fmtDate = (s?: string) => s
    ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  return (
    <div style={styles.detail}>
      {/* Close */}
      <button
        style={styles.closeBtn}
        onClick={onClose}
        id="hr-detail-close"
        aria-label="Đóng chi tiết"
      >
        <Icons.X />
      </button>

      {/* Profile header */}
      <div style={styles.detailHeader}>
        <div style={{
          ...styles.avatarLg,
          background: `hsl(${Math.abs(profile.personId.charCodeAt(0) * 37) % 360}, 60%, 40%)`,
        }}>
          {profile.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={styles.detailName}>{profile.displayName}</h2>
          <p style={styles.detailPosition}>{profile.positionTitle ?? EMPLOYMENT_TYPE_LABEL[profile.employmentType]}</p>
          {profile.departmentName && (
            <p style={styles.detailDept}>
              <Icons.Building /> {profile.departmentName}
            </p>
          )}
        </div>
        <div style={{
          ...styles.statusBadge,
          marginLeft: 'auto',
          alignSelf: 'flex-start',
          background: STATUS_COLOR[profile.employmentStatus] + '22',
          color: STATUS_COLOR[profile.employmentStatus],
          border: `1px solid ${STATUS_COLOR[profile.employmentStatus]}44`,
        }}>
          {STATUS_LABEL[profile.employmentStatus]}
        </div>
      </div>

      {/* Info sections */}
      <div style={styles.sections}>

        {/* Employment */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Icons.Briefcase /> Thông tin công việc
          </div>
          <div style={styles.grid2}>
            <InfoField label="Loại hợp đồng" value={EMPLOYMENT_TYPE_LABEL[profile.employmentType]} />
            <InfoField label="Bậc / Grade" value={profile.grade ?? '—'} />
            <InfoField label="Salary Band" value={profile.salaryBand ?? '—'} />
            <InfoField label="Lương cơ bản" value={fmtSalary(profile.baseSalary)} highlight />
            <InfoField label="Ngày vào làm" value={fmtDate(profile.hireDate)} icon={<Icons.Calendar />} />
            <InfoField label="Ngày chính thức" value={fmtDate(profile.confirmationDate)} icon={<Icons.Calendar />} />
          </div>
        </div>

        {/* Contact */}
        {(profile.email || profile.phone) && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Icons.User /> Liên hệ
            </div>
            <div style={styles.grid2}>
              {profile.email && <InfoField label="Email" value={profile.email} />}
              {profile.phone && <InfoField label="Điện thoại" value={profile.phone} />}
            </div>
          </div>
        )}

        {/* HR sensitive */}
        {(profile.bhxhNumber || profile.taxCode || profile.bankAccount) && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Icons.FileText /> Thông tin BHXH / Thuế
            </div>
            <div style={styles.grid2}>
              {profile.bhxhNumber && <InfoField label="Số BHXH" value={profile.bhxhNumber} />}
              {profile.taxCode && <InfoField label="MST cá nhân" value={profile.taxCode} />}
              {profile.bankAccount && (
                <InfoField
                  label={profile.bankName ? `${profile.bankName}` : 'Số tài khoản'}
                  value={profile.bankAccount}
                />
              )}
            </div>
          </div>
        )}

        {/* Active contract */}
        {activeContract ? (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Icons.FileText /> Hợp đồng hiệu lực
            </div>
            <div style={styles.contractCard}>
              <div style={styles.contractHeader}>
                <span style={styles.contractType}>
                  {CONTRACT_TYPE_LABEL[activeContract.contractType]}
                </span>
                <span style={{
                  ...styles.statusBadge,
                  background: CONTRACT_STATUS_COLOR[activeContract.status] + '22',
                  color: CONTRACT_STATUS_COLOR[activeContract.status],
                  border: `1px solid ${CONTRACT_STATUS_COLOR[activeContract.status]}44`,
                }}>
                  {activeContract.status}
                </span>
              </div>
              {activeContract.contractNumber && (
                <p style={styles.contractNum}>#{activeContract.contractNumber}</p>
              )}
              <div style={styles.grid2}>
                <InfoField label="Bắt đầu" value={fmtDate(activeContract.startDate)} icon={<Icons.Calendar />} />
                <InfoField
                  label="Kết thúc"
                  value={activeContract.endDate ? fmtDate(activeContract.endDate) : 'Không xác định'}
                  icon={<Icons.Calendar />}
                />
                {activeContract.agreedBaseSalary && (
                  <InfoField label="Lương thỏa thuận" value={fmtSalary(activeContract.agreedBaseSalary)} highlight />
                )}
              </div>
              {/* Signatures */}
              <div style={styles.sigRow}>
                <SigBadge label="NV ký" done={activeContract.signedByEmployee} />
                <SigBadge label="Cty ký" done={activeContract.signedByCompany} />
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.section}>
            <div style={styles.sectionTitle}><Icons.FileText /> Hợp đồng</div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              Chưa có hợp đồng đang hiệu lực
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoField({ label, value, highlight, icon }: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div style={styles.infoField}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={{ ...styles.infoValue, ...(highlight ? styles.infoValueHL : {}) }}>
        {icon && <span style={{ marginRight: 4, opacity: 0.6 }}>{icon}</span>}
        {value}
      </span>
    </div>
  );
}

function SigBadge({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: done ? '#10b98122' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${done ? '#10b98144' : 'rgba(255,255,255,0.1)'}`,
      fontSize: 12,
      color: done ? '#10b981' : 'rgba(255,255,255,0.4)',
    }}>
      {done ? '✓' : '○'} {label}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#0d0d14',
    color: '#fff',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    flexWrap: 'wrap',
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    color: 'rgba(255,255,255,0.35)',
    display: 'flex',
  },
  searchInput: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    padding: '8px 14px 8px 36px',
    width: 280,
    outline: 'none',
  },
  errorBanner: {
    background: '#ef444422',
    border: '1px solid #ef444444',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 13,
    color: '#ef4444',
    marginBottom: 20,
  },
  layout: {
    display: 'flex',
    gap: 20,
    alignItems: 'flex-start',
  },
  listPanel: {
    flex: '1 1 360px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  detailPanel: {
    flex: '0 0 400px',
    minWidth: 320,
    maxWidth: 420,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    color: 'rgba(255,255,255,0.25)',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '2px solid rgba(255,255,255,0.1)',
    borderTop: '2px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  deptGroup: {
    marginBottom: 8,
  },
  deptHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  deptName: { flex: 1 },
  deptCount: {
    background: 'rgba(255,255,255,0.08)',
    padding: '1px 7px',
    borderRadius: 20,
    fontSize: 11,
  },
  empCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 6,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    color: '#fff',
  },
  empCardSelected: {
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.35)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
    color: '#fff',
  },
  empInfo: { flex: 1, minWidth: 0 },
  empName: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  empMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  // Detail panel
  detail: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 24,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '50%',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.6)',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 24,
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 22,
    flexShrink: 0,
    color: '#fff',
  },
  detailName: {
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 4px',
  },
  detailPosition: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    margin: 0,
  },
  detailDept: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    margin: '4px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  section: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: 16,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 12,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 16px',
  },
  infoField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  infoLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
  },
  infoValue: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    display: 'flex',
    alignItems: 'center',
  },
  infoValueHL: {
    color: '#10b981',
    fontWeight: 600,
    fontSize: 14,
  },
  contractCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  contractHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contractType: {
    fontSize: 13,
    fontWeight: 600,
    color: '#818cf8',
  },
  contractNum: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    margin: '0 0 10px',
  },
  sigRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
};
