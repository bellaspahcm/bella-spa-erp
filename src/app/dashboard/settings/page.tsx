'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

const TABS = [
  { id: 'general', label: 'Thông tin chung', icon: Store },
  { id: 'staff', label: 'Nhân sự & Quyền', icon: Shield },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'appearance', label: 'Giao diện', icon: Palette },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Đã lưu thay đổi thành công!');
    }, 1500);
  };

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight uppercase">Cài đặt</h1>
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
          <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
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
                  : "text-muted-foreground hover:bg-white/50 hover:text-primary"
              )}
            >
              <tab.icon className={cn(
                "w-5 h-5 transition-transform group-hover:scale-110",
                activeTab === tab.id ? "text-primary" : "text-slate-400 group-hover:text-primary"
              )} />
              <span className="text-sm">{tab.label}</span>
              {activeTab === tab.id && (
                <ChevronRight className="ml-auto w-4 h-4 text-primary animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 glass-pink rounded-[3rem] p-10 shadow-sm border border-white"
        >
          {activeTab === 'general' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Thông tin Spa</h2>
                  <p className="text-sm text-muted-foreground font-semibold">Cấu hình thông tin cơ bản hiển thị trên hóa đơn và hệ thống</p>
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
                      <p className="font-black text-slate-900">Logo thương hiệu</p>
                      <p className="text-xs text-muted-foreground font-bold mt-1">PNG, JPG tối đa 5MB</p>
                    </div>
                    <button className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary hover:text-white transition-all group">
                      <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-8 py-10 text-center">
              <Shield className="w-20 h-20 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Cấu hình nhân sự</h3>
              <p className="text-muted-foreground font-semibold max-w-md mx-auto">
                Tính năng phân quyền nâng cao đang được cập nhật cho phiên bản Enterprise.
              </p>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-500">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Thông báo</h2>
                  <p className="text-sm text-muted-foreground font-semibold">Tùy chỉnh các kênh nhận thông báo hệ thống</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { title: 'Lịch hẹn mới', desc: 'Nhận thông báo khi có khách hàng đặt lịch qua App', active: true },
                  { title: 'Báo cáo doanh thu', desc: 'Gửi báo cáo tổng hợp vào cuối ngày qua Email', active: true },
                  { title: 'Cảnh báo tồn kho', desc: 'Thông báo khi vật tư spa sắp hết', active: false },
                  { title: 'Sinh nhật khách hàng', desc: 'Nhắc nhở chúc mừng sinh nhật khách hàng thân thiết', active: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-6 bg-white/40 rounded-3xl border border-white group hover:bg-white/60 transition-all">
                    <div>
                      <p className="font-black text-slate-900">{item.title}</p>
                      <p className="text-sm text-muted-foreground font-semibold mt-1">{item.desc}</p>
                    </div>
                    <div className={cn(
                      "w-14 h-8 rounded-full p-1 transition-all cursor-pointer",
                      item.active ? "bg-primary" : "bg-slate-200"
                    )}>
                      <div className={cn(
                        "w-6 h-6 bg-white rounded-full shadow-sm transition-all",
                        item.active ? "ml-6" : "ml-0"
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Palette className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Giao diện</h2>
                  <p className="text-sm text-muted-foreground font-semibold">Tùy chỉnh phong cách hiển thị của hệ thống</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-primary rounded-[2.5rem] text-white shadow-xl shadow-pink-100 relative overflow-hidden group cursor-pointer">
                  <Sparkles className="absolute top-4 right-4 w-6 h-6 text-white/30 group-hover:scale-125 transition-transform" />
                  <h4 className="text-xl font-bold mb-2">Soft Luxury</h4>
                  <p className="text-sm text-white/80 font-medium">Phong cách sang trọng với tông màu hồng Pastel và Glassmorphism.</p>
                  <div className="mt-6 flex items-center gap-2">
                    <div className="px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase">Đang áp dụng</div>
                  </div>
                </div>
                <div className="p-8 bg-slate-800 rounded-[2.5rem] text-white shadow-xl shadow-slate-100 relative overflow-hidden group cursor-pointer grayscale opacity-50">
                  <h4 className="text-xl font-bold mb-2">Modern Dark</h4>
                  <p className="text-sm text-white/60 font-medium">Chế độ tối chuyên nghiệp dành cho làm việc ban đêm.</p>
                  <div className="mt-6 flex items-center gap-2">
                    <div className="px-4 py-1.5 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">Sắp ra mắt</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
