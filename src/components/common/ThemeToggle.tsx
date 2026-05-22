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
    <div className="w-full bg-slate-100/60 dark:bg-slate-900/40 backdrop-blur-md border border-rose-100/20 dark:border-white/5 p-1 rounded-2xl flex items-center justify-between relative shadow-inner">
      <div className="absolute inset-0 bg-gradient-to-r from-rose-200/5 to-rose-300/5 pointer-events-none rounded-2xl" />
      
      {/* Light Mode Pill */}
      <button
        onClick={() => toggleTheme('light')}
        className={`flex-1 relative z-10 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
          theme === 'light'
            ? 'text-primary'
            : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'
        }`}
      >
        {theme === 'light' && (
          <motion.div
            layoutId="active-theme-pill"
            className="absolute inset-0 bg-white shadow-sm border border-rose-50 rounded-xl z-[-1]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Sun className="w-3.5 h-3.5" />
        <span>Sáng</span>
      </button>

      {/* Dark Mode Pill */}
      <button
        onClick={() => toggleTheme('dark')}
        className={`flex-1 relative z-10 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
          theme === 'dark'
            ? 'text-white'
            : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'
        }`}
      >
        {theme === 'dark' && (
          <motion.div
            layoutId="active-theme-pill"
            className="absolute inset-0 bg-gradient-to-br from-purple-950 to-slate-900 shadow-md border border-purple-500/20 rounded-xl z-[-1]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Moon className="w-3.5 h-3.5" />
        <span>Tối</span>
      </button>
    </div>
  );
}
