'use client';

interface RulePrioritySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function RulePrioritySlider({ value, onChange }: RulePrioritySliderProps) {
  const percentage = (value / 1000) * 100;

  return (
    <div className="space-y-3 py-2 group">
      {/* Slider Visual Track & Inputs */}
      <div className="relative w-full h-6 flex items-center">
        {/* Underlay Track (Background) */}
        <div className="absolute inset-x-0 h-2.5 bg-slate-100 dark:bg-zinc-800 rounded-full border border-slate-200/60 dark:border-white/5 shadow-inner" />

        {/* Gradient Active Fill */}
        <div
          className="absolute left-0 h-2.5 bg-gradient-to-r from-primary via-primary-hover to-accent rounded-full pointer-events-none shadow-[0_0_10px_rgba(var(--primary-rgb),0.15)]"
          style={{ width: `${percentage}%` }}
        />

        {/* Dynamic Scale Notches */}
        <div className="absolute inset-x-0 flex justify-between px-1 pointer-events-none">
          {[0, 250, 500, 750, 1000].map((notch) => (
            <div
              key={notch}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                value >= notch
                  ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]'
                  : 'bg-slate-300/70 dark:bg-zinc-600/50'
              }`}
            />
          ))}
        </div>

        {/* Real Transparent Range Input with Styled Webkit Thumb */}
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          min={0}
          max={1000}
          step={10}
          className="absolute inset-x-0 w-full h-6 appearance-none bg-transparent cursor-pointer z-10 focus:outline-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-3
            [&::-webkit-slider-thumb]:border-primary
            [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.2),0_0_0_4px_rgba(var(--primary-rgb),0.1)]
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:duration-200
            [&::-webkit-slider-thumb]:hover:scale-120
            [&::-webkit-slider-thumb]:hover:border-primary-hover
            [&::-webkit-slider-thumb]:active:scale-110

            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-3
            [&::-moz-range-thumb]:border-primary
            [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.2)]
            [&::-moz-range-thumb]:transition-all
            [&::-moz-range-thumb]:duration-200
            [&::-moz-range-thumb]:hover:scale-120
            [&::-moz-range-thumb]:active:scale-110"
        />
      </div>

      {/* Dynamic Display and Labels */}
      <div className="flex justify-between items-center text-[10px] tracking-wider uppercase font-bold text-slate-400 dark:text-zinc-500">
        <span className={value < 300 ? 'text-primary transition-colors' : ''}>Thấp (0)</span>
        <span className={value >= 300 && value <= 700 ? 'text-primary transition-colors' : ''}>Trung bình (500)</span>
        <span className={value > 700 ? 'text-primary transition-colors' : ''}>Cao (1000)</span>
      </div>
    </div>
  );
}
