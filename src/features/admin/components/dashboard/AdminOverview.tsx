import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
    AlertTriangle, ShoppingBag, Users, TrendingUp, Filter, Printer, ArrowUpRight, Loader2, Play, Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminOverview() {
    const { data: revenueData, isLoading: isRevLoading } = useQuery({
        queryKey: ["admin-revenue"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_admin_revenue");
            if (error) {
                console.error("REVENUE_ERROR", error);
                (window as any).LATEST_REVENUE_ERROR = error;
            }
            console.log("REVENUE_SUCCESS", data);
            (window as any).LATEST_REVENUE_DATA = data;
            return data || 0;
        },
    });

    console.log("this is the admin ledger", revenueData);

    const { data: activeOrdersCount, isLoading: isActiveOrdersLoading } = useQuery({
        queryKey: ["admin-active-orders-count"],
        queryFn: async () => {
            const { count, error } = await supabase
                .from("orders")
                .select("*", { count: 'exact', head: true })
                .not("status", "in", '("completed", "cancelled", "refunded", "delivered")');
            if (error) throw error;


            return count || 0;
        },
        staleTime: 1000 * 60 * 2,
    });

    const { data: totalOrdersCount, isLoading: isTotalOrdersLoading } = useQuery({
        queryKey: ["admin-total-orders-count"],
        queryFn: async () => {
            const { count, error } = await supabase
                .from("orders")
                .select("*", { count: 'exact', head: true });
            if (error) throw error;
            return count || 0;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes


    });

    const { data: usersCount, isLoading: isUsersLoading } = useQuery({
        queryKey: ["admin-users-count"],
        queryFn: async () => {
            const { count, error } = await supabase
                .from("profiles")
                .select("*", { count: 'exact', head: true });
            if (error) throw error;
            return count || 0;
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
    });

    const { data: openIssuesCount, isLoading: isIssuesLoading } = useQuery({
        queryKey: ["admin-open-issues-count"],
        queryFn: async () => {
            const { count, error } = await (supabase as any)
                .from("issues")
                .select("*", { count: 'exact', head: true })
                .eq("status", "open");
            if (error) throw error;
            return count || 0;
        },
        staleTime: 1000 * 60 * 1, // 1 minute
    });

    const { data: criticalAlerts } = useQuery({
        queryKey: ["admin-critical-alerts"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("issues")
                .select("*, profiles!issues_reporter_profile_fkey(display_name)")
                .in("priority", ["high", "critical"])
                .eq("status", "open")
                .order("created_at", { ascending: false })
                .limit(4);
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 1, // 1 minute
    });

    const [isSettling, setIsSettling] = useState(false);

    const handleForceSettlement = async () => {
        if (!confirm("TESTING ONLY: Are you sure you want to move ALL held funds to main balances? This will pay out all pending transactions immediately.")) {
            return;
        }

        try {
            setIsSettling(true);
            const { data, error } = await (supabase as any).rpc("test_move_all_escrow_to_balance");

            if (error) throw error;

            const result = data as any;
            if (result.success) {
                toast.success(result.message || "All funds released successfully");
                // Refresh data
                window.location.reload();
            } else {
                toast.error("Settlement failed");
            }
        } catch (error: any) {
            console.error("Settlement Error:", error);
            toast.error(error.message || "Failed to trigger settlement");
        } finally {
            setIsSettling(false);
        }
    };

    const stats = [
        { label: "Total Sales", value: revenueData, icon: TrendingUp, loading: isRevLoading, isCurrency: true },
        { label: "Ongoing Orders", value: activeOrdersCount, icon: ShoppingBag, loading: isActiveOrdersLoading },
        { label: "Total Orders", value: totalOrdersCount, icon: Package, loading: isTotalOrdersLoading },
        { label: "Total Users", value: usersCount, icon: Users, loading: isUsersLoading },
        { label: "Complaints", value: openIssuesCount, icon: AlertTriangle, loading: isIssuesLoading },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Platform Summary</h1>
                    <p className="text-muted-foreground font-medium">How the store is doing right now.</p>
                </div>

                {import.meta.env.DEV && (
                    <div className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-700 delay-300">
                        <div className="hidden md:flex flex-col items-end mr-2 text-right">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Debug Mode Active</span>
                            <span className="text-[9px] text-muted-foreground font-medium italic">Development testing tools enabled</span>
                        </div>
                        <Button
                            onClick={handleForceSettlement}
                            disabled={isSettling}
                            variant="outline"
                            className="rounded-2xl border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 h-14 px-8 gap-3 font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/10 transition-all active:scale-95 group"
                        >
                            {isSettling ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Play size={18} className="fill-current group-hover:scale-110 transition-transform" />
                            )}
                            {isSettling ? "Paying..." : "Release Held Money"}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {stats.map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm rounded-xl bg-white group hover:shadow-md transition-all duration-300">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                    <stat.icon size={20} strokeWidth={2.5} />
                                </div>

                            </div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">{stat.label}</p>
                            <div className="text-xl font-black text-foreground mt-1">
                                {stat.loading ? (
                                    <div className="h-7 w-20 bg-gray-100 animate-pulse rounded-lg" />
                                ) : (
                                    <>
                                        {stat.isCurrency && "₦ "}
                                        {(stat.value || 0).toLocaleString()}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm rounded-xl bg-white overflow-hidden">
                    <CardHeader className="p-8 pb-0">
                        <CardTitle className="text-xl font-black">Urgent Updates</CardTitle>
                        <CardDescription className="font-medium">Important tasks that need your attention.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        {criticalAlerts?.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground font-medium italic">No critical alerts detected in the system.</div>
                        ) : criticalAlerts?.map((issue: any) => (
                            <div key={issue.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group/alert">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    issue.priority === 'critical' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                                )}>
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold line-clamp-1">{issue.title}</p>
                                    <p className="text-xs text-muted-foreground font-medium">
                                        Agent: {issue.profiles?.display_name || "Unknown"}  {new Date(issue.created_at).toLocaleTimeString()}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" className="rounded-xl group-hover/alert:bg-white group-hover/alert:shadow-sm">
                                    <ArrowUpRight size={18} />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>


            </div>
        </div>
    );
}

