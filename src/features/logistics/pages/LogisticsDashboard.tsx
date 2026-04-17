import { useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Navigate } from "react-router-dom";
import { LogisticsHeader } from "@/features/logistics/components/LogisticsHeader";
import { LogisticsOverview } from "@/features/logistics/components/LogisticsOverview";
import { LogisticsEarnings } from "@/features/logistics/components/LogisticsEarnings";
import { LogisticsSettings } from "@/features/logistics/components/LogisticsSettings";
import { LogisticsKYC } from "@/features/logistics/components/LogisticsKYC";
import { LogisticsSidebar } from "@/features/logistics/components/LogisticsSidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { toast } from "sonner";

import { ProfileCompletionBanner } from "@/shared/components/ProfileCompletionBanner";

export default function LogisticsDashboard() {
    const { user, loading } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const { data: details } = useQuery({
        queryKey: ["logistics-details", user?.id],
        queryFn: async () => {
            console.log("Fetching logistics details for:", user?.id);
            // First fetch logistics details
            const { data: detailsData } = await (supabase as any)
                .from("logistics_details")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();

            // Fetch balance and escrow from wallets table
            const { data: walletData } = await (supabase as any)
                .from("wallets")
                .select("balance, escrow_balance")
                .eq("user_id", user?.id)
                .maybeSingle();

            // Then fetch is_online and zone from profiles
            const { data: profileData } = await (supabase as any)
                .from("profiles")
                .select("is_online, zone, zone_id, city_id, avatar_url")
                .eq("id", user?.id)
                .maybeSingle();


            return {
                user_id: user?.id,
                ...detailsData,
                balance: walletData?.balance || 0,
                escrow_balance: walletData?.escrow_balance || 0,
                is_online: profileData?.is_online,
                profiles: profileData
            };
        },
        enabled: !!user,
    });

    useEffect(() => {

    }, [details]);

    const { data: kycStatus } = useQuery({
        queryKey: ["rider-kyc-status-simple", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("logistics_kyc")
                .select("status")
                .eq("user_id", user?.id)
                .maybeSingle();
            return data?.status?.trim()?.toLowerCase() || "none";
        },
        enabled: !!user,
        refetchOnWindowFocus: true,
    });

    // Real-time subscription for KYC status and Wallet balance
    useEffect(() => {
        if (!user?.id) return;

        const kycChannel = supabase
            .channel(`rider-kyc-updates-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'logistics_kyc',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["rider-kyc-status-simple", user.id] });
                    queryClient.invalidateQueries({ queryKey: ["rider-kyc-status", user.id] });
                }
            )
            .subscribe();

        const walletChannel = supabase
            .channel(`rider-wallet-updates-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'wallets',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(kycChannel);
            supabase.removeChannel(walletChannel);
        };
    }, [user?.id, queryClient]);



    const toggleOnlineStatus = async (checked: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from("profiles")
                .update({ is_online: checked })
                .eq("id", user?.id);

            if (error) throw error;

            if (details) {
                // Optimistic update or refetch
                await queryClient.invalidateQueries({ queryKey: ["logistics-details", user?.id] });
            }

            toast.success(checked ? "You are now ONLINE" : "You are now OFFLINE", {
                description: checked ? "Sellers can now assign you orders." : "You won't receive new assignment alerts.",
            });
        } catch (error: any) {
            toast.error("Failed to update status", {
                description: error.message,
            });
        }
    };

    const handleTabChange = (tab: string) => {
        console.log("LogisticsDashboard: Tab change requested:", tab);
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    if (loading) return null;
    if (!user) return <Navigate to="/auth" replace />;

    return (
        <div className="min-h-screen bg-[#F8F9FB] flex">
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[45] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <LogisticsSidebar
                activeTab={activeTab}
                setActiveTab={handleTabChange}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                isOpen={isMobileMenuOpen}
                setIsOpen={setIsMobileMenuOpen}
                kycStatus={kycStatus}
                isOnline={details?.is_online || false}
                onOnlineToggle={toggleOnlineStatus}
            />

            <div className={cn(
                "flex-1 flex flex-col w-full transition-none",
                "lg:ml-0",
                !isCollapsed ? "lg:ml-[280px]" : "lg:ml-[80px]"
            )}>
                <LogisticsHeader
                    activeTab={activeTab}
                    setActiveTab={handleTabChange}
                    balance={details?.balance || 0}
                    escrow_balance={details?.escrow_balance || 0}
                    isOnline={details?.is_online || false}
                    onOnlineToggle={toggleOnlineStatus}
                    isMobileMenuOpen={isMobileMenuOpen}
                    onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    kycStatus={kycStatus}
                />

                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8 overflow-x-hidden">
                    <ProfileCompletionBanner />
                    {activeTab === "dashboard" && (
                        <LogisticsOverview
                            kycStatus={kycStatus}
                            profile={details?.profiles}
                            onVerificationClick={() => setActiveTab("verification")}
                        />
                    )}
                    {activeTab === "orders" && (
                        <LogisticsOverview
                            kycStatus={kycStatus}
                            showAllOrders={true}
                            profile={details?.profiles}
                            onVerificationClick={() => setActiveTab("verification")}
                        />
                    )}
                    {activeTab === "earnings" && <LogisticsEarnings />}
                    {activeTab === "verification" && (
                        <LogisticsKYC />
                    )}
                    {activeTab === "settings" && <LogisticsSettings details={details} />}
                </main>
            </div>
        </div>
    );
}
