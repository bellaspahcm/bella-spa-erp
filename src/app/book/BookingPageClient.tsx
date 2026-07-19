'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  submitOnlineBooking,
  type OnlineBookingFormData,
} from '@/core/services/order';

/* =========================================================
   Types
   ========================================================= */
interface Package {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  total_sessions?: number | null;
  category?: string | null;
}

interface BookingPageClientProps {
  packages: Package[];
  tenantPhone?: string | null;
  packageLoadError?: string | null;
}

/* =========================================================
   Helpers
   ========================================================= */
function isPregnancyPackage(pkg?: Package | null) {
  if (!pkg) return false;
  const name = pkg.name?.toLowerCase() ?? '';
  const cat = (pkg.category ?? '').toLowerCase();
  return (
    name.includes('bầu') ||
    name.includes('thai') ||
    name.includes('mang thai') ||
    cat.includes('bầu') ||
    cat.includes('thai')
  );
}

function isBabyPackage(pkg?: Package | null) {
  if (!pkg) return false;
  const name = pkg.name?.toLowerCase() ?? '';
  const cat = (pkg.category ?? '').toLowerCase();
  return (
    name.includes('bé') ||
    name.includes('baby') ||
    name.includes('trẻ em') ||
    name.includes('tắm bé') ||
    cat.includes('bé') ||
    cat.includes('baby')
  );
}

function formatPrice(price?: number | null) {
  if (!price) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

/* =========================================================
   Field Component
   ========================================================= */
function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold" style={{ color: '#0F172A' }}>
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs" style={{ color: '#64748B' }}>{hint}</p>}
    </div>
  );
}

/* =========================================================
   Input Component
   ========================================================= */
const inputCls =
  'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all duration-200 bg-white/80 placeholder:text-slate-400 focus:ring-2';
const inputStyle = {
  borderColor: '#FCE4EC',
  color: '#0F172A',
};

/* =========================================================
   Package Card
   ========================================================= */
function PackageCard({
  pkg,
  selected,
  onClick,
}: {
  pkg: Package;
  selected: boolean;
  onClick: () => void;
}) {
  const isPregant = isPregnancyPackage(pkg);
  const isBaby = isBabyPackage(pkg);
  const icon = isPregant ? '🤰' : isBaby ? '👶' : '🌸';

  return (
    <button
      type="button"
      onClick={onClick}
      id={`pkg-${pkg.id}`}
      className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer group relative overflow-hidden"
      style={{
        borderColor: selected ? '#9D174D' : '#FCE4EC',
        background: selected
          ? 'linear-gradient(135deg, #9D174D 0%, #BE185D 100%)'
          : 'rgba(255,255,255,0.9)',
        boxShadow: selected
          ? '0 8px 24px -4px rgba(157,23,77,0.35)'
          : '0 2px 8px -1px rgba(0,0,0,0.04)',
        transform: selected ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      {/* Glow when selected */}
      {selected && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(255,255,255,0.4) 0%, transparent 60%)',
          }}
        />
      )}
      <div className="relative z-10">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-sm leading-snug"
              style={{ color: selected ? '#fff' : '#0F172A' }}
            >
              {pkg.name}
            </p>
            {pkg.description && (
              <p
                className="text-xs mt-0.5 leading-relaxed line-clamp-2"
                style={{ color: selected ? 'rgba(255,255,255,0.8)' : '#64748B' }}
              >
                {pkg.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {formatPrice(pkg.price) ? (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                background: selected ? 'rgba(255,255,255,0.2)' : 'rgba(157,23,77,0.08)',
                color: selected ? '#fff' : '#9D174D',
              }}
            >
              {formatPrice(pkg.price)}
            </span>
          ) : (
            <span
              className="text-xs font-medium"
              style={{ color: selected ? 'rgba(255,255,255,0.7)' : '#94A3B8' }}
            >
              Tư vấn giá
            </span>
          )}
          {pkg.total_sessions && (
            <span
              className="text-xs"
              style={{ color: selected ? 'rgba(255,255,255,0.7)' : '#94A3B8' }}
            >
              {pkg.total_sessions} buổi
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* =========================================================
   Success Screen
   ========================================================= */
function SuccessScreen({ bookingNumber, tenantPhone }: { bookingNumber: string; tenantPhone?: string | null }) {
  const telHref = tenantPhone
    ? `tel:${tenantPhone.replace(/\s/g, '')}`
    : null;
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'linear-gradient(135deg, #FDF2F5 0%, #FFF0F6 100%)' }}>
      <div
        className="w-full max-w-md text-center p-8 rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px -12px rgba(157,23,77,0.18)',
          border: '1px solid rgba(157,23,77,0.1)',
        }}
      >
        {/* Animated checkmark */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #9D174D 0%, #BE185D 100%)' }}
        >
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: '#9D174D', fontFamily: 'var(--font-serif), Georgia, serif' }}>
          Đặt lịch thành công! 🎉
        </h1>
        <p className="text-sm mb-4" style={{ color: '#64748B' }}>
          Cảm ơn bạn đã tin tưởng. Đội ngũ của chúng tôi sẽ liên hệ xác nhận lịch hẹn trong thời gian sớm nhất.
        </p>

        <div
          className="p-4 rounded-2xl mb-6"
          style={{ background: 'rgba(157,23,77,0.06)', border: '1px dashed rgba(157,23,77,0.2)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#9D174D' }}>Mã đặt lịch của bạn</p>
          <p className="text-lg font-mono font-bold" style={{ color: '#0F172A' }}>{bookingNumber}</p>
        </div>

        <p className="text-xs mb-6" style={{ color: '#94A3B8' }}>
          Vui lòng lưu lại mã này để tiện liên hệ với chúng tôi.
        </p>

        {telHref ? (
          <a
            href={telHref}
            className="block w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all duration-200 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #9D174D 0%, #BE185D 100%)' }}
          >
            📞 Gọi hotline {tenantPhone} để xác nhận
          </a>
        ) : (
          <p className="text-sm" style={{ color: '#64748B' }}>Đội ngũ sẽ chủ động liên hệ xác nhận với bạn.</p>
        )}

        <Link href="/" className="block mt-3 text-sm font-medium" style={{ color: '#9D174D' }}>
          Quay về trang chủ →
        </Link>
      </div>
    </div>
  );
}

