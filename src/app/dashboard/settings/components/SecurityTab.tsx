"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-client";

export default function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới không khớp!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    try {
      // 1. Lấy thông tin user hiện tại để lấy email
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || !user.email) {
        toast.error("Không tìm thấy thông tin phiên đăng nhập!");
        setIsSaving(false);
        return;
      }

      // 2. Xác minh mật khẩu cũ bằng cách đăng nhập lại
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error("Mật khẩu cũ không chính xác!");
        setIsSaving(false);
        return;
      }

      // 3. Cập nhật mật khẩu mới trong Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error("Không thể đổi mật khẩu: " + error.message);
      } else {
        toast.success("Đổi mật khẩu thành công!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error("Đã xảy ra lỗi: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
          <KeyRound className="text-primary w-6 h-6" />
          Bảo mật & Mật khẩu
        </h2>
        <p className="text-muted-foreground font-semibold mt-2">
          Thay đổi mật khẩu đăng nhập của bạn để bảo vệ tài khoản
        </p>
      </div>

      <div className="bg-white/40 dark:bg-black/20 p-8 rounded-3xl border border-white/50 dark:border-white/10 shadow-sm relative overflow-hidden">
        <form onSubmit={handleUpdatePassword} className="space-y-6 relative z-10 max-w-md">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Mật khẩu cũ
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Nhập lại mật khẩu mới
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/60 dark:bg-black/40 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted text-white font-black py-4 rounded-2xl shadow-xl shadow-pink-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 text-sm uppercase tracking-widest mt-4"
          >
            {isSaving ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
            {isSaving ? "Đang xử lý..." : "Đổi mật khẩu"}
          </button>
        </form>
      </div>
    </div>
  );
}
