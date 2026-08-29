"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Save,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAccountingSemanticConfig,
  getAccountingMode,
  getLegacyLedgerSyncPreview,
  getProfessionalModeReadinessGate,
  saveAccountingSemanticMapping,
  syncLegacyToLedger,
  updateAccountingMode,
} from "@/services/accounting-actions";
import type {
  AccountingSemanticConfigSnapshot,
  AccountingSemanticKey,
  LegacyLedgerSyncPreview,
  ProfessionalModeReadinessGate,
} from "@/services/accounting-actions";
import { getAccountingErrorMessage as getErrorMessage } from "@/lib/accounting-error-message";

type AccountingMode = "SIMPLE" | "PROFESSIONAL";
const EMPTY_SYNC_PREVIEW: LegacyLedgerSyncPreview = {
  pending_revenue_count: 0,
  pending_expense_count: 0,
  pending_salary_count: 0,
  journal_entries_to_create: 0,
  revenue_amount: 0,
  expense_amount: 0,
  salary_amount: 0,
};
const EMPTY_SEMANTIC_CONFIG: AccountingSemanticConfigSnapshot = {
  semantics: [],
  accountOptions: [],
  mappings: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AccountingConfigTab() {
  const [mode, setMode] = useState<AccountingMode>("SIMPLE");
  const [readinessGate, setReadinessGate] = useState<ProfessionalModeReadinessGate | null>(null);
  const [syncPreview, setSyncPreview] = useState<LegacyLedgerSyncPreview>(EMPTY_SYNC_PREVIEW);
  const [semanticConfig, setSemanticConfig] = useState<AccountingSemanticConfigSnapshot>(EMPTY_SEMANTIC_CONFIG);
  const [draftMappings, setDraftMappings] = useState<Record<AccountingSemanticKey, { account_code: string; effective_from: string }>>({
    SERVICE_REVENUE: { account_code: "", effective_from: "2026-01-01" },
    REVENUE_DEDUCTION: { account_code: "", effective_from: "2026-01-01" },
    GOODS_REVENUE: { account_code: "", effective_from: "2026-01-01" },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [savingSemantic, setSavingSemantic] = useState<AccountingSemanticKey | null>(null);

  async function refreshConfig() {
    const [currentMode, gate, preview, semanticSnapshot] = await Promise.all([
      getAccountingMode(),
      getProfessionalModeReadinessGate(),
      getLegacyLedgerSyncPreview(),
      getAccountingSemanticConfig(),
    ]);
    setMode(currentMode);
    setReadinessGate(gate);
    setSyncPreview(preview);
    setSemanticConfig(semanticSnapshot);
    setDraftMappings((current) => {
      const next = { ...current };
      for (const definition of semanticSnapshot.semantics) {
        const activeMapping = semanticSnapshot.mappings.find(
          (mapping) => mapping.semantic_key === definition.key && mapping.effective_to === null
        ) ?? semanticSnapshot.mappings.find((mapping) => mapping.semantic_key === definition.key);
        next[definition.key] = {
          account_code: activeMapping?.account_code ?? current[definition.key]?.account_code ?? "",
          effective_from: activeMapping?.effective_from ?? current[definition.key]?.effective_from ?? new Date().toISOString().slice(0, 10),
        };
      }
      return next;
    });
  }

  useEffect(() => {
    async function loadConfig() {
      try {
        await refreshConfig();
      } catch (error) {
        toast.error(getErrorMessage(error, "Không tải được cấu hình kế toán."));
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSync = async () => {
    const message = [
      "Bạn có chắc chắn muốn đồng bộ dữ liệu lịch sử vào Sổ cái và bật Professional Core?",
      "",
      `Dự kiến tạo ${syncPreview.journal_entries_to_create} bút toán:`,
      `- ${syncPreview.pending_revenue_count} dòng doanh thu (${formatCurrency(syncPreview.revenue_amount)})`,
      `- ${syncPreview.pending_expense_count} dòng chi phí (${formatCurrency(syncPreview.expense_amount)})`,
      `- ${syncPreview.pending_salary_count} bảng lương (${formatCurrency(syncPreview.salary_amount)})`,
    ].join("\n");
    if (!confirm(message)) return;

    setIsSyncing(true);
    try {
      const result = await syncLegacyToLedger();
      if (!result.success) {
        toast.warning(result.error || "Chưa thể bật Professional Core. Kiểm tra Sẵn sàng dữ liệu trước khi đồng bộ.");
        await refreshConfig();
        return;
      }

      toast.success(`Đồng bộ thành công: ${result.syncedRevenueCount} doanh thu, ${result.syncedExpenseCount} chi phí, ${result.syncedSalaryCount} bảng lương.`);
      await refreshConfig();
    } catch (error) {
      toast.error(getErrorMessage(error, "Đã xảy ra lỗi trong quá trình đồng bộ."));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleMode = async (newMode: AccountingMode) => {
    setIsUpdating(true);
    try {
      const result = await updateAccountingMode(newMode);
      if (!result.success) {
        toast.warning(result.error || "Chưa thể bật Professional Core. Kiểm tra Sẵn sàng dữ liệu trước khi chuyển chế độ.");
        await refreshConfig();
        return;
      }
      await refreshConfig();
      toast.success(`Đã chuyển sang chế độ ${newMode === "PROFESSIONAL" ? "Professional Core" : "Simple Finance"}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Lỗi khi chuyển đổi chế độ."));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSemanticDraftChange = (
    semanticKey: AccountingSemanticKey,
    field: "account_code" | "effective_from",
    value: string
  ) => {
    setDraftMappings((current) => ({
      ...current,
      [semanticKey]: {
        ...current[semanticKey],
        [field]: value,
      },
    }));
  };

  const handleSaveSemanticMapping = async (semanticKey: AccountingSemanticKey) => {
    const draft = draftMappings[semanticKey];
    if (!draft.account_code) {
      toast.warning("Chọn tài khoản từ COA trước khi lưu.");
      return;
    }

    setSavingSemantic(semanticKey);
    try {
      const result = await saveAccountingSemanticMapping({
        semantic_key: semanticKey,
        account_code: draft.account_code,
        effective_from: draft.effective_from,
      });

      if (!result.success) {
        toast.warning(result.error);
        return;
      }

      toast.success("Đã lưu ánh xạ kế toán.");
      await refreshConfig();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không lưu được ánh xạ kế toán."));
    } finally {
      setSavingSemantic(null);
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

  const professionalReady = Boolean(readinessGate?.can_enable_professional);
  const hasPendingSync = syncPreview.journal_entries_to_create > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Hệ thống Kế toán Song song</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Chuyển đổi giữa Simple Finance và Professional Core theo mức sẵn sàng dữ liệu.
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Cấu hình ánh xạ nghiệp vụ</h3>
              <p className="text-sm font-semibold text-muted-foreground">
                Chọn tài khoản từ COA của doanh nghiệp cho các semantic kế toán đã được chứng minh.
              </p>
            </div>
          </div>
          <a
            href="/dashboard/accounting/chart-of-accounts"
            className="text-sm font-black text-primary hover:underline"
          >
            Mở COA
          </a>
        </div>

        {semanticConfig.accountOptions.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            Chưa có tài khoản GL active trong COA Finance runtime. Hãy tạo tài khoản trước khi cấu hình mapping.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800/70">
              <div className="col-span-12 md:col-span-4">Nghiệp vụ</div>
              <div className="col-span-12 md:col-span-4">Tài khoản</div>
              <div className="col-span-8 md:col-span-2">Hiệu lực</div>
              <div className="col-span-4 md:col-span-2 text-right">Lưu</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {semanticConfig.semantics.map((semantic) => {
                const draft = draftMappings[semantic.key];
                const activeMapping = semanticConfig.mappings.find(
                  (mapping) => mapping.semantic_key === semantic.key && mapping.effective_to === null
                );
                const isSavingThis = savingSemantic === semantic.key;

                return (
                  <div key={semantic.key} className="grid grid-cols-12 gap-3 px-4 py-4">
                    <div className="col-span-12 md:col-span-4">
                      <p className="font-black text-slate-950 dark:text-white">{semantic.label}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{semantic.description}</p>
                      {activeMapping && (
                        <p className="mt-2 text-[11px] font-black text-emerald-700">
                          Đang dùng {activeMapping.account_code} từ {activeMapping.effective_from}
                        </p>
                      )}
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <select
                        value={draft.account_code}
                        onChange={(event) => handleSemanticDraftChange(semantic.key, "account_code", event.target.value)}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      >
                        <option value="">Chọn tài khoản</option>
                        {semanticConfig.accountOptions.map((account) => (
                          <option key={`${semantic.key}-${account.code}`} value={account.code}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-8 md:col-span-2">
                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input
                          type="date"
                          value={draft.effective_from}
                          onChange={(event) => handleSemanticDraftChange(semantic.key, "effective_from", event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="col-span-4 md:col-span-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveSemanticMapping(semantic.key)}
                        disabled={isSavingThis || !draft.account_code}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        title={`Lưu ${semantic.label}`}
                      >
                        <Save className={`h-4 w-4 ${isSavingThis ? "animate-pulse" : ""}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          className={`relative p-8 rounded-3xl border-2 transition-all ${
            mode === "SIMPLE"
              ? "border-primary bg-primary/5 shadow-lg shadow-pink-100 dark:shadow-none"
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
            Dùng cho vận hành thu chi hằng ngày, không yêu cầu admin/lễ tân hiểu đầy đủ bút toán kép.
          </p>
          <button
            onClick={() => handleToggleMode("SIMPLE")}
            disabled={mode === "SIMPLE" || isUpdating || isSyncing}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              mode === "SIMPLE"
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover active:scale-95 shadow-md shadow-pink-200 dark:shadow-none"
            }`}
          >
            {isUpdating && mode !== "SIMPLE" ? "Đang chuyển..." : "Chuyển sang Simple"}
          </button>
        </div>

        <div
          className={`relative p-8 rounded-3xl border-2 transition-all ${
            mode === "PROFESSIONAL"
              ? "border-primary bg-primary/5 shadow-lg shadow-pink-100 dark:shadow-none"
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
            Sổ cái bút toán kép theo chuẩn cấu hình kế toán. Chỉ bật khi dữ liệu nguồn đã qua kiểm tra readiness.
          </p>

          <div className={`mb-6 rounded-2xl border p-4 ${professionalReady ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-black text-sm text-slate-900">
                {professionalReady ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-amber-600" />}
                Readiness {readinessGate?.readiness_score ?? 0}/100
              </div>
              <a
                href="/dashboard/accounting/readiness"
                className="text-xs font-black uppercase tracking-wider text-primary hover:underline"
              >
                Xem chi tiết
              </a>
            </div>
            {readinessGate?.blocking_reasons?.length ? (
              <ul className="mt-3 space-y-2 text-xs font-semibold text-amber-900">
                {readinessGate.blocking_reasons.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs font-semibold text-emerald-800">
                Dữ liệu đã đủ điều kiện bật Professional Core.
              </p>
            )}
          </div>

          <button
            onClick={() => handleToggleMode("PROFESSIONAL")}
            disabled={mode === "PROFESSIONAL" || isUpdating || isSyncing || !professionalReady}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              mode === "PROFESSIONAL" || !professionalReady
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover active:scale-95 shadow-md shadow-pink-200 dark:shadow-none"
            }`}
          >
            {isUpdating && mode !== "PROFESSIONAL" ? "Đang chuyển..." : "Chuyển sang Professional"}
          </button>
        </div>
      </div>

      <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-amber-900 mb-2">Đồng bộ dữ liệu lịch sử vào Sổ cái</h4>
            <p className="text-amber-800/80 text-sm font-medium mb-4">
              Đồng bộ chỉ chạy khi readiness đạt yêu cầu. Nếu còn dòng cần duyệt hoặc lỗi hạch toán, hệ thống sẽ chặn để tránh bật Professional trên dữ liệu chưa chuẩn.
            </p>

            <div className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Bút toán</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.journal_entries_to_create}</p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Doanh thu</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.pending_revenue_count}</p>
                <p className="text-[11px] font-bold text-slate-500">{formatCurrency(syncPreview.revenue_amount)}</p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Chi phí</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.pending_expense_count}</p>
                <p className="text-[11px] font-bold text-slate-500">{formatCurrency(syncPreview.expense_amount)}</p>
              </div>
              <div className="rounded-2xl bg-white/80 border border-amber-100 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-amber-700">Bảng lương</p>
                <p className="text-xl font-black text-slate-900">{syncPreview.pending_salary_count}</p>
                <p className="text-[11px] font-bold text-slate-500">{formatCurrency(syncPreview.salary_amount)}</p>
              </div>
            </div>

            {!hasPendingSync && professionalReady && mode !== "PROFESSIONAL" && (
              <p className="mb-4 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 text-sm font-bold text-emerald-700">
                Không còn dữ liệu lịch sử cần tạo bút toán. Bạn có thể chuyển sang Professional nếu đã kiểm tra báo cáo.
              </p>
            )}

            <button
              onClick={handleSync}
              disabled={isSyncing || isUpdating || !professionalReady || !hasPendingSync}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
