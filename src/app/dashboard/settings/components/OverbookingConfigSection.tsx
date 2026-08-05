"use client";

import React from "react";
import { ShieldCheck, BedDouble, Wrench, Users, AlertTriangle, Info } from "lucide-react";
import type { ConflictDetectionConfig } from "@/types/domain";
import { useTenantModuleKey } from "@/hooks/useTenantModuleKey";

interface OverbookingConfigSectionProps {
  config: ConflictDetectionConfig;
  onChange: (updated: ConflictDetectionConfig) => void;
}

interface ToggleRowProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (val: boolean) => void;
}

function ToggleRow({
  id,
  icon,
  label,
  description,
  checked,
  disabled,
  disabledReason,
  onChange,
}: ToggleRowProps) {
  return (
    <div
      className={`flex items-start gap-5 p-5 rounded-2xl border transition-all duration-200 ${
        disabled
          ? "bg-slate-50 border-slate-100 opacity-70"
          : checked
          ? "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 shadow-sm"
          : "bg-slate-50/60 border-slate-100"
      }`}
    >
      <div
        className={`mt-0.5 w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors ${
          disabled
            ? "bg-slate-100 text-slate-400"
            : checked
            ? "bg-primary/10 text-primary"
            : "bg-slate-100 text-slate-400"
        }`}
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-bold text-sm ${disabled ? "text-slate-400" : "text-slate-800"}`}>
            {label}
          </p>
          {disabled && disabledReason && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              {disabledReason}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Toggle switch */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative flex-shrink-0 mt-1 w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
          disabled
            ? "cursor-not-allowed bg-slate-200"
            : checked
            ? "bg-primary cursor-pointer"
            : "bg-slate-300 cursor-pointer hover:bg-slate-400"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
            checked && !disabled ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function OverbookingConfigSection({
  config,
  onChange,
}: OverbookingConfigSectionProps) {
  const { tenantModuleKey } = useTenantModuleKey();
  const isHealthcare = tenantModuleKey === "bella_healthcare";

  const update = (key: keyof ConflictDetectionConfig, val: boolean) => {
    onChange({ ...config, [key]: val });
  };

  return (
    <div className="mt-8 pt-8 border-t border-slate-200/80 dark:border-slate-800">
      {/* Section header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">
            Kiểm tra trùng lịch nâng cao
          </h3>
          <p className="text-sm text-muted-foreground font-semibold">
            {isHealthcare
              ? "Bật / tắt kiểm tra từng loại tài nguyên theo quy mô phòng khám"
              : "Bật / tắt kiểm tra từng loại tài nguyên theo quy mô cơ sở"}
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50/80 border border-blue-100 rounded-2xl mb-5 text-sm">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-blue-700 font-medium leading-relaxed">
          Doanh nghiệp có thể tắt bớt kiểm tra phòng hoặc thiết bị cố định nếu không sử dụng để tránh cảnh báo không cần thiết.
          Kiểm tra trùng lịch làm việc nhân sự luôn được bật mặc định.
        </p>
      </div>

      <div className="space-y-3">
        {/* Worker - always on, non-toggleable */}
        <ToggleRow
          id="conflict-toggle-worker"
          icon={<Users className="w-5 h-5" />}
          label={isHealthcare ? "Trùng lịch bác sĩ / y sĩ" : "Trùng lịch nhân sự"}
          description={isHealthcare ? "Ngăn xếp 2 bệnh nhân cho cùng 1 bác sĩ trong cùng khung giờ. Tính năng cốt lõi, không thể tắt." : "Ngăn xếp lịch 2 khách cho cùng 1 nhân sự trong cùng khung giờ. Tính năng cốt lõi, không thể tắt."}
          checked={true}
          disabled={true}
          disabledReason="Bắt buộc"
          onChange={() => {}}
        />

        {/* Room conflicts */}
        <ToggleRow
          id="conflict-toggle-room"
          icon={<BedDouble className="w-5 h-5" />}
          label={isHealthcare ? "Trùng phòng khám / ghế nha" : "Trùng phòng / giường"}
          description={isHealthcare ? "Cảnh báo khi 2 bệnh nhân được đặt cùng phòng khám hoặc ghế nha trong cùng khung giờ." : "Cảnh báo khi 2 khách được đặt cùng phòng hoặc giường trong cùng khung giờ."}
          checked={config.detectRoomConflicts}
          onChange={(val) => update("detectRoomConflicts", val)}
        />

        {/* Equipment conflicts */}
        <ToggleRow
          id="conflict-toggle-equipment"
          icon={<Wrench className="w-5 h-5" />}
          label={isHealthcare ? "Trùng máy X-Quang / thiết bị 3D" : "Trùng thiết bị"}
          description={isHealthcare ? "Cảnh báo khi 2 lượt khám dùng cùng máy X-Quang 3D / thiết bị chuyên khoa trong cùng khung giờ." : "Cảnh báo khi 2 khách dùng cùng thiết bị trong cùng khung giờ."}
          checked={config.detectEquipmentConflicts}
          onChange={(val) => update("detectEquipmentConflicts", val)}
        />

        {/* Customer double booking */}
        <ToggleRow
          id="conflict-toggle-customer"
          icon={<AlertTriangle className="w-5 h-5" />}
          label={isHealthcare ? "Bệnh nhân đặt 2 lịch cùng lúc" : "Khách đặt 2 lịch cùng lúc"}
          description={isHealthcare ? "Phát hiện khi cùng 1 bệnh nhân có 2 lịch hẹn khám chồng giờ." : "Phát hiện khi cùng 1 khách có 2 booking chồng giờ."}
          checked={config.detectCustomerDoubleBooking}
          onChange={(val) => update("detectCustomerDoubleBooking", val)}
        />
      </div>
    </div>
  );
}
