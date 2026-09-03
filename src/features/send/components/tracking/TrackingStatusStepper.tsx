import React from 'react';
import {
  Search,
  UserCheck,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Check,
} from 'lucide-react';
import { SendOrderStatus } from '../../types';
import { cn } from '@/lib/utils';

interface StepperProps {
  currentStatus: SendOrderStatus;
  estimatedDeliveryTime?: string | null;
}

const STAGES: {
  key: SendOrderStatus;
  label: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    key: 'finding_rider',
    label: 'Finding Rider',
    desc: 'Broadcasting request to nearby logistics agents',
    icon: Search,
  },
  {
    key: 'assigned_rider',
    label: 'Rider Assigned',
    desc: 'Rider matched and heading to pickup location',
    icon: UserCheck,
  },
  {
    key: 'pickup',
    label: 'Package Picked Up',
    desc: 'Package collected and verified by rider',
    icon: Package,
  },
  {
    key: 'on_the_way',
    label: 'On the Way',
    desc: 'Rider en route to destination with live coordinates',
    icon: Truck,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    desc: 'Package delivered safely to recipient',
    icon: CheckCircle2,
  },
];

export function TrackingStatusStepper({ currentStatus, estimatedDeliveryTime }: StepperProps) {
  const getStageIndex = (status: SendOrderStatus): number => {
    switch (status) {
      case 'pending_payment':
        return -1;
      case 'finding_rider':
        return 0;
      case 'assigned_rider':
        return 1;
      case 'pickup':
        return 2;
      case 'on_the_way':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 0;
    }
  };

  const activeIndex = getStageIndex(currentStatus);

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b">
        <div>
          <h3 className="text-sm font-bold font-heading text-foreground">Delivery Milestones</h3>
          <p className="text-[11px] text-muted-foreground">Real-time lifecycle tracking</p>
        </div>
        {estimatedDeliveryTime && (
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Estimated Arrival
            </span>
            <span className="text-xs font-extrabold text-primary flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" />
              {new Date(estimatedDeliveryTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 relative">
        {/* Timeline connecting line */}
        <div className="absolute left-4 top-2 bottom-4 w-0.5 bg-muted -z-0" />

        {STAGES.map((stage, idx) => {
          const isDone = activeIndex > idx;
          const isCurrent = activeIndex === idx;
          const isPending = activeIndex < idx;
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex items-start gap-3.5 relative z-10">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 border-2',
                  isDone
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-primary border-primary text-white shadow-md ring-4 ring-primary/20 scale-105'
                    : 'bg-background border-muted text-muted-foreground'
                )}
              >
                {isDone ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <Icon className={cn('w-4 h-4', isCurrent && 'animate-pulse')} />
                )}
              </div>

              <div className="flex-1 pt-0.5">
                <div className="flex items-center justify-between">
                  <h4
                    className={cn(
                      'text-xs font-bold font-heading',
                      isCurrent
                        ? 'text-primary'
                        : isDone
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {stage.label}
                  </h4>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary animate-pulse">
                      In Progress
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] font-semibold text-emerald-600">Completed</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {stage.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
