import React from 'react';
import { RefreshCw, AlertCircle, CalendarDays } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ============================================================================
// LOADING STATE - Loading indicator với message
// ============================================================================
interface IntelligenceLoadingProps {
  message?: string;
  className?: string;
}

export function IntelligenceLoading({ 
  message = "Đang tải dữ liệu...",
  className 
}: IntelligenceLoadingProps) {
  return (
    <div className={className || "flex h-72 items-center justify-center"}>
      <div className="flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm font-semibold">{message}</span>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR STATE - Error alert với message
// ============================================================================
interface IntelligenceErrorProps {
  title?: string;
  message: string;
  className?: string;
}

export function IntelligenceError({ 
  title = "Lỗi khi tải dữ liệu",
  message,
  className 
}: IntelligenceErrorProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

// ============================================================================
// EMPTY STATE - Empty state với icon và message
// ============================================================================
interface IntelligenceEmptyProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function IntelligenceEmpty({ 
  title = "Chưa có dữ liệu",
  message = "Hệ thống chưa có dữ liệu để hiển thị. Vui lòng thử lại sau.",
  icon,
  className 
}: IntelligenceEmptyProps) {
  return (
    <div className={className || "flex h-72 flex-col items-center justify-center px-6 text-center"}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-primary">
        {icon || <CalendarDays className="h-8 w-8" />}
      </div>
      <p className="text-lg font-black text-slate-900">{title}</p>
      <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
        {message}
      </p>
    </div>
  );
}

// ============================================================================
// REFRESHING INDICATOR - Fixed loading indicator khi refresh
// ============================================================================
interface IntelligenceRefreshingProps {
  message?: string;
}

export function IntelligenceRefreshing({ 
  message = "Đang làm mới dữ liệu" 
}: IntelligenceRefreshingProps) {
  return (
    <div className="fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-rose-100 bg-white px-4 py-2 text-xs font-black text-primary shadow-xl">
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      {message}
    </div>
  );
}
