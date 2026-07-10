'use client';

import { Slider } from '@/components/ui/slider';

interface RulePrioritySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function RulePrioritySlider({ value, onChange }: RulePrioritySliderProps) {
  return (
    <div className="space-y-4">
      <Slider
        value={[value]}
        onValueChange={([newValue]) => onChange(newValue)}
        min={0}
        max={1000}
        step={10}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low (0)</span>
        <span>Normal (500)</span>
        <span>High (1000)</span>
      </div>
    </div>
  );
}
