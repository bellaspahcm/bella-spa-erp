import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// LAYOUT WRAPPER - Page container với Bella spacing
// ============================================================================
interface IntelligenceLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function IntelligenceLayout({ children, className }: IntelligenceLayoutProps) {
  return (
    <div className={cn("flex-1 overflow-auto bg-background/30 p-4 sm:p-6 md:p-10", className)}>
      {children}
    </div>
  );
}

// ============================================================================
// HEADER - Intelligence page header với icon và description
// ============================================================================
interface IntelligenceHeaderProps {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}

export function IntelligenceHeader({ 
  icon: Icon, 
  label, 
  title, 
  description, 
  actions 
}: IntelligenceHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Icon className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">{label}</span>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-950 md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-muted-foreground">
          {description}
        </p>
      </div>

      {actions && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SECTION - Card container cho content sections
// ============================================================================
interface IntelligenceSectionProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export function IntelligenceSection({ 
  title, 
  description,
  icon: Icon,
  children, 
  className,
  headerActions
}: IntelligenceSectionProps) {
  return (
    <section className={cn("rounded-[2rem] border border-rose-100 bg-white p-5 shadow-sm md:p-6", className)}>
      {(title || headerActions) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {title && (
            <div className="flex items-center gap-3">
              {Icon && <Icon className="h-5 w-5 text-primary" />}
              <div>
                <h2 className="text-lg font-black text-slate-950">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
                )}
              </div>
            </div>
          )}
          {headerActions && <div className="flex items-center gap-3">{headerActions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ============================================================================
// BUTTON - Bella-style button component
// ============================================================================
interface IntelligenceButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  className?: string;
}

export function IntelligenceButton({
  children,
  onClick,
  disabled = false,
  variant = 'outline',
  size = 'md',
  icon: Icon,
  className
}: IntelligenceButtonProps) {
  const baseClasses = "inline-flex items-center justify-center gap-2 rounded-2xl font-black transition disabled:opacity-50";
  
  const variantClasses = {
    primary: "bg-primary text-white shadow-xl shadow-rose-100 hover:bg-primary/90",
    secondary: "bg-slate-950 text-white shadow-xl shadow-slate-200 hover:bg-slate-800",
    outline: "border border-rose-100 bg-white text-slate-700 shadow-sm hover:border-rose-200 hover:text-primary"
  };

  const sizeClasses = {
    sm: "px-4 py-2 text-xs",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-4 text-sm"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
