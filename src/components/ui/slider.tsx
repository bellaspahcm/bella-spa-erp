"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}

export function Slider({
  className,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  ...props
}: SliderProps) {
  const val = value?.[0] ?? min
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const newValue = Number(e.target.value)
    onValueChange?.([newValue])
  }

  // Tính toán phần trăm thanh kéo
  const percentage = ((val - min) / (max - min)) * 100

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center py-2", className)}>
      {/* Track nền và vệt màu đã kéo */}
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
        <div 
          className="absolute h-full bg-primary rounded-full transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Input range native ẩn để bắt sự kiện và hỗ trợ bàn phím */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        disabled={disabled}
        onChange={handleChange}
        className={cn(
          "absolute w-full h-6 opacity-0 cursor-pointer z-10",
          disabled && "cursor-not-allowed"
        )}
        {...props}
      />

      {/* Thumb giả lập thiết kế cao cấp */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 pointer-events-none size-5 rounded-full border-2 border-primary bg-background shadow-md transition-all duration-75",
          disabled ? "bg-slate-200 border-slate-300" : "hover:scale-110 active:scale-95"
        )}
        style={{ left: `calc(${percentage}% - 10px)` }}
      />
    </div>
  )
}
