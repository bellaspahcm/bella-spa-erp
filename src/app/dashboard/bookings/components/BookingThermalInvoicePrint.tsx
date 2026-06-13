'use client';

import { useEffect } from 'react';

export type BookingThermalInvoiceData = {
  invoiceNumber: string;
  printedAt: string;
  brandName: string;
  logoUrl?: string | null;
  customerName: string;
  customerPhone?: string | null;
  cashierName?: string | null;
  bookingNumber: string;
  packageName: string;
  ktvName?: string | null;
  sessionLabel?: string | null;
  originalAmount: number;
  discountAmount: number;
  paidAmount: number;
  amountDue: number;
  paymentMethod: 'VietQR' | 'Tiền mặt' | 'Thẻ' | 'Khác';
  qrUrl?: string | null;
  transferMemo: string;
  isReprint?: boolean;
};

type BookingThermalInvoicePrintProps = {
  invoice: BookingThermalInvoiceData | null;
  onAfterPrint: () => void;
};

const fmtVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function maskPhone(phone?: string | null) {
  const normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.length < 7) return phone || '';
  return `${normalized.slice(0, 3)}${'*'.repeat(Math.max(3, normalized.length - 5))}${normalized.slice(-2)}`;
}

export function BookingThermalInvoicePrint({ invoice, onAfterPrint }: BookingThermalInvoicePrintProps) {
  useEffect(() => {
    if (!invoice) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 180);

    const handleAfterPrint = () => onAfterPrint();
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [invoice, onAfterPrint]);

  if (!invoice) return null;

  return (
    <div className="thermal-invoice-print-root" aria-hidden="true">
      <style>{`
        .thermal-invoice-print-root {
          display: none;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            width: 80mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .thermal-invoice-print-root,
          .thermal-invoice-print-root * {
            visibility: visible !important;
          }

          .thermal-invoice-print-root {
            display: block !important;
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            box-sizing: border-box !important;
            width: 72mm !important;
            max-width: 72mm !important;
            color: #000 !important;
            background: #fff !important;
            font-family: Arial, Helvetica, sans-serif !important;
            overflow: hidden !important;
          }

          .thermal-invoice {
            box-sizing: border-box !important;
            width: 72mm !important;
            max-width: 72mm !important;
            padding: 3mm 2mm 5mm !important;
            font-size: 9.5px;
            line-height: 1.32;
            overflow: hidden !important;
          }

          .thermal-invoice__center {
            text-align: center;
          }

          .thermal-invoice__logo {
            display: block;
            width: auto;
            max-width: 32mm;
            max-height: 14mm;
            object-fit: contain;
            margin: 0 auto 2mm;
          }

          .thermal-invoice__brand {
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0;
            overflow-wrap: anywhere;
          }

          .thermal-invoice__title {
            margin-top: 2mm;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .thermal-invoice__reprint {
            margin-top: 1mm;
            font-size: 10px;
            font-weight: 900;
            border: 1px solid #000;
            padding: 1mm;
          }

          .thermal-invoice__rule {
            border-top: 1px dashed #000;
            margin: 3mm 0;
          }

          .thermal-invoice__row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 2mm;
            margin: 1mm 0;
            width: 100%;
            min-width: 0;
          }

          .thermal-invoice__label {
            flex: 0 0 auto;
            font-weight: 700;
          }

          .thermal-invoice__value {
            flex: 1 1 auto;
            min-width: 0;
            max-width: 42mm;
            text-align: right;
            font-weight: 700;
            overflow-wrap: anywhere;
            word-break: break-word;
          }

          .thermal-invoice__item {
            margin: 2mm 0;
          }

          .thermal-invoice__item-name {
            font-weight: 900;
            overflow-wrap: anywhere;
          }

          .thermal-invoice__muted {
            font-size: 9px;
            overflow-wrap: anywhere;
          }

          .thermal-invoice__total {
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .thermal-invoice__total span:first-child {
            flex: 0 1 auto;
            min-width: 0;
          }

          .thermal-invoice__total .thermal-invoice__value {
            max-width: 36mm;
            font-size: 13px;
          }

          .thermal-invoice__qr {
            display: block;
            width: 42mm;
            height: 42mm;
            object-fit: contain;
            margin: 3mm auto 1.5mm;
            image-rendering: pixelated;
          }

          .thermal-invoice__memo {
            margin-top: 1mm;
            font-size: 10px;
            font-weight: 900;
            word-break: break-word;
          }

          .thermal-invoice__thanks {
            margin-top: 3mm;
            font-weight: 900;
          }
        }
      `}</style>

      <section className="thermal-invoice">
        <div className="thermal-invoice__center">
          {invoice.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- The print document must render tenant-provided logos directly.
            <img className="thermal-invoice__logo" src={invoice.logoUrl} alt="" />
          )}
          <div className="thermal-invoice__brand">{invoice.brandName}</div>
          <div className="thermal-invoice__title">
            {invoice.amountDue > 0 ? 'Phiếu thanh toán' : 'Hóa đơn thanh toán'}
          </div>
          {invoice.isReprint && <div className="thermal-invoice__reprint">HÓA ĐƠN IN LẠI</div>}
        </div>

        <div className="thermal-invoice__rule" />

        <div className="thermal-invoice__row">
          <span className="thermal-invoice__label">Số phiếu</span>
          <span className="thermal-invoice__value">{invoice.invoiceNumber}</span>
        </div>
        <div className="thermal-invoice__row">
          <span className="thermal-invoice__label">Booking</span>
          <span className="thermal-invoice__value">{invoice.bookingNumber}</span>
        </div>
        <div className="thermal-invoice__row">
          <span className="thermal-invoice__label">Ngày in</span>
          <span className="thermal-invoice__value">{invoice.printedAt}</span>
        </div>
        {invoice.cashierName && (
          <div className="thermal-invoice__row">
            <span className="thermal-invoice__label">Thu ngân</span>
            <span className="thermal-invoice__value">{invoice.cashierName}</span>
          </div>
        )}

        <div className="thermal-invoice__rule" />

        <div className="thermal-invoice__row">
          <span className="thermal-invoice__label">Khách hàng</span>
          <span className="thermal-invoice__value">{invoice.customerName}</span>
        </div>
        {invoice.customerPhone && (
          <div className="thermal-invoice__row">
            <span className="thermal-invoice__label">SĐT</span>
            <span className="thermal-invoice__value">{maskPhone(invoice.customerPhone)}</span>
          </div>
        )}

        <div className="thermal-invoice__rule" />

        <div className="thermal-invoice__item">
          <div className="thermal-invoice__item-name">{invoice.packageName}</div>
          <div className="thermal-invoice__muted">
            {invoice.sessionLabel || 'Dịch vụ'}{invoice.ktvName ? ` - KTV: ${invoice.ktvName}` : ''}
          </div>
        </div>

        <div className="thermal-invoice__rule" />

        <div className="thermal-invoice__row">
          <span>Tổng tiền dịch vụ</span>
          <span className="thermal-invoice__value">{fmtVND(invoice.originalAmount)}</span>
        </div>
        <div className="thermal-invoice__row">
          <span>Giảm giá</span>
          <span className="thermal-invoice__value">-{fmtVND(invoice.discountAmount)}</span>
        </div>
        <div className="thermal-invoice__row">
          <span>Đã thanh toán</span>
          <span className="thermal-invoice__value">{fmtVND(invoice.paidAmount)}</span>
        </div>
        <div className="thermal-invoice__row thermal-invoice__total">
          <span>Còn thanh toán</span>
          <span className="thermal-invoice__value">{fmtVND(invoice.amountDue)}</span>
        </div>
        <div className="thermal-invoice__row">
          <span>Phương thức</span>
          <span className="thermal-invoice__value">{invoice.paymentMethod}</span>
        </div>

        {invoice.qrUrl && invoice.amountDue > 0 && (
          <>
            <div className="thermal-invoice__rule" />
            <div className="thermal-invoice__center">
              {/* eslint-disable-next-line @next/next/no-img-element -- External VietQR image must render directly in the browser print document. */}
              <img className="thermal-invoice__qr" src={invoice.qrUrl} alt="VietQR" />
              <div className="thermal-invoice__muted">Quét mã để chuyển khoản</div>
              <div className="thermal-invoice__memo">{invoice.transferMemo}</div>
            </div>
          </>
        )}

        <div className="thermal-invoice__rule" />
        <div className="thermal-invoice__center thermal-invoice__thanks">
          {invoice.brandName} cảm ơn quý khách!
        </div>
      </section>
    </div>
  );
}
