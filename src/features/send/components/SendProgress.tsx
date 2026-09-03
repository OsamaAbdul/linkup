import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SendProgressProps {
  currentStep: number; // 1 to 5
}

export function SendProgress({ currentStep }: SendProgressProps) {
  const steps = [
    { number: 1, title: 'Package', subtitle: 'Details' },
    { number: 2, title: 'Pickup', subtitle: 'Location' },
    { number: 3, title: 'Drop-off', subtitle: 'Location' },
    { number: 4, title: 'Review', subtitle: '& Price' },
    { number: 5, title: 'Confirm', subtitle: '& Pay' },
  ];

  return (
    <div className="w-full px-1 py-4 sm:py-6">
      <div className="max-w-xl mx-auto relative flex items-center justify-between">
        {/* Background Connecting Line */}
        <div className="absolute left-6 right-6 top-4 h-[2px] bg-muted -z-0" />

        {/* Active Orange Line */}
        <div
          className="absolute left-6 top-4 h-[2px] bg-primary -z-0 transition-all duration-300 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, ((currentStep - 1) / (steps.length - 1)) * 100))}%`,
          }}
        />

        {steps.map((s) => {
          const isCompleted = currentStep > s.number;
          const isCurrent = currentStep === s.number;

          return (
            <div key={s.number} className="flex flex-col items-center relative z-10 w-16 sm:w-20 text-center">
              <div
                className={cn(
                  'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all duration-200 shadow-sm',
                  isCompleted
                    ? 'bg-primary text-white border-2 border-primary'
                    : isCurrent
                    ? 'bg-primary text-white border-2 border-primary ring-4 ring-primary/20 scale-105'
                    : 'bg-background text-muted-foreground border-2 border-muted'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.number}
              </div>

              <div className="mt-1.5 leading-tight">
                <span
                  className={cn(
                    'text-[10px] sm:text-[11px] font-bold block transition-colors',
                    isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {s.title}
                </span>
                <span
                  className={cn(
                    'text-[9px] sm:text-[10px] block transition-colors',
                    isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {s.subtitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
