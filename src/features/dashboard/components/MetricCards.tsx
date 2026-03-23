import { Badge } from "@/shared/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    status?: string;
    color?: string;
}

export function MetricCard({ title, value, icon: Icon, trend, status, color }: MetricCardProps) {
    return (
        <div className="p-5 rounded-xl bg-white border border-black/[0.03] shadow-xl shadow-black/[0.01] hover:shadow-2xl hover:shadow-black/[0.03] transition-all duration-500 group">
            <div className="flex justify-between items-start mb-4">
                <div className={cn("w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white duration-500", color)}>
                    <Icon size={20} strokeWidth={2} />
                </div>
                {trend && (
                    <Badge className="bg-green-50 text-green-600 border-none rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest">{trend}</Badge>
                )}
                {status && (
                    <div className="flex items-center gap-1 px-2.5 py-0.5 bg-primary/5 rounded-full">
                        <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">{status}</span>
                    </div>
                )}
            </div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{title}</p>
            <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
        </div>
    );
}

interface AnalyticMetricProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color?: string;
}

export function AnalyticMetric({ label, value, icon: Icon, color }: AnalyticMetricProps) {
    return (
        <div className="p-4 rounded-xl bg-white border border-black/5 shadow-sm space-y-2 hover:scale-[1.02] transition-transform">
            <div className={cn("w-9 h-9 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground", color)}>
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="text-lg font-black tracking-tight">{value}</p>
            </div>
        </div>
    );
}
