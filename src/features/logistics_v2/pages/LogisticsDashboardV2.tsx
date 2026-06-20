import React, { useState, useEffect } from "react";
import { LogisticsLayoutV2 } from "../components/LogisticsLayoutV2";
import { ShipmentFeedV2 } from "../components/ShipmentFeedV2";
import { motion } from "framer-motion";
import { TrendingUp, Package, Clock, MapPin, ShieldCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LogisticsSettings } from "@/features/logistics/components/LogisticsSettings";
import { LogisticsKYC } from "@/features/logistics/components/LogisticsKYC";
import { LogisticsEarnings } from "@/features/logistics/components/LogisticsEarnings";
import { ProfileCompletionBanner } from "@/shared/components/ProfileCompletionBanner";
import { EditProfileModal } from "@/features/user/components/EditProfileModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

export default function LogisticsDashboardV2() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

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
                .select("is_online, city_id, zone_id")
                .eq("id", user?.id)
                .maybeSingle();

            return {
                balance: walletData?.balance || 0,
                escrow_balance: walletData?.escrow_balance || 0,
                is_online: profileData?.is_online || false,
                city_id: profileData?.city_id,
                zone_id: profileData?.zone_id
            };
        },
        enabled: !!user,
    });

    const { data: kycStatus } = useQuery({
        queryKey: ["rider-kyc-status-v2", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("logistics_kyc")
                .select("status")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            return data?.status?.trim()?.toLowerCase() || "none";
        },
        enabled: !!user,
    });

    const toggleOnlineStatus = async (checked: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from("profiles")
                .update({ is_online: checked })
                .eq("id", user?.id);

            if (error) throw error;

            await queryClient.invalidateQueries({ queryKey: ["logistics-details", user?.id] });

            toast.success(checked ? "You are now ONLINE" : "You are now OFFLINE", {
                description: checked ? "You can now receive new assignments." : "You won't receive new mission alerts.",
            });
        } catch (error: any) {
            toast.error("Status update failed: " + error.message);
        }
    };

    // Real-time synchronization
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`rider-v2-rt-${user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
                () => queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] }))
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
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
            isOnline={details?.is_online || false}
            onOnlineToggle={toggleOnlineStatus}
            kycStatus={kycStatus}
        >
            <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6">
                <ProfileCompletionBanner onAction={() => setIsEditProfileOpen(true)} />
                <EditProfileModal open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} />

                {kycStatus === "pending" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-100/50 p-3 rounded-2xl shrink-0">
                                <Clock className="text-amber-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-amber-900 tracking-tight uppercase">Verification Pending</h3>
                                <p className="text-[11px] text-amber-700 font-bold tracking-widest uppercase mt-0.5">Your application is under review by our team.</p>
                            </div>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full sm:w-auto border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest"
                            onClick={() => setActiveTab("verification")}
                        >
                            View Status
                        </Button>
                    </div>
                )}

                {kycStatus === "none" && (
                    <div className="bg-[#FFF7F2] border border-[#E96F28]/20 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#E96F28]/10 p-3 rounded-2xl shrink-0">
                                <ShieldCheck className="text-[#E96F28]" size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-[#E96F28] tracking-tight uppercase">Identity Verification Required</h3>
                                <p className="text-[11px] text-[#E96F28]/70 font-bold tracking-widest uppercase mt-0.5">Complete your KYC to unlock missions.</p>
                            </div>
                        </div>
                        <Button 
                            size="sm" 
                            className="w-full sm:w-auto bg-[#E96F28] hover:bg-[#E96F28]/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest px-6 shadow-xl shadow-orange-600/20"
                            onClick={() => setActiveTab("verification")}
                        >
                            Verify Now
                        </Button>
                    </div>
                )}

                {kycStatus === "rejected" && (
                    <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <div className="bg-red-100/50 p-3 rounded-2xl shrink-0">
                                <AlertTriangle className="text-red-600" size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-red-900 tracking-tight uppercase">Verification Rejected</h3>
                                <p className="text-[11px] text-red-700 font-bold tracking-widest uppercase mt-0.5">Please update your documents and resubmit.</p>
                            </div>
                        </div>
                        <Button 
                            size="sm" 
                            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest px-6 shadow-xl shadow-red-600/20"
                            onClick={() => setActiveTab("verification")}
                        >
                            Resubmit
                        </Button>
                    </div>
                )}

                {activeTab === "dashboard" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Hero Section / Stats Overview (Desktop) */}
                        <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: "Active Deliveries", value: "...", icon: Package, color: "text-[#E96F28]", bg: "bg-[#FFF7F2]" },
                                { label: "Ready Balance", value: `₦ ${(details?.balance || 0).toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { label: "Safety Hold", value: `₦ ${(details?.escrow_balance || 0).toLocaleString()}`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },

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
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground pl-1">My Active Deliveries</h2>
                            </div>
                            <ShipmentFeedV2 defaultFilter="active" />
                        </div>
                    </div>
                )}

                {activeTab === "orders" && (
                    <div className="space-y-6">
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground pl-1">Available Missions</h2>
                        <ShipmentFeedV2 defaultFilter="all" />
                    </div>
                )}

                {activeTab === "earnings" && (
                    <div className="bg-white rounded-[40px] border border-black/[0.04] p-8 shadow-sm">
                        <LogisticsEarnings />
                    </div>
                )}

                {activeTab === "verification" && (
                    <div className="bg-white rounded-[40px] border border-black/[0.04] p-8 shadow-sm">
                        <LogisticsKYC />
                    </div>
                )}

                {activeTab === "settings" && (
                    <div className="bg-white rounded-[40px] border border-black/[0.04] p-8 shadow-sm">
                        <LogisticsSettings details={details as any} />
                    </div>
                )}
            </div>
        </LogisticsLayoutV2>
    );
}
