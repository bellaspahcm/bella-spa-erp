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
  History,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  createUser,
  getUsers,
  updateUserStatus,
} from "@/services/user-actions";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-client";
import { getAuditLogs } from "@/services/audit-actions";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

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

const renderReadableChanges = (oldData: any, newData: any) => {
  const fieldLabels: Record<string, string> = {
    status: "Trạng thái",
    full_name: "Họ tên",
    email: "Email",
    role: "Vai trò",
    amount: "Số tiền",
    category: "Hạng mục",
    description: "Mô tả",
    base_salary: "Lương cơ bản",
    kpi_bonus: "Thưởng KPI",
    violations_deduction: "Vi phạm/Giảm trừ",
    service_percentage_bonus: "Tạm ứng",
    ktv_name: "Nhân viên",
    sessions_count: "Số buổi thực hiện",
    avg_rating: "Đánh giá TB",
  };

  const ignoredFields = [
    "id",
    "created_at",
    "updated_at",
    "user_id",
    "id_staff",
  ];

  const formatValue = (val: any) => {
    if (val === "active") return "Hoạt động";
    if (val === "inactive") return "Ngừng hoạt động";
    if (val === "approved") return "Đã duyệt";
    if (val === "draft") return "Nháp";
    if (typeof val === "number") return val.toLocaleString("vi-VN") + "đ";
    if (val === null || val === undefined) return "---";
    return String(val);
  };

  // If one of them is null, it's a CREATE or DELETE
  if (!oldData && newData)
    return (
      <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em] italic">
        Khởi tạo dữ liệu mới
      </span>
    );
  if (oldData && !newData)
    return (
      <span className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] italic">
        Đã xóa khỏi hệ thống
      </span>
    );

  const changes = [];
  if (typeof newData === "object" && newData !== null) {
    for (const key in newData) {
      if (ignoredFields.includes(key)) continue;

      const oldVal = oldData?.[key];
      const newVal = newData[key];

      if (oldVal !== newVal) {
        changes.push(
          <div
            key={key}
            className="flex items-center gap-4 text-[11px] font-bold py-1 border-b border-slate-50 last:border-none"
          >
            <span className="text-slate-400 w-32 shrink-0">
              {fieldLabels[key] || key}:
            </span>
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="text-slate-400 line-through decoration-rose-200/50 truncate max-w-[150px]">
                {formatValue(oldVal)}
              </span>
              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
              <span className="text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-md font-black">
                {formatValue(newVal)}
              </span>
            </div>
          </div>,
        );
      }
    }
  }

  return changes.length > 0 ? (
    <div className="space-y-1">{changes}</div>
  ) : (
    <span className="text-xs text-slate-400 italic">
      Cập nhật thông tin hệ thống
    </span>
  );
};

