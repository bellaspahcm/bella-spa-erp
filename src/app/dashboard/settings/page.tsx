"use client";
// Version: 1.3.0 - Refactored Component & Strict Types

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Save,
  ChevronRight,
  Sparkles,
  Bell,
  Palette,
  Shield,
  Coins,
  Lock,
  CreditCard,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { getTenantSettings, saveTenantSettings } from "@/services/tenant-actions";
import { cn } from "@/lib/utils";
import { TenantGeneralSettings } from "@/types/domain";

import GeneralSettingsTab from "./components/GeneralSettingsTab";
import SalaryConfigTab from "./components/SalaryConfigTab";
import StaffManagementTab from "./components/StaffManagementTab";
import PermissionsTab from "./PermissionsTab";
import NotificationsTab from "./components/NotificationsTab";
import AppearanceTab from "./components/AppearanceTab";
import SubscriptionTab from "./components/SubscriptionTab";
import HqBillingTab from "./components/HqBillingTab";

const TABS = [
  { id: "general", label: "Thông tin chung", icon: Store },
  { id: "subscription", label: "Gói dịch vụ (SaaS)", icon: CreditCard },
  { id: "hq-billing", label: "Hóa đơn HQ (Royalty)", icon: Receipt },
  { id: "salary", label: "Lương & Thưởng", icon: Coins },
  { id: "staff", label: "Nhân sự & Quyền", icon: Shield },
  { id: "permissions", label: "Phân quyền", icon: Lock },
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "appearance", label: "Giao diện", icon: Palette },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const [generalSettings, setGeneralSettings] = useState<TenantGeneralSettings>({
    name: "",
    phone: "",
    email: "",
    address: "",
    qr_bank_code: "",
    qr_account_number: "",
    qr_account_name: "",
    salary_config: {
      bonus_5_star: 50000,
      bonus_4_5_star: 30000,
      bonus_4_star: 10000,
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000,
    }
  });

  useEffect(() => {
    async function loadSettings() {
      setIsLoadingSettings(true);
      try {
        const data = await getTenantSettings();
        if (data) {
          setGeneralSettings({
            name: data.name || "",
            phone: data.contact_phone || "",
            email: data.email || "",
            address: data.address || "",
            qr_bank_code: data.qr_bank_code || "",
            qr_account_number: data.qr_account_number || "",
            qr_account_name: data.qr_account_name || "",
            salary_config: (data.salary_config as any) || {
              bonus_5_star: 50000,
              bonus_4_5_star: 30000,
              bonus_4_star: 10000,
              kpi_target_sessions: 30,
              kpi_bonus_amount: 1000000,
            }
          });
        }
      } catch (err) {
        console.error("Error loading settings:", err);
        toast.error("Không thể tải thông tin cấu hình");
      } finally {
        setIsLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveTenantSettings(generalSettings);
      if (res.success) {
        toast.success("Đã lưu cấu hình thành công!");
      } else {
        toast.error("Lỗi khi lưu: " + res.error);
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi lưu cấu hình!");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight uppercase">
            Cài đặt
          </h1>
          <p className="text-muted-foreground font-semibold mt-1 flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            Cấu hình hệ thống Bella Spa
          </p>
        </div>
        {(activeTab === "general" || activeTab === "salary") && (
          <button
            onClick={handleSave}
            disabled={isSaving || isLoadingSettings}
            className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-pink-200 active:scale-95 uppercase tracking-wider disabled:opacity-50 disabled:grayscale"
          >
            {isSaving ? (
              <Sparkles className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold group",
                activeTab === tab.id
                  ? "bg-white text-primary shadow-lg shadow-pink-100 border border-pink-50"
                  : "text-muted-foreground hover:bg-white/50 hover:text-primary",
              )}
            >
              <tab.icon
                className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110",
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-slate-400 group-hover:text-primary",
                )}
              />
              <span className="text-sm">{tab.label}</span>
              {activeTab === tab.id && (
                <ChevronRight className="ml-auto w-4 h-4 text-primary animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-pink rounded-[3rem] p-10 shadow-sm border border-white h-full"
            >
              {activeTab === "general" && (
                <GeneralSettingsTab
                  generalSettings={generalSettings}
                  setGeneralSettings={setGeneralSettings}
                  isLoadingSettings={isLoadingSettings}
                />
              )}

              {activeTab === "subscription" && (
                <SubscriptionTab />
              )}

              {activeTab === "hq-billing" && (
                <HqBillingTab />
              )}

              {activeTab === "salary" && (
                <SalaryConfigTab
                  generalSettings={generalSettings}
                  setGeneralSettings={setGeneralSettings}
                />
              )}

              {activeTab === "staff" && (
                <StaffManagementTab />
              )}

              {activeTab === "permissions" && (
                <PermissionsTab />
              )}

              {activeTab === "notifications" && (
                <NotificationsTab />
              )}

              {activeTab === "appearance" && (
                <AppearanceTab />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
