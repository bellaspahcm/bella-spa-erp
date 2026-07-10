'use client';

interface RulePrioritySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function RulePrioritySlider({ value, onChange }: RulePrioritySliderProps) {
  return (
    <div className="space-y-4">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        min={0}
        max={1000}
        step={10}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low (0)</span>
        <span>Normal (500)</span>
        <span>High (1000)</span>
      </div>
    </div>
  );
}
