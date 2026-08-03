'use client';

/**
 * @component PersonFormModal
 *
 * Modal form để thêm mới hoặc chỉnh sửa thông tin nhân sự (Nhân viên, Môi giới, Đại lý...).
 *
 * Features:
 * - Create mode: Form trống, gọi createPersonAction
 * - Edit mode: Form điền sẵn dữ liệu, gọi updatePersonAction
 * - Validation: Tên bắt buộc, email hợp lệ nếu có
 * - Loading/Error states đầy đủ
 *
 * @layer Module UI (Layer 3)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Pencil,
} from 'lucide-react';
import type { AssignableType } from '@/foundation/contracts';
import {
  createPersonAction,
  updatePersonAction,
  type CreatePersonInput,
} from '@/modules/real_estate/actions/peopleActions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonFormData {
  personId?: string;
  displayName: string;
  type: AssignableType;
  email: string;
  phone: string;
  branch: string;
}

interface PersonFormModalProps {
  tenantId: string;
  open: boolean;
  initialData?: PersonFormData;
  onClose: () => void;
  onSuccess: (personId: string, displayName: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERSON_TYPES: { value: AssignableType; label: string; description: string }[] = [
  { value: 'employee', label: 'Nhân viên', description: 'Nhân viên chính thức có HR record' },
  { value: 'broker', label: 'Môi giới', description: 'Môi giới bên ngoài' },
  { value: 'agency', label: 'Đại lý', description: 'Đại lý phân phối (F1, F2)' },
  { value: 'partner', label: 'Đối tác', description: 'Đối tác chiến lược' },
  { value: 'consultant', label: 'Tư vấn', description: 'Tư vấn độc lập' },
  { value: 'contractor', label: 'Cộng tác viên', description: 'Hợp đồng ngắn hạn / thời vụ' },
];

const BRANCHES = [
  'Chi nhánh HCM – Quận 1',
  'Chi nhánh HCM – Bình Thạnh',
  'Chi nhánh Bình Dương',
  'Chi nhánh Đà Nẵng',
  'Chi nhánh Hà Nội',
  'Chi nhánh Cần Thơ',
];

// ─── Field Component ──────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-rose-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function PersonFormModal({
  tenantId,
  open,
  initialData,
  onClose,
  onSuccess,
}: PersonFormModalProps) {
  const isEditMode = Boolean(initialData?.personId);

  const [formData, setFormData] = useState<PersonFormData>({
    displayName: '',
    type: 'employee',
    email: '',
    phone: '',
    branch: BRANCHES[0],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof PersonFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Populate form when opening edit mode
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({ displayName: '', type: 'employee', email: '', phone: '', branch: BRANCHES[0] });
      }
      setErrors({});
      setSubmitError(null);
      setShowSuccess(false);
      // Focus name field after mount
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open, initialData]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isSubmitting, onClose]);

  function set(field: keyof PersonFormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof PersonFormData, string>> = {};
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Họ và tên không được để trống';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Địa chỉ email không hợp lệ';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let personId: string;

      if (isEditMode && initialData?.personId) {
        const result = await updatePersonAction({
          personId: initialData.personId,
          tenantId,
          displayName: formData.displayName,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          branch: formData.branch,
        });
        if (!result.success) {
          setSubmitError(result.error);
          return;
        }
        personId = initialData.personId;
      } else {
        const createInput: CreatePersonInput = {
          tenantId,
          displayName: formData.displayName.trim(),
          type: formData.type,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          branch: formData.branch,
        };
        const result = await createPersonAction(createInput);
        if (!result.success) {
          setSubmitError(result.error);
          return;
        }
        personId = result.person.id;
      }

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess(personId, formData.displayName);
        onClose();
      }, 900);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && !isSubmitting) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isEditMode ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
              {isEditMode ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isEditMode ? 'Chỉnh sửa hồ sơ' : 'Thêm nhân sự mới'}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {isEditMode ? 'Cập nhật thông tin hồ sơ' : 'Đăng ký nhân sự mới vào hệ thống'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-all disabled:opacity-30"
            id="person-modal-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">

          {/* Loại nhân sự — only in create mode */}
          {!isEditMode && (
            <Field label="Loại nhân sự" required>
              <div className="grid grid-cols-2 gap-2">
                {PERSON_TYPES.map(({ value, label, description }) => (
                  <button
                    key={value}
                    type="button"
                    id={`person-type-btn-${value}`}
                    onClick={() => set('type', value)}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                      formData.type === value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold">{label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{description}</span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {/* Họ và tên */}
          <Field label="Họ và tên" required error={errors.displayName}>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                ref={nameInputRef}
                id="person-form-name"
                type="text"
                value={formData.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                placeholder="Nguyễn Văn A"
                className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border ${
                  errors.displayName
                    ? 'border-rose-400 focus:ring-rose-500/30'
                    : 'border-slate-200 dark:border-slate-700 focus:border-violet-500 dark:focus:border-violet-500'
                } bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-violet-500/20 transition-all`}
              />
            </div>
          </Field>

          {/* Email */}
          <Field label="Email" error={errors.email}>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                id="person-form-email"
                type="email"
                value={formData.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="example@bellaland.vn"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:border-violet-500 dark:focus:border-violet-500 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
          </Field>

          {/* Số điện thoại */}
          <Field label="Số điện thoại">
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                id="person-form-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="0901 234 567"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:border-violet-500 dark:focus:border-violet-500 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>
          </Field>

          {/* Chi nhánh */}
          <Field label="Chi nhánh">
            <PremiumSelect
              options={BRANCHES.map(b => ({ value: b, label: b }))}
              value={formData.branch}
              onChange={val => set('branch', val)}
              buttonClassName="w-full py-2.5 px-3.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:border-violet-500 dark:focus:border-violet-500 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white"
            />
          </Field>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">{submitError}</p>
            </div>
          )}

          {/* Success message */}
          {showSuccess && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {isEditMode ? 'Đã cập nhật hồ sơ thành công!' : 'Đã đăng ký nhân sự mới thành công!'}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-40"
              id="person-form-cancel-btn"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || showSuccess}
              className="flex-[2] py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:from-violet-500 hover:to-indigo-500 focus:ring-2 focus:ring-violet-500/40 shadow-md hover:shadow-violet-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              id="person-form-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <span>{isEditMode ? 'Lưu thay đổi' : 'Thêm nhân sự'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
