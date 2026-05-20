"use client";
// Version: 1.2.1 - Build Fix

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  User,
  Bell,
  Shield,
  Globe,
  Database,
  Palette,
  Store,
  Phone,
  MapPin,
  Mail,
  Camera,
  Save,
  ChevronRight,
  Sparkles,
  Star,
  Zap,
  UserPlus,
  X,
  ShieldAlert,
  BadgeCheck,
  ArrowRight,
  Coins,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createUser,
  getUsers,
  updateUserStatus,
  updateUser,
  deleteUser,
} from "@/services/user-actions";
import { getTenantSettings, saveTenantSettings } from "@/services/tenant-actions";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase-client";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import PermissionsTab from "./PermissionsTab";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  show: { y: 0, opacity: 1 },
};


const TABS = [
  { id: "general", label: "Thông tin chung", icon: Store },
  { id: "salary", label: "Lương & Thưởng", icon: Coins },
  { id: "staff", label: "Nhân sự & Quyền", icon: Shield },
  { id: "permissions", label: "Phân quyền", icon: Lock },
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "appearance", label: "Giao diện", icon: Palette },
];

const POPULAR_BANKS = [
  { code: "MB", name: "MB Bank (Ngân hàng Quân Đội)" },
  { code: "VCB", name: "Vietcombank (Ngoại Thương Việt Nam)" },
  { code: "CTG", name: "VietinBank (Công Thương Việt Nam)" },
  { code: "BIDV", name: "BIDV (Đầu tư và Phát triển)" },
  { code: "TCB", name: "Techcombank (Kỹ Thương Việt Nam)" },
  { code: "ACB", name: "ACB (Á Châu)" },
  { code: "STB", name: "Sacombank (Sài Gòn Thương Tín)" },
  { code: "VPB", name: "VPBank (Việt Nam Thịnh Vượng)" },
  { code: "TPB", name: "TPBank (Tiên Phong)" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newStaff, setNewStaff] = useState({
    full_name: "",
    email: "",
    role: "ktv",
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingStaff, setEditingStaff] = useState({
    id: "",
    full_name: "",
    email: "",
    role: "ktv",
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState({
    id: "",
    full_name: "",
  });

  const [generalSettings, setGeneralSettings] = useState({
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
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

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

  useEffect(() => {
    if (activeTab === "staff") {
      fetchUsers();

      const sb = getSupabase();
      // Realtime subscription
      const channel = sb
        .channel("users-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "users" },
          () => {
            fetchUsers();
          },
        )
        .subscribe();

      return () => {
        sb.removeChannel(channel);
      };
    }
  }, [activeTab]);

  async function fetchUsers() {
    setIsLoadingUsers(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const result = await updateUserStatus(id, newStatus);
    if (result.success) {
      toast.success("Đã cập nhật trạng thái nhân sự");
      fetchUsers();
    } else {
      toast.error("Lỗi khi cập nhật: " + result.error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveTenantSettings(generalSettings);
      if (res.success) {
        toast.success("Đã lưu cấu hình thành công!");
      } else {
        toast.error("Lỗi khi lưu: " + res.error);
      }
    } catch (err: any) {
      toast.error("Đã xảy ra lỗi khi lưu cấu hình!");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.full_name || !newStaff.email) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setIsAdding(true);
    try {
      const result = await createUser(newStaff);
      if (result.error) {
        toast.error("Lỗi: " + result.error);
      } else {
        toast.success("Đã thêm nhân viên " + newStaff.full_name);
        setIsAddModalOpen(false);
        setNewStaff({ full_name: "", email: "", role: "ktv" });
        fetchUsers();
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi thêm nhân sự");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff.full_name) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateUser(editingStaff.id, editingStaff);
      if (result.error) {
        toast.error("Lỗi: " + result.error);
      } else {
        toast.success("Đã cập nhật thông tin nhân viên");
        setIsEditModalOpen(false);
        fetchUsers();
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi cập nhật");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteStaff = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteUser(deletingStaff.id);
      if (result.error) {
        toast.error("Lỗi: " + result.error);
      } else {
        toast.success("Đã xóa nhân viên");
        setIsDeleteModalOpen(false);
        fetchUsers();
      }
    } catch (error) {
      toast.error("Đã xảy ra lỗi khi xóa");
    } finally {
      setIsDeleting(false);
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
            {activeTab !== "audit" && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-pink rounded-[3rem] p-10 shadow-sm border border-white h-full"
              >
                {activeTab === "general" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Store className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          Thông tin Spa
                        </h2>
                        <p className="text-sm text-muted-foreground font-semibold">
                          Cấu hình thông tin cơ bản hiển thị trên hóa đơn và hệ
                          thống
                        </p>
                      </div>
                    </div>

                    {isLoadingSettings ? (
                      <div className="py-20 text-center">
                        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold">
                          Đang tải thông tin cấu hình...
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Store className="w-4 h-4" /> Tên thương hiệu
                              </label>
                              <input
                                type="text"
                                value={generalSettings.name}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, name: e.target.value })}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Phone className="w-4 h-4" /> Hotline
                              </label>
                              <input
                                type="text"
                                value={generalSettings.phone}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, phone: e.target.value })}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Mail className="w-4 h-4" /> Email liên hệ
                              </label>
                              <input
                                type="email"
                                value={generalSettings.email}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, email: e.target.value })}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                              />
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> Địa chỉ trụ sở
                              </label>
                              <textarea
                                value={generalSettings.address}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                                rows={4}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold resize-none"
                              />
                            </div>
                            <div className="p-6 bg-white/40 rounded-[2rem] border border-white flex items-center justify-between">
                              <div>
                                <p className="font-black text-slate-900">
                                  Logo thương hiệu
                                </p>
                                <p className="text-xs text-muted-foreground font-bold mt-1">
                                  PNG, JPG tối đa 5MB
                                </p>
                              </div>
                              <button className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary hover:text-white transition-all group">
                                <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* VietQR Bank Configuration */}
                        <div className="mt-8 pt-8 border-t border-pink-100/50">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                              <Database className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-foreground">
                                Cấu hình thanh toán VietQR động
                              </h3>
                              <p className="text-sm text-muted-foreground font-semibold">
                                Tài khoản ngân hàng nhận tiền cọc/thanh toán và đối soát tự động
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Ngân hàng thụ hưởng
                              </label>
                              <PremiumSelect
                                value={generalSettings.qr_bank_code || ""}
                                onChange={(value) => setGeneralSettings({ ...generalSettings, qr_bank_code: value })}
                                options={POPULAR_BANKS.map((bank) => ({ value: bank.code, label: bank.name }))}
                                placeholder="-- Chọn ngân hàng --"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Số tài khoản
                              </label>
                              <input
                                type="text"
                                value={generalSettings.qr_account_number}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, qr_account_number: e.target.value.replace(/\s+/g, "") })}
                                placeholder="Nhập số tài khoản"
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Tên chủ tài khoản
                              </label>
                              <input
                                type="text"
                                value={generalSettings.qr_account_name}
                                onChange={(e) => setGeneralSettings({ ...generalSettings, qr_account_name: e.target.value.toUpperCase() })}
                                placeholder="VD: NGUYEN VAN A"
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "salary" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Coins className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          Cấu hình Lương & Thưởng
                        </h2>
                        <p className="text-sm text-muted-foreground font-semibold">
                          Tùy chỉnh các mốc thưởng chất lượng đánh giá và thưởng KPI
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Thưởng chất lượng */}
                      <div className="p-8 bg-white/40 rounded-[2.5rem] border border-white shadow-sm space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                            <Star className="w-5 h-5 text-rose-500 fill-rose-500" />
                          </div>
                          <h3 className="font-black text-lg text-slate-900">Thưởng Chất lượng</h3>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                              <span>Mốc đạt 5.0 Sao</span>
                              <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Cao nhất</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={(generalSettings.salary_config?.bonus_5_star || 0).toLocaleString('vi-VN')}
                                onChange={(e) => {
                                  const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                  setGeneralSettings({
                                    ...generalSettings,
                                    salary_config: { ...generalSettings.salary_config, bonus_5_star: isNaN(numericValue) ? 0 : numericValue }
                                  });
                                }}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Mốc đạt 4.5 Sao
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={(generalSettings.salary_config?.bonus_4_5_star || 0).toLocaleString('vi-VN')}
                                onChange={(e) => {
                                  const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                  setGeneralSettings({
                                    ...generalSettings,
                                    salary_config: { ...generalSettings.salary_config, bonus_4_5_star: isNaN(numericValue) ? 0 : numericValue }
                                  });
                                }}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Mốc đạt 4.0 Sao
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={(generalSettings.salary_config?.bonus_4_star || 0).toLocaleString('vi-VN')}
                                onChange={(e) => {
                                  const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                  setGeneralSettings({
                                    ...generalSettings,
                                    salary_config: { ...generalSettings.salary_config, bonus_4_star: isNaN(numericValue) ? 0 : numericValue }
                                  });
                                }}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Thưởng KPI */}
                      <div className="p-8 bg-white/40 rounded-[2.5rem] border border-white shadow-sm space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                          </div>
                          <h3 className="font-black text-lg text-slate-900">Thưởng KPI (Số ca)</h3>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Chỉ tiêu số ca yêu cầu (Tháng)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                value={generalSettings.salary_config?.kpi_target_sessions ?? 0}
                                onChange={(e) => setGeneralSettings({
                                  ...generalSettings,
                                  salary_config: { ...generalSettings.salary_config, kpi_target_sessions: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Ca</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                              <span>Mức thưởng khi vượt KPI</span>
                              <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Cộng vào Lương</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={(generalSettings.salary_config?.kpi_bonus_amount || 0).toLocaleString('vi-VN')}
                                onChange={(e) => {
                                  const numericValue = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                  setGeneralSettings({
                                    ...generalSettings,
                                    salary_config: { ...generalSettings.salary_config, kpi_bonus_amount: isNaN(numericValue) ? 0 : numericValue }
                                  });
                                }}
                                className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 pr-12"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₫</span>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl mt-4">
                            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                              * KTV hoàn thành lớn hơn <strong className="text-primary">{generalSettings.salary_config?.kpi_target_sessions} ca</strong> trong tháng sẽ tự động được cộng <strong className="text-primary">{(generalSettings.salary_config?.kpi_bonus_amount || 0).toLocaleString('vi-VN')}₫</strong> vào tổng nhận.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "staff" && (
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">
                            Nhân sự & Quyền
                          </h2>
                          <p className="text-sm text-muted-foreground font-semibold">
                            Quản lý danh sách nhân viên và phân quyền hệ thống
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="px-6 py-3 bg-primary/10 text-primary rounded-xl font-black text-sm uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" /> Thêm nhân sự
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-[2rem] border border-white bg-white/40 shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                        <thead>
                          <tr className="border-b border-white/50">
                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                              Họ và tên
                            </th>
                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                              Vai trò
                            </th>
                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                              Hiệu suất
                            </th>
                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                              Email
                            </th>
                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                              Trạng thái
                            </th>
                            <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-[0.2em] text-right min-w-[150px]">
                              Thao tác
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                          {isLoadingUsers ? (
                            <tr>
                              <td colSpan={6} className="py-20 text-center">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-muted-foreground font-bold">
                                  Đang tải dữ liệu...
                                </p>
                              </td>
                            </tr>
                          ) : users.length > 0 ? (
                            users.map((user) => (
                              <tr
                                key={user.id}
                                className="group hover:bg-white/60 transition-colors"
                              >
                                <td className="px-8 py-6">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center text-primary font-black text-sm border-2 border-white relative">
                                      {user.full_name
                                        ?.substring(0, 2)
                                        .toUpperCase()}
                                      {parseFloat(user.avg_rating) >= 4.9 && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center border border-white">
                                          <Star className="w-2 h-2 text-white fill-white" />
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-900">
                                        {user.full_name}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        Mã NV:{" "}
                                        {user.id.substring(0, 5).toUpperCase()}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                  <span
                                    className={cn(
                                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                      user.role?.toLowerCase() === "admin"
                                        ? "bg-rose-50 text-rose-600 border-rose-100"
                                        : user.role?.toLowerCase() === "ktv"
                                          ? "bg-blue-50 text-blue-600 border-blue-100"
                                          : "bg-slate-50 text-slate-600 border-slate-100",
                                    )}
                                  >
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-8 py-6">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                      <span className="text-xs font-black text-slate-700">
                                        {user.sessions_count} buổi
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Star className="w-3 h-3 text-rose-400 fill-rose-400" />
                                      <span className="text-xs font-black text-slate-700">
                                        {user.avg_rating}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-6 font-bold text-slate-500 text-sm italic">
                                  {user.email}
                                </td>
                                <td className="px-8 py-6 text-center">
                                  <div
                                    onClick={() =>
                                      handleToggleStatus(user.id, user.status)
                                    }
                                    className={cn(
                                      "w-12 h-6 rounded-full p-1 transition-all cursor-pointer mx-auto",
                                      user.status === "active"
                                        ? "bg-emerald-500"
                                        : "bg-slate-200",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                                        user.status === "active"
                                          ? "ml-6"
                                          : "ml-0",
                                      )}
                                    />
                                  </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingStaff({
                                          id: user.id,
                                          full_name: user.full_name,
                                          email: user.email,
                                          role: user.role || 'ktv'
                                        });
                                        setIsEditModalOpen(true);
                                      }}
                                      className="p-2 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                      title="Chỉnh sửa"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeletingStaff({
                                          id: user.id,
                                          full_name: user.full_name
                                        });
                                        setIsDeleteModalOpen(true);
                                      }}
                                      className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                      title="Xóa nhân sự"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-20 text-center text-muted-foreground font-bold italic"
                              >
                                Chưa có dữ liệu nhân sự
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "notifications" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500">
                        <Bell className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          Thông báo
                        </h2>
                        <p className="text-sm text-muted-foreground font-semibold">
                          Tùy chỉnh các kênh nhận thông báo hệ thống
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        {
                          title: "Lịch hẹn mới",
                          desc: "Nhận thông báo khi có khách hàng đặt lịch qua App",
                          active: true,
                        },
                        {
                          title: "Báo cáo doanh thu",
                          desc: "Gửi báo cáo tổng hợp vào cuối ngày qua Email",
                          active: true,
                        },
                        {
                          title: "Cảnh báo tồn kho",
                          desc: "Thông báo khi vật tư spa sắp hết",
                          active: false,
                        },
                        {
                          title: "Sinh nhật khách hàng",
                          desc: "Nhắc nhở chúc mừng sinh nhật khách hàng thân thiết",
                          active: true,
                        },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-6 bg-white/40 rounded-3xl border border-white group hover:bg-white/60 transition-all"
                        >
                          <div>
                            <p className="font-black text-slate-900">
                              {item.title}
                            </p>
                            <p className="text-sm text-muted-foreground font-semibold mt-1">
                              {item.desc}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "w-14 h-8 rounded-full p-1 transition-all cursor-pointer",
                              item.active ? "bg-primary" : "bg-slate-200",
                            )}
                          >
                            <div
                              className={cn(
                                "w-6 h-6 bg-white rounded-full shadow-sm transition-all",
                                item.active ? "ml-6" : "ml-0",
                              )}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "appearance" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Palette className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">
                          Giao diện
                        </h2>
                        <p className="text-sm text-muted-foreground font-semibold">
                          Tùy chỉnh phong cách hiển thị của hệ thống
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-8 bg-primary rounded-[2.5rem] text-white shadow-xl shadow-pink-100 relative overflow-hidden group cursor-pointer">
                        <Sparkles className="absolute top-4 right-4 w-6 h-6 text-white/30 group-hover:scale-125 transition-transform" />
                        <h4 className="text-xl font-bold mb-2">Soft Luxury</h4>
                        <p className="text-sm text-white/80 font-medium">
                          Phong cách sang trọng với tông màu hồng Pastel và
                          Glassmorphism.
                        </p>
                        <div className="mt-6 flex items-center gap-2">
                          <div className="px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase">
                            Đang áp dụng
                          </div>
                        </div>
                      </div>
                      <div className="p-8 bg-slate-800 rounded-[2.5rem] text-white shadow-xl shadow-slate-100 relative overflow-hidden group cursor-pointer grayscale opacity-50">
                        <h4 className="text-xl font-bold mb-2">Modern Dark</h4>
                        <p className="text-sm text-white/60 font-medium">
                          Chế độ tối chuyên nghiệp dành cho làm việc ban đêm.
                        </p>
                        <div className="mt-6 flex items-center gap-2">
                          <div className="px-4 py-1.5 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Sắp ra mắt
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "permissions" && (
                  <PermissionsTab />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>



      {/* Add Staff Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-visible flex flex-col border border-white"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Thêm nhân sự mới
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                      Thiết lập tài khoản & vai trò
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.full_name}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, full_name: e.target.value })
                    }
                    placeholder="VD: Nguyễn Thị Lan"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) =>
                      setNewStaff({ ...newStaff, email: e.target.value })
                    }
                    placeholder="lan.nt@bellaspa.vn"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Vai trò & Quyền hạn
                  </label>
                  <PremiumSelect
                    value={newStaff.role}
                    onChange={(val) => setNewStaff({ ...newStaff, role: val })}
                    options={[
                      { value: "ktv", label: "Kỹ thuật viên" },
                      { value: "ktv_lead", label: "KTV Trưởng (Tổ trưởng)" },
                      { value: "admin_staff", label: "Lễ tân / Nhân viên" },
                      { value: "admin", label: "Quản trị viên (Admin)" },
                    ]}
                    placeholder="Chọn vai trò..."
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="w-full bg-primary text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-pink-100 flex items-center justify-center gap-3 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isAdding ? (
                      <Sparkles className="w-5 h-5 animate-spin" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                    {isAdding ? "Đang khởi tạo..." : "Xác nhận thêm nhân sự"}
                  </button>
                  <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4">
                    Nhân viên mới sẽ nhận được email hướng dẫn kích hoạt tài
                    khoản
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-visible flex flex-col border border-white"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Pencil className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Cập nhật nhân sự
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                      Chỉnh sửa thông tin và vai trò
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateStaff} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStaff.full_name}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, full_name: e.target.value })
                    }
                    placeholder="VD: Nguyễn Thị Lan"
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    required
                    disabled
                    value={editingStaff.email}
                    className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl outline-none font-bold text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground italic ml-2">Không thể thay đổi email sau khi tạo.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" /> Vai trò & Quyền hạn
                  </label>
                  <PremiumSelect
                    value={editingStaff.role}
                    onChange={(val) => setEditingStaff({ ...editingStaff, role: val })}
                    options={[
                      { value: "ktv", label: "Kỹ thuật viên" },
                      { value: "ktv_lead", label: "KTV Trưởng (Tổ trưởng)" },
                      { value: "admin_staff", label: "Lễ tân / Nhân viên" },
                      { value: "admin", label: "Quản trị viên (Admin)" },
                    ]}
                    placeholder="Chọn vai trò..."
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full bg-primary text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl shadow-pink-100 flex items-center justify-center gap-3 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <Sparkles className="w-5 h-5 animate-spin" />
                    ) : (
                      <Pencil className="w-5 h-5" />
                    )}
                    <span>{isUpdating ? "Đang lưu..." : "Lưu thay đổi"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-white text-center p-10"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Xóa nhân sự?</h2>
              <p className="text-slate-500 mb-8 font-medium">
                Bạn có chắc chắn muốn xóa nhân sự <strong className="text-slate-900">{deletingStaff.full_name}</strong> khỏi hệ thống? Thao tác này không thể hoàn tác.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteStaff}
                  disabled={isDeleting}
                  className="flex-1 bg-rose-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-200 flex items-center justify-center gap-2 hover:bg-rose-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Sparkles className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Xóa ngay</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
