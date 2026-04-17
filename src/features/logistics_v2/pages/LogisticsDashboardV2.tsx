import React, { useState, useEffect } from "react";
import { LogisticsLayoutV2 } from "../components/LogisticsLayoutV2";
import { ShipmentFeedV2 } from "../components/ShipmentFeedV2";
import { motion } from "framer-motion";
import { TrendingUp, Package, Clock, MapPin } from "lucide-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function LogisticsDashboardV2() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("dashboard");

    const { data: details } = useQuery({
        queryKey: ["logistics-details", user?.id],
        queryFn: async () => {
            // Fetch balance and escrow from wallets table
            const { data: walletData } = await (supabase as any)
                .from("wallets")
                .select("balance, escrow_balance")
                .eq("user_id", user?.id)
                .maybeSingle();

            // Fetch profile info
            const { data: profileData } = await (supabase as any)
                .from("profiles")
                .select("is_online")
                .eq("id", user?.id)
                .maybeSingle();

            return {
                balance: walletData?.balance || 0,
                escrow_balance: walletData?.escrow_balance || 0,
                is_online: profileData?.is_online
            };
        },
        enabled: !!user,
    });

    // Real-time synchronization
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`rider-v2-rt-${user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
                () => queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] }))
            .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" },
                () => queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] }))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id, queryClient]);

    return (
        <LogisticsLayoutV2 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            balance={details?.balance || 0}
            escrow_balance={details?.escrow_balance || 0}
        >
            {activeTab === "dashboard" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Hero Section / Stats Overview (Desktop) */}
                    <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: "Active Deliveries", value: "0", icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Ready Balance", value: `₦ ${(details?.balance || 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                            { label: "Safety Hold", value: `₦ ${(details?.escrow_balance || 0).toLocaleString()}`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Distance Covered", value: "48.2km", icon: MapPin, color: "text-indigo-600", bg: "bg-indigo-50" },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-6 rounded-[32px] border border-black/[0.04] shadow-sm hover:shadow-md transition-all duration-300">
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
                                    <stat.icon size={24} className={stat.color} strokeWidth={2.5} />
                                </div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                                <p className="text-2xl font-black text-foreground tracking-tight">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground pl-1">Recent Deliveries</h2>
                        </div>
                        <ShipmentFeedV2 />
                    </div>
                </div>
            )}

            {activeTab === "orders" && (
                <div className="space-y-6">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground pl-1">All Deliveries</h2>
                    <ShipmentFeedV2 />
                </div>
            )}

            {activeTab === "earnings" && (
                <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white rounded-[40px] border border-black/[0.04]">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
                        <TrendingUp size={40} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight mb-2">Earnings Dashboard</h2>
                    <p className="text-muted-foreground font-medium text-sm">₦ {(details?.balance || 0).toLocaleString()} Available / ₦ {(details?.escrow_balance || 0).toLocaleString()} Pending</p>
                </div>
            )}

            {(activeTab === "verification" || activeTab === "settings") && (
                <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white rounded-[40px] border border-black/[0.04]">
                    <div className="w-20 h-20 bg-gray-50 text-gray-400 rounded-3xl flex items-center justify-center mb-6">
                        <Package size={40} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight mb-2 uppercase">{activeTab} V2</h2>
                    <p className="text-muted-foreground font-medium text-sm">Please use the original Logistics Dashboard for this feature.</p>
                </div>
            )}
        </LogisticsLayoutV2>
    );
}

// Utility function for the main component
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
