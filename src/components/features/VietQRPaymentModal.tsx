"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, QrCode, CreditCard, Sparkles, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface TenantBankInfo {
  qr_bank_code?: string;
  qr_account_number?: string;
  qr_account_name?: string;
  name?: string;
}

interface VietQRPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingNumber: string;
  amount: number;
  tenantInfo: TenantBankInfo | null;
}

export default function VietQRPaymentModal({
  isOpen,
  onClose,
  bookingNumber,
  amount,
  tenantInfo,
}: VietQRPaymentModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const bankCode = tenantInfo?.qr_bank_code || "";
  const accountNumber = tenantInfo?.qr_account_number || "";
  const accountName = tenantInfo?.qr_account_name || "";
  const spaName = tenantInfo?.name || "Bella Spa";

  const transferMemo = `BELLA ${bookingNumber}`;
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountName)}`;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Đã sao chép ${field}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const hasConfiguredBank = bankCode && accountNumber;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 relative z-10 shadow-2xl border border-pink-100/50 max-h-[90vh] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-all active:scale-95 border border-slate-100"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">
                Thanh toán VietQR động
              </h3>
              <p className="text-xs text-muted-foreground font-semibold">
                Quét mã QR để tự động gạch nợ tức thì
              </p>
            </div>
          </div>

          {!hasConfiguredBank ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-100">
                <X className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Spa chưa cấu hình ngân hàng</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Vui lòng truy cập trang <strong>Cài đặt &gt; Cấu hình chung</strong> để thiết lập tài khoản nhận tiền ngân hàng trước khi sử dụng VietQR động.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                {/* QR Display */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100/60 p-6 rounded-[2rem] relative">
                  <div className="w-[180px] h-[180px] bg-white rounded-3xl p-3 border border-pink-50 flex items-center justify-center shadow-lg shadow-pink-50/30 dark:shadow-none overflow-hidden relative group">
                    <img
                      src={qrUrl}
                      alt="VietQR Code"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                      <QrCode className="w-10 h-10 text-primary/30 animate-pulse" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-rose-500 bg-rose-50 border border-rose-100/50 px-3 py-1.5 rounded-full uppercase tracking-wider animate-pulse">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                    Chờ chuyển khoản...
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Số tiền cần thu
                    </span>
                    <span className="text-2xl font-black text-primary block leading-none">
                      {formatCurrency(amount)}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                          Ngân hàng
                        </span>
                        <strong className="text-slate-800 font-extrabold">{bankCode}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-200/40 pt-2.5">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                          Số tài khoản
                        </span>
                        <strong className="text-slate-800 font-extrabold tracking-wide">
                          {accountNumber}
                        </strong>
                      </div>
                      <button
                        onClick={() => handleCopy(accountNumber, "số tài khoản")}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-all active:scale-90"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-200/40 pt-2.5">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                          Chủ tài khoản
                        </span>
                        <strong className="text-slate-800 font-extrabold">{accountName}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-200/40 pt-2.5 bg-rose-50/50 p-2 rounded-xl border border-rose-100/30">
                      <div>
                        <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest block">
                          Nội dung chuyển khoản
                        </span>
                        <strong className="text-rose-500 font-black tracking-widest">
                          {transferMemo}
                        </strong>
                      </div>
                      <button
                        onClick={() => handleCopy(transferMemo, "nội dung chuyển khoản")}
                        className="p-1.5 hover:bg-rose-100 rounded text-rose-500 transition-all active:scale-90"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-2 text-[10px] text-slate-500 font-semibold leading-relaxed">
                <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                <span>
                  Admin có thể sao chép số tài khoản và nội dung gửi cho khách qua Zalo nếu khách thanh toán từ xa. Hệ thống đối soát Casso/SePay/PayOS sẽ tự động nhận diện nội dung <strong>{transferMemo}</strong> để khớp lịch hẹn.
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
