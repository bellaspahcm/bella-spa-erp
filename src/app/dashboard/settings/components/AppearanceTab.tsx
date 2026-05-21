'use client';

import { useState, useEffect } from 'react';
import { Palette, CheckCircle2, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';

export default function AppearanceTab() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Read theme from document.documentElement or cookies
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme);
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    if (theme === newTheme) return;

    setTheme(newTheme);
    
    // 1. Set cookie for SSR layout rendering
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
    
    // 2. Set class on html element for client-side instant update
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      toast.success('Đã kích hoạt chế độ tối Deep Velvet sang trọng!');
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('Đã kích hoạt giao diện Soft Luxury cổ điển!');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Palette className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Giao diện</h2>
          <p className="text-sm text-muted-foreground font-semibold">
            Tùy chỉnh phong cách hiển thị của hệ thống
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Soft Luxury (Light Mode) */}
        <div 
          onClick={() => handleThemeChange('light')}
          className={`p-8 rounded-[2.5rem] relative overflow-hidden group cursor-pointer transition-all duration-300 ${
            theme === 'light' 
              ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-xl shadow-pink-200/50 scale-[1.02]' 
              : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200'
          }`}
        >
          <Sun className={`absolute top-4 right-4 w-6 h-6 transition-transform group-hover:scale-125 ${
            theme === 'light' ? 'text-white/30' : 'text-slate-400'
          }`} />
          <h4 className="text-xl font-bold mb-2">Soft Luxury</h4>
          <p className={`text-sm font-medium ${
            theme === 'light' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
          }`}>
            Phong cách sang trọng với tông màu hồng Pastel và Glassmorphism đặc trưng của Bella Spa.
          </p>
          <div className="mt-6 flex items-center gap-2">
            {theme === 'light' ? (
              <div className="px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Đang áp dụng</span>
              </div>
            ) : (
              <div className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase">
                Kích hoạt
              </div>
            )}
          </div>
        </div>

        {/* Modern Dark (Dark Mode) */}
        <div 
          onClick={() => handleThemeChange('dark')}
          className={`p-8 rounded-[2.5rem] relative overflow-hidden group cursor-pointer transition-all duration-300 ${
            theme === 'dark' 
              ? 'bg-gradient-to-br from-purple-950 to-slate-950 text-white shadow-xl shadow-purple-950/50 scale-[1.02] border border-purple-500/20' 
              : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200'
          }`}
        >
          <Moon className={`absolute top-4 right-4 w-6 h-6 transition-transform group-hover:scale-125 ${
            theme === 'dark' ? 'text-white/30' : 'text-slate-400'
          }`} />
          <h4 className="text-xl font-bold mb-2">Modern Dark</h4>
          <p className={`text-sm font-medium ${
            theme === 'dark' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
          }`}>
            Chế độ tối Deep Velvet cực kỳ cuốn hút, thiết kế riêng cho trải nghiệm ban đêm tinh tế.
          </p>
          <div className="mt-6 flex items-center gap-2">
            {theme === 'dark' ? (
              <div className="px-4 py-1.5 bg-white/20 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Đang áp dụng</span>
              </div>
            ) : (
              <div className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase">
                Kích hoạt
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
