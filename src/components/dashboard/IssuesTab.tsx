import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShoppingBag, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function IssuesTab() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: issues, isLoading } = useQuery({
        queryKey: ["seller-issues", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("issues" as any)
                .select("*, profiles!issues_user_id_fkey(display_name), products(title)")
                .eq("seller_id", user?.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id,
    });

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`seller-issues-realtime-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'issues',
                    filter: `seller_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["seller-issues", user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, queryClient]);

    if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse font-bold">Retrieving Security Tickets...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight">Issue Resolution Hub</h2>
                <p className="text-muted-foreground font-medium">Monitor and manage reports linked to your inventory.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {issues?.length === 0 ? (
                    <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="text-emerald-500 opacity-40" size={32} />
                        </div>
                        <h3 className="font-black text-xl mb-2">Operational Integrity Maintained</h3>
                        <p className="text-muted-foreground font-medium max-w-xs mx-auto text-sm">No security tickets or performance anomalies detected in your sector.</p>
                    </div>
                ) : (
                    issues?.map((issue: any) => (
                        <Card key={issue.id} className="border-none shadow-sm rounded-[2.5rem] bg-white hover:shadow-xl transition-all duration-500 overflow-hidden group">
                            <CardContent className="p-0 flex flex-col md:flex-row">
                                <div className={cn(
                                    "w-full md:w-2 py-8 md:py-0",
                                    issue.priority === 'critical' ? 'bg-red-500' :
                                        issue.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                                )} />

                                <div className="flex-1 p-8 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <Badge className={cn(
                                                    "rounded-full text-[9px] font-black uppercase tracking-widest",
                                                    issue.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                                        issue.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                )}>
                                                    {issue.priority} priority
                                                </Badge>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ticket #{issue.id.slice(0, 8)}</span>
                                            </div>
                                            <h3 className="text-xl font-black tracking-tight mt-2">{issue.title}</h3>
                                        </div>
                                        <Badge variant="outline" className={cn(
                                            "rounded-xl px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-2",
                                            issue.status === 'open' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                                                'border-emerald-200 text-emerald-700 bg-emerald-50'
                                        )}>
                                            {issue.status}
                                        </Badge>
                                    </div>

                                    <div className="bg-gray-50/50 p-6 rounded-3xl border border-black/[0.03]">
                                        <p className="text-sm font-medium leading-relaxed text-foreground/80">{issue.description}</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Reporter</p>
                                                <p className="text-xs font-bold">{issue.profiles?.display_name || "Nexus Agent"}</p>
                                            </div>
                                        </div>

                                        {issue.order_id && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                                    <ShoppingBag size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Linked Order</p>
                                                    <p className="text-xs font-bold text-primary">#{issue.order_id.slice(0, 12).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                                                <Calendar size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Broadcast Date</p>
                                                <p className="text-xs font-bold">{format(new Date(issue.created_at), "MMM d, yyyy")}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-2">
                                        <Button className="rounded-2xl h-12 px-8 font-black text-[11px] uppercase tracking-widest bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex-1">
                                            Contact Admin Support
                                        </Button>
                                        <Button variant="outline" className="rounded-2xl h-12 px-8 font-black text-[11px] uppercase tracking-widest border-2 flex-1">
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
