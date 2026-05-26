"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getAccountingMode, syncLegacyToLedger, updateAccountingMode } from "@/services/accounting-actions";

export default function AccountingConfigTab() {
  const [mode, setMode] = useState<"SIMPLE" | "PROFESSIONAL">("SIMPLE");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function loadMode() {
      try {
        const currentMode = await getAccountingMode();
        setMode(currentMode);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    loadMode();
  }, []);

  const handleSync = async () => {
    if (!confirm("Bạn có chắc chắn muốn đồng bộ toàn bộ dữ liệu lịch sử vào Sổ cái Kế toán? Thao tác này sẽ mất vài phút và không thể hoàn tác.")) return;
    
    setIsSyncing(true);
    try {
      const result = await syncLegacyToLedger();
      if (result.success) {
        toast.success(`Đồng bộ thành công! Đã hạch toán ${result.syncedRevenueCount} doanh thu, ${result.syncedExpenseCount} chi phí, ${result.syncedSalaryCount} bảng lương.`);
        setMode("PROFESSIONAL");
      }
    } catch (error: any) {
      toast.error(error.message || "Đã xảy ra lỗi trong quá trình đồng bộ.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleMode = async (newMode: "SIMPLE" | "PROFESSIONAL") => {
    setIsUpdating(true);
    try {
      await updateAccountingMode(newMode);
      setMode(newMode);
      toast.success(`Đã chuyển đổi sang chế độ Kế toán ${newMode === "PROFESSIONAL" ? "Sổ cái (Professional)" : "Đơn giản (Simple)"}.`);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi chuyển đổi chế độ.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-bold">Đang tải cấu hình...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hệ thống Kế toán Song song</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Chuyển đổi giữa Kế toán Thu/Chi Đơn giản (Simple Finance) và Kế toán Sổ cái (Professional Core)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Simple Mode */}
        <div
          className={`relative p-8 rounded-3xl border-2 transition-all ${
            mode === "SIMPLE"
              ? "border-primary bg-primary/5 shadow-lg shadow-pink-100"
              : "border-slate-100 bg-white hover:border-pink-200"
          }`}
        >
          {mode === "SIMPLE" && (
            <div className="absolute top-4 right-4 text-primary flex items-center gap-1 font-black text-xs uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> Đang kích hoạt
            </div>
          )}
          <h3 className="text-xl font-bold mb-2">Simple Finance</h3>
          <p className="text-muted-foreground font-medium text-sm mb-6">
            Phù hợp cho chi nhánh nhỏ, chỉ ghi nhận Thu (Doanh thu) và Chi (Chi phí) cơ bản. Không có hạch toán bút toán kép.
          </p>
          <button
            onClick={() => handleToggleMode("SIMPLE")}
            disabled={mode === "SIMPLE" || isUpdating || isSyncing}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              mode === "SIMPLE"
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover active:scale-95 shadow-md shadow-pink-200"
            }`}
          >
            {isUpdating && mode !== "SIMPLE" ? "Đang chuyển..." : "Chuyển sang Simple"}
          </button>
        </div>

        {/* Professional Mode */}
        <div
          className={`relative p-8 rounded-3xl border-2 transition-all ${
            mode === "PROFESSIONAL"
              ? "border-primary bg-primary/5 shadow-lg shadow-pink-100"
              : "border-slate-100 bg-white hover:border-pink-200"
          }`}
        >
          {mode === "PROFESSIONAL" && (
            <div className="absolute top-4 right-4 text-primary flex items-center gap-1 font-black text-xs uppercase tracking-wider bg-white px-3 py-1 rounded-full shadow-sm">
              <CheckCircle2 className="w-4 h-4" /> Đang kích hoạt
            </div>
          )}
          <h3 className="text-xl font-bold mb-2">Professional Core</h3>
          <p className="text-muted-foreground font-medium text-sm mb-6">
            Hệ thống kế toán Sổ cái (Ledger) với bút toán kép chuẩn TT133. Tự động hạch toán doanh thu, chi phí, lương.
          </p>
          <button
            onClick={() => handleToggleMode("PROFESSIONAL")}
            disabled={mode === "PROFESSIONAL" || isUpdating || isSyncing}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              mode === "PROFESSIONAL"
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover active:scale-95 shadow-md shadow-pink-200"
            }`}
          >
            {isUpdating && mode !== "PROFESSIONAL" ? "Đang chuyển..." : "Chuyển sang Professional"}
          </button>
        </div>
      </div>

      {/* Sync Legacy Data Section */}
      <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-amber-900 mb-2">Đồng bộ Dữ liệu Lịch sử (Sync to Ledger)</h4>
            <p className="text-amber-800/80 text-sm font-medium mb-4">
              Nếu bạn vừa nâng cấp lên hệ thống Kế toán Sổ cái (Professional Core), hãy nhấn nút bên dưới để tự động hạch toán toàn bộ dữ liệu Thu/Chi/Lương cũ vào sổ cái. Quá trình này hoàn toàn an toàn (Idempotent) và sẽ không tạo ra các bút toán trùng lặp.
            </p>
            <button
              onClick={handleSync}
              disabled={isSyncing || isUpdating}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Đang đồng bộ dữ liệu..." : "Chạy đồng bộ Sổ cái ngay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
