'use client';

/**
 * Bella Education — Parent Engagement Command Center & Parent Inbox (P6.3)
 * 
 * Scalable Architecture & Boundary Enforcement:
 * - 3 Independent Lifecycles:
 *     Delivery: DRAFT ➔ READY ➔ SENT ➔ DELIVERED ➔ READ (or FAILED)
 *     Acknowledgement: NOT_REQUIRED | PENDING ➔ ACKNOWLEDGED | EXPIRED
 *     Consent Response: NOT_REQUIRED | PENDING ➔ APPROVED | DECLINED | EXPIRED | REVOKED
 * - Invariants: READ ≠ ACKNOWLEDGED, ACKNOWLEDGED ≠ CONSENTED, SENT ≠ DELIVERED
 * - Strict Negative Guards: Cannot ACK or Consent if notice is UNREAD
 * - Cross-Domain Source Traceability: Preserves P4 (Care), P5 (Learning), P3 (Classroom) source domain, version & fingerprint
 * - Staff Exception Work Queue: Overdue ACK & Declined Consent escalation resolution
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Inbox,
  ArrowLeft,
  Search,
  Bell,
  CheckCheck,
  User,
  Heart,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  X,
  Check,
  Layers,
  Filter,
  Activity,
  Users,
  FileText,
  AlertCircle,
  FileCheck,
  Send,
  Lock,
  RefreshCw,
  Eye,
  MessageSquare
} from 'lucide-react';

export type DeliveryStatus = 'DRAFT' | 'READY' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type AckStatus = 'NOT_REQUIRED' | 'PENDING' | 'ACKNOWLEDGED' | 'EXPIRED';
export type ConsentStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';

export type CommunicationItem = {
  id: string;
  tenantId: string;
  sourceDomain: 'CARE' | 'LEARNING' | 'CLASSROOM';
  sourceEntityType: string;
  sourceEntityId: string;
  sourceVersion: number;
  projectionType: string;
  title: string;
  summary: string;
  childName: string;
  studentId: string;
  className: string;
  timestamp: string;
  sha256Fingerprint: string;
  deliveryStatus: DeliveryStatus;
  ackStatus: AckStatus;
  consentStatus: ConsentStatus;
  policyRequirement: 'NOTICE_ONLY' | 'REQUIRES_ACK' | 'REQUIRES_CONSENT';
  parentNote?: string;
  exceptionStatus?: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
  exceptionType?: 'OVERDUE_ACK' | 'CONSENT_DECLINED';
  attemptsCount: number;
};

export default function ParentInboxPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'care' | 'learning' | 'classroom' | 'work-queue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Initial Mock State with 4 cross-domain projected items
  const [items, setItems] = useState<CommunicationItem[]>([
    {
      id: 'NOT-001',
      tenantId: '00000000-0000-0000-0000-000000000001',
      sourceDomain: 'CARE',
      sourceEntityType: 'HEALTH_INCIDENT',
      sourceEntityId: 'INC-2026-001',
      sourceVersion: 1,
      projectionType: 'CRITICAL_HEALTH_INCIDENT',
      title: 'Báo Cáo Sức Khỏe & Va Chạm Nhẹ Giờ Chơi',
      summary: 'Bé Minh An bị trầy xước nhẹ ở gối trái lúc 10:15 trong lúc đá bóng sân cỏ. Y tế trường đã rửa vết thương và dán băng gạc.',
      childName: 'Nguyễn Minh An (Bé Bi)',
      studentId: '00000000-0000-0000-0000-000000000100',
      className: 'Lớp Mầm A1',
      timestamp: '10:30 Sáng (2 giờ trước)',
      sha256Fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      deliveryStatus: 'DELIVERED',
      ackStatus: 'PENDING',
      consentStatus: 'NOT_REQUIRED',
      policyRequirement: 'REQUIRES_ACK',
      attemptsCount: 1,
    },
    {
      id: 'NOT-002',
      tenantId: '00000000-0000-0000-0000-000000000001',
      sourceDomain: 'CARE',
      sourceEntityType: 'MEDICATION_REQUEST',
      sourceEntityId: 'MED-2026-088',
      sourceVersion: 1,
      projectionType: 'MEDICATION_AUTHORIZATION_REQUEST',
      title: 'Yêu Cầu Phụ Huynh Xác Nhận Cho Bé Uống Thuốc Kháng Sinh Chống Viêm Mũi',
      summary: 'Yêu cầu ủy quyền uống thuốc Augmentin 250mg lúc 13:30 sau giờ ăn trưa theo đơn bác sĩ gia đình gửi.',
      childName: 'Trần Bảo Ngọc (Bé Bắp)',
      studentId: '00000000-0000-0000-0000-000000000101',
      className: 'Lớp Chồi B1',
      timestamp: '08:00 Sáng (4 giờ trước)',
      sha256Fingerprint: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      deliveryStatus: 'READ',
      ackStatus: 'PENDING',
      consentStatus: 'PENDING',
      policyRequirement: 'REQUIRES_CONSENT',
      attemptsCount: 1,
    },
    {
      id: 'NOT-003',
      tenantId: '00000000-0000-0000-0000-000000000001',
      sourceDomain: 'LEARNING',
      sourceEntityType: 'PORTFOLIO',
      sourceEntityId: 'PORT-2026-V1',
      sourceVersion: 1,
      projectionType: 'PUBLISHED_PORTFOLIO_PARENT_PROJECTION',
      title: 'Hồ Sơ Phát Triển Cá Nhân Tháng 9 — Version 1 (Đã Xuất Bản)',
      summary: 'Tổng hợp 12 quan sát hoạt động STEAM, cột mốc ngôn ngữ & tiến bộ kỹ năng vận động tinh được Cô Chủ Nhiệm xác nhận.',
      childName: 'Lê Hoàng Nam (Bé Tí)',
      studentId: '00000000-0000-0000-0000-000000000102',
      className: 'Lớp Lá C1',
      timestamp: 'Hôm qua, 16:45',
      sha256Fingerprint: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
      deliveryStatus: 'READ',
      ackStatus: 'NOT_REQUIRED',
      consentStatus: 'NOT_REQUIRED',
      policyRequirement: 'NOTICE_ONLY',
      attemptsCount: 1,
    },
    {
      id: 'NOT-004',
      tenantId: '00000000-0000-0000-0000-000000000001',
      sourceDomain: 'CLASSROOM',
      sourceEntityType: 'CLASSROOM_EVENT',
      sourceEntityId: 'EVT-2026-TRIP',
      sourceVersion: 1,
      projectionType: 'CLASSROOM_ANNOUNCEMENT',
      title: 'Kế Hoạch Dã Ngoại Nông Trại Sinh Thái Tháng 10',
      summary: 'Thông báo chi tiết thời gian, trang phục và danh mục vật dụng cần chuẩn bị cho chuyến dã ngoại toàn trường ngày 15/10.',
      childName: 'Nguyễn Minh An (Bé Bi)',
      studentId: '00000000-0000-0000-0000-000000000100',
      className: 'Lớp Mầm A1',
      timestamp: '07:30 Sáng (Hôm nay)',
      sha256Fingerprint: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666ec13ab110',
      deliveryStatus: 'DELIVERED',
      ackStatus: 'PENDING',
      consentStatus: 'PENDING',
      policyRequirement: 'REQUIRES_CONSENT',
      exceptionStatus: 'ACTIVE',
      exceptionType: 'OVERDUE_ACK',
      attemptsCount: 2,
    },
  ]);

  // Action 1: Mark as Read
  const handleMarkAsRead = (id: string) => {
    setErrorBanner(null);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            deliveryStatus: 'READ',
          };
        }
        return item;
      })
    );
    setSuccessBanner('Đã cập nhật trạng thái thông báo thành ĐÃ ĐỌC (READ)');
  };

  // Action 2: Acknowledge Notice (Enforces Negative Guard: Notice MUST be READ first)
  const handleAcknowledge = (id: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    const target = items.find((i) => i.id === id);

    if (!target) return;

    // Strict Negative Guard: Cannot ACK if UNREAD (deliveryStatus !== 'READ')
    if (target.deliveryStatus !== 'READ') {
      setErrorBanner('COMMUNICATION_UNREAD_ACKNOWLEDGEMENT_ERROR: Không thể xác nhận (ACK) khi chưa mở đọc thông báo!');
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            ackStatus: 'ACKNOWLEDGED',
            // If exception was active for overdue ack, mark as resolved
            exceptionStatus: item.exceptionStatus === 'ACTIVE' ? 'RESOLVED' : item.exceptionStatus,
          };
        }
        return item;
      })
    );
    setSuccessBanner('Đã xác nhận tiếp nhận thông báo (ACKNOWLEDGED) thành công');
  };

  // Action 3: Submit Consent Response (Approve)
  const handleConsentApprove = (id: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    const target = items.find((i) => i.id === id);

    if (!target) return;

    // Strict Negative Guard: Cannot Consent if UNREAD
    if (target.deliveryStatus !== 'READ') {
      setErrorBanner('COMMUNICATION_UNREAD_CONSENT_ERROR: Không thể gửi đồng ý (Consent) khi chưa mở đọc thông báo!');
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            consentStatus: 'APPROVED',
            ackStatus: item.ackStatus === 'PENDING' ? 'ACKNOWLEDGED' : item.ackStatus,
            parentNote: 'Phụ huynh đồng ý cho con tham gia theo đúng quy trình.',
            exceptionStatus: item.exceptionStatus === 'ACTIVE' ? 'RESOLVED' : item.exceptionStatus,
          };
        }
        return item;
      })
    );
    setSuccessBanner('Đã gửi phản hồi đồng ý (APPROVED) thành công');
  };

  // Action 4: Submit Consent Response (Decline)
  const handleConsentDecline = (id: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    const target = items.find((i) => i.id === id);

    if (!target) return;

    if (target.deliveryStatus !== 'READ') {
      setErrorBanner('COMMUNICATION_UNREAD_CONSENT_ERROR: Không thể gửi từ chối khi chưa mở đọc thông báo!');
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            consentStatus: 'DECLINED',
            parentNote: 'Gia đình từ chối vì lý do bé đang điều trị y tế cá nhân.',
            exceptionStatus: 'ACTIVE',
            exceptionType: 'CONSENT_DECLINED',
          };
        }
        return item;
      })
    );
    setSuccessBanner('Đã ghi nhận phản hồi từ chối (DECLINED). Đã tạo Exception Escalation cho nhà trường!');
  };

  // Action 5: Staff Work Queue Resolve Exception
  const handleResolveException = (id: string) => {
    setErrorBanner(null);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            exceptionStatus: 'RESOLVED',
          };
        }
        return item;
      })
    );
    setSuccessBanner('Nhà trường đã xử lý xong Exception Escalation!');
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === 'care' && item.sourceDomain !== 'CARE') return false;
    if (activeTab === 'learning' && item.sourceDomain !== 'LEARNING') return false;
    if (activeTab === 'classroom' && item.sourceDomain !== 'CLASSROOM') return false;
    if (activeTab === 'work-queue' && item.exceptionStatus !== 'ACTIVE') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.childName.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
    }
    return true;
  });

  const activeExceptionCount = items.filter((i) => i.exceptionStatus === 'ACTIVE').length;
  const pendingAckCount = items.filter((i) => i.ackStatus === 'PENDING' && i.policyRequirement !== 'NOTICE_ONLY').length;
  const pendingConsentCount = items.filter((i) => i.consentStatus === 'PENDING' && i.policyRequirement === 'REQUIRES_CONSENT').length;

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── UNIFIED HEADER & BRANDING ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Parent Engagement Command Center — Hộp Thư Phụ Huynh
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Truyền thông 360° đa chiều (P4 Care, P5 Learning, P3 Classroom) • 3 Vòng đời độc lập (Delivery, ACK, Consent)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              🟢 System Active & Idempotent
            </span>
          </div>
        </div>

        {/* ── OPERATIONAL METRICS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-1">
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase">
              <span>Tỷ Lệ Đã Đọc (Read)</span>
              <CheckCheck className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-indigo-900 dark:text-indigo-200">
              {Math.round((items.filter((i) => i.deliveryStatus === 'READ').length / items.length) * 100)}% READ
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {items.filter((i) => i.deliveryStatus === 'READ').length} / {items.length} thông báo đã mở đọc
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-1">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold uppercase">
              <span>Chờ Phụ Huynh ACK</span>
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-amber-900 dark:text-amber-200" id="queue-pending-ack-count">
              {pendingAckCount} Thông Báo
            </p>
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Yêu cầu xác nhận tiếp nhận từ phụ huynh
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/60 space-y-1">
            <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-bold uppercase">
              <span>Chờ Phản Hồi Đồng Ý</span>
              <FileCheck className="w-4 h-4" />
            </div>
            <p className="text-2xl font-extrabold text-purple-900 dark:text-purple-200" id="queue-pending-consent-count">
              {pendingConsentCount} Form Consent
            </p>
            <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-400">
              Ủy quyền y tế & dã ngoại
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 space-y-1">
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold uppercase">
              <span>Staff Work Queue</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-extrabold text-rose-900 dark:text-rose-200" id="queue-active-exception-count">
              {activeExceptionCount} Exceptions
            </p>
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
              🔴 Overdue ACK & Consent Declined
            </p>
          </div>
        </div>

        {/* ── BANNERS & NOTIFICATIONS ── */}
        {errorBanner && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in" id="notice-error-banner">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="p-1 text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successBanner && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in" id="notice-success-banner">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="p-1 text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── TAB NAVIGATION & SEARCH ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              id="tab-all"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Tất Cả ({items.length})
            </button>
            <button
              id="tab-care"
              onClick={() => setActiveTab('care')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'care'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              P4 Care & Wellbeing ({items.filter((i) => i.sourceDomain === 'CARE').length})
            </button>
            <button
              id="tab-learning"
              onClick={() => setActiveTab('learning')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'learning'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              P5 Learning ({items.filter((i) => i.sourceDomain === 'LEARNING').length})
            </button>
            <button
              id="tab-classroom"
              onClick={() => setActiveTab('classroom')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'classroom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              P3 Classroom ({items.filter((i) => i.sourceDomain === 'CLASSROOM').length})
            </button>
            <button
              id="tab-work-queue"
              onClick={() => setActiveTab('work-queue')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'work-queue'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Staff Work Queue ({activeExceptionCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm thông báo, tên trẻ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ── MAIN TIMELINE & WORK QUEUE LISTING ── */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            id={`notice-card-${item.id}`}
            className={`p-6 rounded-3xl bg-white dark:bg-slate-800/90 border ${
              item.exceptionStatus === 'ACTIVE'
                ? 'border-rose-300 dark:border-rose-900 shadow-md bg-rose-50/20'
                : 'border-slate-200/80 dark:border-slate-700/80 shadow-sm'
            } space-y-5 transition-all`}
          >
            {/* Notice Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-wide ${
                    item.sourceDomain === 'CARE'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : item.sourceDomain === 'LEARNING'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}
                >
                  {item.sourceDomain} • {item.projectionType}
                </span>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  {item.childName} ({item.className})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">{item.timestamp}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  v{item.sourceVersion}
                </span>
              </div>
            </div>

            {/* Title & Content */}
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                {item.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.summary}
              </p>
            </div>

            {/* 3 INDEPENDENT LIFECYCLE BADGES */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Lifecycle 1: Delivery */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  1. Delivery Lifecycle
                </span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    id={`badge-delivery-${item.id}`}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                      item.deliveryStatus === 'READ'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    {item.deliveryStatus === 'READ' ? '✓ READ (Đã Đọc)' : item.deliveryStatus}
                  </span>
                </div>
              </div>

              {/* Lifecycle 2: Acknowledgement */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  2. Acknowledgement Status
                </span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    id={`badge-ack-${item.id}`}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                      item.ackStatus === 'ACKNOWLEDGED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.ackStatus === 'PENDING'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.ackStatus}
                  </span>
                </div>
              </div>

              {/* Lifecycle 3: Consent Response */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  3. Consent Response Status
                </span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    id={`badge-consent-${item.id}`}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] ${
                      item.consentStatus === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.consentStatus === 'DECLINED'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : item.consentStatus === 'PENDING'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.consentStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Parent Note or Exception Alert */}
            {item.parentNote && (
              <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 text-xs font-medium text-indigo-900 dark:text-indigo-200">
                💬 Ghi chú phụ huynh: <strong>"{item.parentNote}"</strong>
              </div>
            )}

            {item.exceptionStatus === 'ACTIVE' && (
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Staff Work Queue Exception: <strong>{item.exceptionType}</strong> (Cần Ban Giám Hiệu/Giáo Viên xử lý)
                  </span>
                </div>
                <button
                  id={`btn-resolve-exception-${item.id}`}
                  onClick={() => handleResolveException(item.id)}
                  className="px-3 py-1 rounded-xl bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition-all cursor-pointer"
                >
                  Xử Lý Xong
                </button>
              </div>
            )}

            {/* INTERACTIVE PARENT ACTION CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                {/* Mark as Read Button */}
                {item.deliveryStatus !== 'READ' && (
                  <button
                    id={`btn-mark-read-${item.id}`}
                    onClick={() => handleMarkAsRead(item.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs hover:bg-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Mở Đọc Thông Báo</span>
                  </button>
                )}

                {/* Acknowledge Button */}
                {item.policyRequirement === 'REQUIRES_ACK' && item.ackStatus === 'PENDING' && (
                  <button
                    id={`btn-acknowledge-${item.id}`}
                    onClick={() => handleAcknowledge(item.id)}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Xác Nhận Đã Tiếp Nhận (ACK)</span>
                  </button>
                )}

                {/* Consent Response Buttons */}
                {item.policyRequirement === 'REQUIRES_CONSENT' && item.consentStatus === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-consent-approve-${item.id}`}
                      onClick={() => handleConsentApprove(item.id)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Đồng Ý (Approve)</span>
                    </button>

                    <button
                      id={`btn-consent-decline-${item.id}`}
                      onClick={() => handleConsentDecline(item.id)}
                      className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-rose-100 hover:text-rose-700 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Từ Chối (Decline)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Traceability Info Modal Trigger / Tooltip */}
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2" id={`traceability-card-${item.id}`}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>SHA-256: {item.sha256Fingerprint.slice(0, 12)}...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
