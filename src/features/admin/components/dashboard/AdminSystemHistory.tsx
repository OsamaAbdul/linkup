import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Search, Printer, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export default function AdminSystemHistory() {
    const { data: logs, isLoading: logsLoading } = useQuery({
        queryKey: ["admin-audit-logs"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("audit_logs")
                .select("*, profiles:actor_id(display_name)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 10, // 10 minutes
    });

    const { data: allOrders } = useQuery({
        queryKey: ["admin-all-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*");
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 2,
    });

    const getTargetContext = (targetId: string) => {
        return allOrders?.find(o => o.id === targetId);
    };

    const [actionFilter, setActionFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredLogs = logs?.filter(log => {
        const matchesAction = actionFilter === "all" || log.action === actionFilter;
        const matchesSearch = log.profiles?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.target_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesAction && matchesSearch;
    });

    const handlePrint = () => {
        window.print();
    };

    if (logsLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-xl">Loading activity list...</div>;

    const actionTypes = Array.from(new Set(logs?.map(l => l.action) || []));

    return (
        <div className="space-y-6 print:p-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
                <div className="space-y-4 flex-1">
                    <h2 className="text-2xl font-black">System Activity Records</h2>
                    <div className="flex flex-wrap gap-4">
                        <div className="relative w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type="text"
                                placeholder="Search anything..."
                                className="w-full h-11 bg-white border-none rounded-xl pl-12 pr-4 text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            className="h-11 px-4 rounded-xl border-none shadow-sm bg-white text-sm font-bold min-w-[180px] focus:ring-2 focus:ring-primary/20 transition-all"
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                        >
                            <option value="all">All Actions</option>
                            {actionTypes.map((type: any) => (
                                <option key={type} value={type}>{type.replace(/_/g, ' ').toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <Button className="rounded-xl font-black bg-primary h-11 px-8 shadow-xl shadow-primary/20" onClick={handlePrint}>
                    <Printer size={18} className="mr-2" /> Print Activity List
                </Button>
            </div>

            <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden print:shadow-none print:rounded-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date & Time</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Action Taken</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Who did it</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">ID or Item</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLogs?.map((log: any) => (
                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-6 text-xs font-medium font-mono text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-8 py-6">
                                        <Badge className="rounded-full bg-blue-50 text-blue-700 border-none text-[8px] font-black uppercase tracking-widest">
                                            {log.action}
                                        </Badge>
                                    </td>
                                    <td className="px-8 py-6 font-bold text-sm">
                                        {log.profiles?.display_name || "SYSTEM"}
                                    </td>
                                    <td className="px-8 py-6 font-mono text-[10px] text-muted-foreground">
                                        <div className="flex flex-col gap-1.5">
                                            <span>{log.target_id?.slice(0, 12) || "GLOBAL"}</span>
                                            {log.target_id && getTargetContext(log.target_id) && (
                                                <Badge variant="outline" className="w-fit rounded-lg bg-indigo-50 border-indigo-100 text-[8px] font-bold text-indigo-700 py-0.5 px-2 flex items-center gap-1">
                                                    <ShoppingBag className="w-2.5 h-2.5" />
                                                    ORDER: {getTargetContext(log.target_id)?.status.toUpperCase()}
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8" onClick={() => toast.info(JSON.stringify(log.details, null, 2))}>
                                            <Search size={14} />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center font-bold text-muted-foreground italic">No activity found for these filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

