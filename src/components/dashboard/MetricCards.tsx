import { Badge } from "@/components/ui/badge";
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
        <div className="p-8 rounded-[2.5rem] bg-white border border-black/[0.03] shadow-xl shadow-black/[0.01] hover:shadow-2xl hover:shadow-black/[0.03] transition-all duration-500 group">
            <div className="flex justify-between items-start mb-6">
                <div className={cn("w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-white duration-500", color)}>
                    <Icon size={24} strokeWidth={2} />
                </div>
                {trend && (
                    <Badge className="bg-green-50 text-green-600 border-none rounded-full px-3 text-[9px] font-black uppercase tracking-widest">{trend}</Badge>
                )}
                {status && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">{status}</span>
                    </div>
                )}
            </div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{title}</p>
            <p className="text-3xl font-black text-foreground tracking-tight">{value}</p>
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
        <div className="p-6 rounded-[2rem] bg-white border border-black/5 shadow-sm space-y-3 hover:scale-[1.02] transition-transform">
            <div className={cn("w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center text-muted-foreground", color)}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</p>
                <p className="text-xl font-black tracking-tight">{value}</p>
            </div>
        </div>
    );
}
