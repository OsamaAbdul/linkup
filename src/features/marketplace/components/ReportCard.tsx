import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { AlertCircle, Calendar, MessageSquare, ShieldAlert, CheckCircle2, Gavel } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ReportCardProps {
    issue: any;
}

export function ReportCard({ issue }: ReportCardProps) {
    const isResolved = issue.status === 'resolved';

    return (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden group transition-all duration-300 hover:shadow-xl hover:shadow-black/5 ring-1 ring-black/[0.03]">
            <div className="flex flex-col sm:flex-row h-full">
                {/* Category Sidebar */}
                <div className={cn(
                    "w-full sm:w-2 flex-shrink-0 transition-colors",
                    issue.category === 'financial_dispute' ? "bg-red-500" : 
                    issue.category === 'security' ? "bg-amber-500" : "bg-blue-500"
                )} />

                <div className="flex-1 p-5 sm:p-6 space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
                                issue.category === 'financial_dispute' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                            )}>
                                {issue.category === 'financial_dispute' ? <Gavel size={20} /> : <AlertCircle size={20} />}
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors">
                                    {issue.title}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">
                                    <Calendar size={10} />
                                    {format(new Date(issue.created_at), "MMM d, yyyy • HH:mm")}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start">
                            <Badge className={cn(
                                "text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full",
                                issue.status === 'open' ? "bg-red-50 text-red-600 border border-red-100" :
                                issue.status === 'resolved' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                "bg-gray-100 text-gray-500"
                            )}>
                                {issue.status}
                            </Badge>
                            <span className="text-[10px] font-mono font-bold text-muted-foreground opacity-30 group-hover:opacity-100 transition-opacity">
                                #{issue.id.slice(0, 8).toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-gray-50/50 rounded-xl p-4 border border-black/[0.02]">
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed italic">
                            "{issue.description}"
                        </p>
                    </div>

                    {/* Related Entities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {issue.product && (
                            <div className="flex items-center gap-3 bg-white/10 p-2 rounded-lg border border-black/[0.02]">
                                <div className="h-8 w-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                    {issue.product.images?.[0] && <img src={issue.product.images[0]} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Involved Asset</p>
                                    <p className="text-[10px] font-bold truncate">{issue.product.title}</p>
                                </div>
                            </div>
                        )}
                        {issue.seller && (
                            <div className="flex items-center gap-2 px-2 py-1">
                                <ShieldAlert size={12} className="text-muted-foreground" />
                                <span className="text-[10px] font-medium text-muted-foreground tracking-tight">Counterparty: <span className="font-bold text-foreground underline decoration-1 underline-offset-2">{issue.seller.display_name}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Resolution Section */}
                    {isResolved && issue.resolution_meta && (
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-100 animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Official Adjudication Result</p>
                            </div>
                            <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/50 space-y-2">
                                <p className="text-xs font-black text-emerald-800">
                                    Mechanism: {issue.resolution_meta.resolution === 'refund' ? "Asset Price Reversion (Refund)" : "Escrow Finalization (Funds Released)"}
                                </p>
                                <p className="text-[11px] font-medium text-emerald-700/80 leading-relaxed italic">
                                    "{issue.resolution_meta.notes || "This case has been successfully adjudicated by the system administration."}"
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