/* =========================================================
   Main Component
   ========================================================= */
export default function BookingPageClient({ packages, tenantPhone = null, packageLoadError = null }: BookingPageClientProps) {
  const [isPending, startTransition] = useTransition();
  const [successBookingNumber, setSuccessBookingNumber] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);

  // Scroll to error
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorMsg && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errorMsg]);

  const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? null;
  const showBirthDate = isPregnancyPackage(selectedPackage);
  const showBabyDob = isBabyPackage(selectedPackage);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    const fd = new FormData(e.currentTarget);

    const formData: OnlineBookingFormData = {
      name_mother: (fd.get('name_mother') as string) ?? '',
      phone: (fd.get('phone') as string) ?? '',
      address: (fd.get('address') as string) || undefined,
      package_id: selectedPackageId || undefined,
      package_name: selectedPackage?.name || undefined,
      expected_birth_date: showBirthDate ? ((fd.get('expected_birth_date') as string) || undefined) : undefined,
      dob_baby: showBabyDob ? ((fd.get('dob_baby') as string) || undefined) : undefined,
      name_baby: showBabyDob ? ((fd.get('name_baby') as string) || undefined) : undefined,
      start_date: (fd.get('start_date') as string) ?? '',
      preferred_time: (fd.get('preferred_time') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
    };

    startTransition(async () => {
      const result = await submitOnlineBooking(formData);
      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.success && result.bookingNumber) {
        setSuccessBookingNumber(result.bookingNumber);
        formRef.current?.reset();
        setSelectedPackageId('');
      }
    });
  }

  if (successBookingNumber) {
    return <SuccessScreen bookingNumber={successBookingNumber} tenantPhone={tenantPhone} />;
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(160deg, #FDF2F5 0%, #FFF6F9 40%, #F0F7FF 100%)',
      }}
    >
      {/* === HERO HEADER === */}
      <header className="relative overflow-hidden">
        {/* Background blobs */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, #9D174D 0%, #BE185D 60%, #C026D3 100%)',
          }}
        />
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #FF69B4 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #F0ABFC 0%, transparent 70%)',
            transform: 'translate(-30%, 30%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 text-center">
          {/* Logo / Brand */}
          <div className="mb-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-4"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}
            >
              <span>🌸</span>
              <span>Bella Spa Mẹ &amp; Bé</span>
            </div>
          </div>

          <h1
            className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight"
            style={{ fontFamily: 'var(--font-serif), Georgia, serif', textShadow: '0 2px 16px rgba(0,0,0,0.15)' }}
          >
            Đặt Lịch Hẹn
            <br />
            <span className="italic font-light opacity-90">Chăm Sóc Trọn Yêu Thương</span>
          </h1>

          <p className="text-white/80 text-sm leading-relaxed max-w-sm mx-auto">
            Điền thông tin bên dưới để đặt lịch. Đội ngũ Bella Spa sẽ xác nhận lịch hẹn với bạn qua điện thoại trong vòng 30 phút.
          </p>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
            {[
              { icon: '⭐', text: 'Kỹ thuật viên 5 sao' },
              { icon: '🏥', text: 'Chuẩn y khoa' },
              { icon: '💝', text: 'Tận tâm từng buổi' },
            ].map((b) => (
              <div
                key={b.text}
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                <span>{b.icon}</span>
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* === FORM CARD === */}
      <main className="relative max-w-2xl mx-auto px-4 pb-16" style={{ marginTop: '-24px' }}>
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 80px -16px rgba(157,23,77,0.15), 0 8px 24px -4px rgba(0,0,0,0.06)',
            border: '1px solid rgba(255,255,255,0.8)',
          }}
        >
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {/* ---- SECTION: Package Selection ---- */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #9D174D, #BE185D)' }}
                >
                  1
                </div>
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Chọn gói dịch vụ</h2>
                  <p className="text-xs" style={{ color: '#64748B' }}>Không bắt buộc — bạn có thể bỏ qua và tư vấn sau</p>
                </div>
              </div>

              {packageLoadError && (
                <div
                  className="mb-4 rounded-2xl border px-4 py-3 text-sm"
                  style={{ background: '#FFF1F2', borderColor: '#FECDD3', color: '#9F1239' }}
                >
                  {packageLoadError}
                </div>
              )}

              {packages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* "No package" option */}
                  <button
                    type="button"
                    onClick={() => setSelectedPackageId('')}
                    id="pkg-none"
                    className="w-full text-left p-4 rounded-2xl border-2 transition-all duration-200"
                    style={{
                      borderColor: selectedPackageId === '' ? '#9D174D' : '#FCE4EC',
                      background: selectedPackageId === '' ? 'rgba(157,23,77,0.06)' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">✨</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: selectedPackageId === '' ? '#9D174D' : '#0F172A' }}>
                          Tư vấn gói phù hợp
                        </p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>Nhân viên sẽ hỗ trợ tư vấn</p>
                      </div>
                    </div>
                  </button>

                  {packages.map((pkg) => (
                    <PackageCard
                      key={pkg.id}
                      pkg={pkg}
                      selected={selectedPackageId === pkg.id}
                      onClick={() =>
                        setSelectedPackageId(selectedPackageId === pkg.id ? '' : pkg.id)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="text-center py-8 rounded-2xl"
                  style={{ background: 'rgba(157,23,77,0.04)', border: '1px dashed rgba(157,23,77,0.15)' }}
                >
                  <p className="text-sm" style={{ color: '#94A3B8' }}>
                    Danh sách gói dịch vụ sẽ được tư vấn qua điện thoại
                  </p>
                </div>
              )}
            </div>

            {/* ---- Divider ---- */}
            <div className="mx-6 sm:mx-8 border-t" style={{ borderColor: '#FCE4EC' }} />

            {/* ---- SECTION: Personal Info ---- */}
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #9D174D, #BE185D)' }}
                >
                  2
                </div>
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Thông tin của bạn</h2>
                  <p className="text-xs" style={{ color: '#64748B' }}>Để chúng tôi xác nhận lịch hẹn</p>
                </div>
              </div>

              <Field label="Họ và tên mẹ" required>
                <input
                  id="name_mother"
                  name="name_mother"
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Thị Hoa"
                  className={inputCls}
                  style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                />
              </Field>

              <Field label="Số điện thoại" required hint="Chúng tôi sẽ liên hệ qua số này để xác nhận lịch">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="Ví dụ: 0912 345 678"
                  className={inputCls}
                  style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                />
              </Field>

              <Field label="Địa chỉ" hint="Tỉnh/thành phố hoặc khu vực của bạn">
                <input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="Ví dụ: Quận 7, TP. Hồ Chí Minh"
                  className={inputCls}
                  style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                />
              </Field>

              {/* Conditional: Pregnancy package */}
              {showBirthDate && (
                <div
                  className="p-4 rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(157,23,77,0.04) 0%, rgba(190,24,93,0.06) 100%)',
                    border: '1px solid rgba(157,23,77,0.12)',
                  }}
                >
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#9D174D' }}>
                    🤰 Thông tin thai kỳ
                  </p>
                  <Field label="Ngày dự sinh (dự kiến)">
                    <input
                      id="expected_birth_date"
                      name="expected_birth_date"
                      type="date"
                      className={inputCls}
                      style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                      min={today}
                    />
                  </Field>
                </div>
              )}

              {/* Conditional: Baby package */}
              {showBabyDob && (
                <div
                  className="p-4 rounded-2xl space-y-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.05) 0%, rgba(196,181,253,0.08) 100%)',
                    border: '1px solid rgba(167,139,250,0.15)',
                  }}
                >
                  <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#7C3AED' }}>
                    👶 Thông tin bé
                  </p>
                  <Field label="Tên bé">
                    <input
                      id="name_baby"
                      name="name_baby"
                      type="text"
                      placeholder="Tên hoặc nickname của bé"
                      className={inputCls}
                      style={{ ...inputStyle, '--tw-ring-color': '#7C3AED' } as React.CSSProperties}
                    />
                  </Field>
                  <Field label="Ngày sinh của bé">
                    <input
                      id="dob_baby"
                      name="dob_baby"
                      type="date"
                      className={inputCls}
                      style={{ ...inputStyle, '--tw-ring-color': '#7C3AED' } as React.CSSProperties}
                      max={today}
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* ---- Divider ---- */}
            <div className="mx-6 sm:mx-8 border-t" style={{ borderColor: '#FCE4EC' }} />

            {/* ---- SECTION: Schedule ---- */}
            <div className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #9D174D, #BE185D)' }}
                >
                  3
                </div>
                <div>
                  <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Thời gian mong muốn</h2>
                  <p className="text-xs" style={{ color: '#64748B' }}>Chúng tôi sẽ cố gắng sắp xếp phù hợp</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Ngày bắt đầu" required>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    required
                    className={inputCls}
                    style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                    min={today}
                  />
                </Field>

                <Field label="Khung giờ yêu thích">
                  <select
                    id="preferred_time"
                    name="preferred_time"
                    className={inputCls}
                    style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                  >
                    <option value="">-- Linh hoạt --</option>
                    <option value="08:00">08:00 – Sáng sớm</option>
                    <option value="09:00">09:00 – Buổi sáng</option>
                    <option value="10:00">10:00 – Giữa sáng</option>
                    <option value="13:00">13:00 – Đầu chiều</option>
                    <option value="14:00">14:00 – Giữa chiều</option>
                    <option value="15:00">15:00 – Cuối chiều</option>
                    <option value="16:00">16:00 – Chiều muộn</option>
                  </select>
                </Field>
              </div>

              <Field label="Ghi chú thêm">
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Tình trạng sức khỏe đặc biệt, yêu cầu riêng, câu hỏi muốn tư vấn..."
                  className={`${inputCls} resize-none`}
                  style={{ ...inputStyle, '--tw-ring-color': '#9D174D' } as React.CSSProperties}
                />
              </Field>
            </div>

            {/* ---- Error Message ---- */}
            {errorMsg && (
              <div ref={errorRef} className="mx-6 sm:mx-8 mb-4">
                <div
                  className="p-4 rounded-2xl flex items-start gap-3"
                  style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  <span className="text-lg flex-shrink-0">⚠️</span>
                  <p className="text-sm font-medium text-red-700">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* ---- SUBMIT BUTTON ---- */}
            <div className="px-6 sm:px-8 pb-8">
              <button
                id="btn-submit-booking"
                type="submit"
                disabled={isPending}
                className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all duration-300 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: isPending
                    ? '#CBD5E1'
                    : 'linear-gradient(135deg, #9D174D 0%, #BE185D 50%, #C026D3 100%)',
                  boxShadow: isPending
                    ? 'none'
                    : '0 12px 32px -6px rgba(157,23,77,0.4)',
                }}
              >
                {!isPending && (
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background:
                        'linear-gradient(135deg, #831843 0%, #9D174D 50%, #A21CAF 100%)',
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isPending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <span>🌸</span>
                      <span>Xác nhận đặt lịch ngay</span>
                      <span>→</span>
                    </>
                  )}
                </span>
              </button>

              {/* Privacy note */}
              <p className="text-center text-xs mt-4 leading-relaxed" style={{ color: '#94A3B8' }}>
                🔒 Thông tin cá nhân của bạn được bảo mật tuyệt đối và chỉ sử dụng để xác nhận lịch hẹn.
                Chúng tôi cam kết không chia sẻ với bất kỳ bên thứ ba nào.
              </p>
            </div>
          </form>
        </div>

        {/* ---- Contact Info ---- */}
        <div className="mt-6 text-center">
          <p className="text-sm font-semibold mb-3" style={{ color: '#0F172A' }}>
            Hoặc liên hệ trực tiếp với chúng tôi
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {tenantPhone && (
              <a
                href={`tel:${tenantPhone.replace(/\s/g, '')}`}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 hover:opacity-80"
                style={{ background: 'rgba(157,23,77,0.08)', color: '#9D174D' }}
              >
                📞 {tenantPhone}
              </a>
            )}
            <a
              href="https://zalo.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 hover:opacity-80"
              style={{ background: 'rgba(0,120,255,0.08)', color: '#0078FF' }}
            >
              💬 Zalo
            </a>
          </div>
        </div>
      </main>

      {/* ---- FOOTER ---- */}
      <footer className="pb-8 text-center">
        <p className="text-xs" style={{ color: '#CBD5E1' }}>
          © {new Date().getFullYear()} Bella Spa Mẹ &amp; Bé · Chăm sóc tận tâm, trao trọn yêu thương
        </p>
      </footer>
    </div>
  );
}
