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
      toast.success('Đã kích hoạt chế độ tối sang trọng!');
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('Đã kích hoạt giao diện sáng!');
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
      <div className="beauty-theme-toggle-skeleton h-10 w-full bg-slate-100 dark:bg-slate-900/50 rounded-xl animate-pulse" />
    );
  }

  return (
    <div className="beauty-theme-toggle w-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 p-1 rounded-2xl flex items-center justify-between gap-2 relative shadow-inner">
      {/* Light Mode Pill */}
      <button
        type="button"
        onClick={() => toggleTheme('light')}
        className={`beauty-theme-toggle-button ${theme === 'light' ? 'beauty-theme-toggle-button-active' : ''} flex-1 relative z-10 py-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wide transition-all duration-300 ${
          theme === 'light'
            ? 'text-indigo-600 dark:text-indigo-400 font-extrabold'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        {theme === 'light' && (
          <motion.div
            layoutId="active-theme-pill"
            className="beauty-theme-toggle-active-light absolute inset-0 bg-white shadow-sm border border-slate-200 rounded-xl z-[-1]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Sun className="w-3.5 h-3.5" />
        <span>Sáng</span>
      </button>

      {/* Dark Mode Pill */}
      <button
        type="button"
        onClick={() => toggleTheme('dark')}
        className={`beauty-theme-toggle-button ${theme === 'dark' ? 'beauty-theme-toggle-button-active' : ''} flex-1 relative z-10 py-2 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wide transition-all duration-300 ${
          theme === 'dark'
            ? 'text-white font-extrabold'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
        }`}
      >
        {theme === 'dark' && (
          <motion.div
            layoutId="active-theme-pill"
            className="beauty-theme-toggle-active-dark absolute inset-0 bg-slate-800 shadow-md border border-slate-700 rounded-xl z-[-1]"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <Moon className="w-3.5 h-3.5" />
        <span>Tối</span>
      </button>
    </div>
  );
}
