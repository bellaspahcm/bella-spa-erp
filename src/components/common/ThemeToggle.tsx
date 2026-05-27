'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme);
  }, []);

  const toggleTheme = (newTheme: 'light' | 'dark') => {
    if (theme === newTheme) return;

    setTheme(newTheme);
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      toast.success('Đã kích hoạt chế độ tối Deep Velvet sang trọng!');
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('Đã kích hoạt giao diện Soft Luxury cổ điển!');
    }

    // Trigger a storage event or custom event if other tabs/components need to sync immediately
    window.dispatchEvent(new Event('theme-change'));
  };

  // Sync state if theme is changed from settings page
  useEffect(() => {
    const handleGlobalThemeChange = () => {
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      setTheme(currentTheme);
    };

    window.addEventListener('theme-change', handleGlobalThemeChange);
    return () => window.removeEventListener('theme-change', handleGlobalThemeChange);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-full bg-slate-100/50 dark:bg-slate-900/30 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="w-full bg-[#FFF6F8] dark:bg-[#1C1B19] border border-[#FCE4EC] dark:border-[#3E3A35] p-1 rounded-2xl flex items-center justify-between gap-2 relative shadow-inner">
      <div className="absolute inset-0 bg-gradient-to-r from-rose-200/5 to-rose-300/5 pointer-events-none rounded-2xl" />
      
      {/* Light Mode Pill */}
      <button
        onClick={() => toggleTheme('light')}
        className={`flex-1 relative z-10 py-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-all duration-300 ${
          theme === 'light'
            ? 'text-primary'
            : 'text-slate-500 hover:text-slate-700 dark:text-[#CDBCAB] dark:hover:text-slate-200'
        }`}
      >
        {theme === 'light' && (
          <motion.div
            layoutId="active-theme-pill"
            className="absolute inset-0 bg-white shadow-sm border border-[#FCE4EC] rounded-xl z-[-1]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Sun className="w-3.5 h-3.5" />
        <span>Sáng</span>
      </button>

      {/* Dark Mode Pill */}
      <button
        onClick={() => toggleTheme('dark')}
        className={`flex-1 relative z-10 py-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-all duration-300 ${
          theme === 'dark'
            ? 'text-white'
            : 'text-slate-500 hover:text-slate-700 dark:text-[#CDBCAB] dark:hover:text-slate-200'
        }`}
      >
        {theme === 'dark' && (
          <motion.div
            layoutId="active-theme-pill"
            className="absolute inset-0 bg-gradient-to-br from-[#5D1C34] to-[#11100F] shadow-md border border-[#A67D44]/30 rounded-xl z-[-1]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Moon className="w-3.5 h-3.5" />
        <span>Tối</span>
      </button>
    </div>
  );
}
