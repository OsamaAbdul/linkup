import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
    AlertTriangle, ShoppingBag, Users, TrendingUp, Filter, Printer, ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminOverview() {
    const { data: revenueData } = useQuery({
        queryKey: ["admin-revenue"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).rpc("get_admin_revenue");
            if (error) throw error;
            return data || 0;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const { data: activeOrdersCount } = useQuery({
        queryKey: ["admin-active-orders-count"],
        queryFn: async () => {
            const { count, error } = await supabase
                .from("orders")
                .select("*", { count: 'exact', head: true })
                .not("status", "in", '("completed", "cancelled", "refunded")');
            if (error) throw error;
            return count || 0;
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    const { data: usersCount } = useQuery({
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

    const { data: openIssuesCount } = useQuery({
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

    const stats = [
        { label: "Total Revenue", value: `${(revenueData || 0).toLocaleString()}`, icon: TrendingUp },
        { label: "Active Orders", value: (activeOrdersCount || 0).toString(), icon: ShoppingBag },
        { label: "Total Users", value: (usersCount || 0).toLocaleString(), icon: Users },
        { label: "Open Issues", value: (openIssuesCount || 0).toString(), icon: AlertTriangle },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">System Overview</h1>
                    <p className="text-muted-foreground font-medium">Real-time platform performance metrics.</p>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm rounded-xl bg-white group hover:shadow-xl transition-all duration-300">
                        <CardContent className="p-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                    <stat.icon size={24} strokeWidth={2.5} />
                                </div>

                            </div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">{stat.label}</p>
                            <p className="text-3xl font-black text-foreground mt-1">{stat.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-none shadow-sm rounded-xl bg-white overflow-hidden">
                    <CardHeader className="p-8 pb-0">
                        <CardTitle className="text-xl font-black">Recent Critical Alerts</CardTitle>
                        <CardDescription className="font-medium">High priority issues requiring administrative attention.</CardDescription>
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