const TABS = [
  { id: "general", label: "Thông tin chung", icon: Store },
  { id: "staff", label: "Nhân sự & Quyền", icon: Shield },
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "appearance", label: "Giao diện", icon: Palette },
  { id: "audit", label: "Nhật ký thay đổi", icon: History },
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
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    if (activeTab === "staff") {
      fetchUsers();

      // Realtime subscription
      const channel = supabase
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
        supabase.removeChannel(channel);
      };
    }
    if (activeTab === "audit") {
      fetchLogs();
    }
  }, [activeTab]);

  async function fetchLogs() {
    setIsLoadingLogs(true);
    try {
      const data = await getAuditLogs();
      setAuditLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  }

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

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Đã lưu thay đổi thành công!");
    }, 1500);
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
          disabled={isSaving}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Store className="w-4 h-4" /> Tên thương hiệu
                          </label>
                          <input
                            type="text"
                            defaultValue="Bella Spa HCM"
                            className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Hotline
                          </label>
                          <input
                            type="text"
                            defaultValue="0901 234 567"
                            className="w-full px-6 py-4 bg-white/50 border border-pink-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Email liên hệ
                          </label>
                          <input
                            type="email"
                            defaultValue="contact@bellaspa.vn"
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
                            defaultValue="123 Đường ABC, Quận 1, TP. Hồ Chí Minh"
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
                      <table className="w-full text-left">
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                          {isLoadingUsers ? (
                            <tr>
                              <td colSpan={5} className="py-20 text-center">
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
                                      user.role === "admin"
                                        ? "bg-rose-50 text-rose-600 border-rose-100"
                                        : user.role === "ktv"
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
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
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
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === "audit" && (
            <div className="hidden lg:block h-full border border-dashed border-pink-200 rounded-[3rem] flex items-center justify-center text-pink-300 font-bold italic">
              Đang hiển thị Nhật ký bên dưới...
            </div>
          )}
        </div>
      </div>

      {/* Audit Log Section (Moved Below the Grid) */}
      <AnimatePresence>
        {activeTab === "audit" && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="mt-12 glass-pink rounded-[3rem] p-10 shadow-sm border border-white overflow-hidden"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 shadow-inner">
                <History className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-foreground uppercase tracking-tight">
                  Nhật ký thay đổi hệ thống
                </h2>
                <p className="text-sm text-muted-foreground font-semibold">
                  Toàn bộ lịch sử cập nhật và điều chỉnh dữ liệu Bella Spa
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-white bg-white/40 shadow-sm">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/50 bg-white/20">
                    <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">
                      Thời điểm
                    </th>
                    <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">
                      Quản trị viên
                    </th>
                    <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">
                      Phân hệ
                    </th>
                    <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">
                      Chi tiết thay đổi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={4} className="py-24 text-center">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto mb-6" />
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">
                          Đang truy xuất dữ liệu...
                        </p>
                      </td>
                    </tr>
                  ) : auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="group hover:bg-white/60 transition-all"
                      >
                        <td className="px-8 py-8 whitespace-nowrap">
                          <p className="text-base font-black text-slate-900 tracking-tighter">
                            {format(new Date(log.created_at), "HH:mm:ss")}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                            {format(new Date(log.created_at), "dd/MM/yyyy")}
                          </p>
                        </td>
                        <td className="px-8 py-8">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center text-slate-600 font-black text-xs border border-white shadow-sm">
                              {log.user_name?.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-black text-slate-800">
                              {log.user_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-8">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] inline-block w-fit shadow-sm border",
                                log.action === "CREATE"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : log.action === "UPDATE"
                                    ? "bg-blue-50 text-blue-600 border-blue-100"
                                    : "bg-rose-50 text-rose-600 border-rose-100",
                              )}
                            >
                              {log.action}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              {log.module}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-8">
                          <div className="flex flex-col gap-3">
                            {renderReadableChanges(log.old_data, log.new_data)}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-24 text-center">
                        <p className="text-muted-foreground font-bold italic text-lg">
                          Chưa có bản ghi nào được lưu lại
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border border-white"
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
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        id: "ktv",
                        label: "Kỹ thuật viên",
                        icon: BadgeCheck,
                        desc: "Thực hiện liệu trình",
                      },
                      {
                        id: "admin",
                        label: "Quản trị viên",
                        icon: Shield,
                        desc: "Toàn quyền hệ thống",
                      },
                    ].map((role) => (
                      <div
                        key={role.id}
                        onClick={() =>
                          setNewStaff({ ...newStaff, role: role.id })
                        }
                        className={cn(
                          "p-4 rounded-2xl border-2 cursor-pointer transition-all relative group",
                          newStaff.role === role.id
                            ? "bg-primary/5 border-primary shadow-sm"
                            : "border-slate-100 hover:border-primary/30",
                        )}
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <role.icon
                            className={cn(
                              "w-4 h-4",
                              newStaff.role === role.id
                                ? "text-primary"
                                : "text-slate-400",
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs font-black uppercase tracking-tighter",
                              newStaff.role === role.id
                                ? "text-primary"
                                : "text-slate-600",
                            )}
                          >
                            {role.label}
                          </span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {role.desc}
                        </p>
                        {newStaff.role === role.id && (
                          <motion.div
                            layoutId="role-check"
                            className="absolute top-2 right-2"
                          >
                            <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <BadgeCheck className="w-3 h-3 text-white" />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
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
      </AnimatePresence>
    </div>
  );
}
