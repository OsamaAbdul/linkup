import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { LogisticsHeader } from "@/components/logistics/LogisticsHeader";
import { LogisticsOverview } from "@/components/logistics/LogisticsOverview";
import { LogisticsEarnings } from "@/components/logistics/LogisticsEarnings";
import { LogisticsSettings } from "@/components/logistics/LogisticsSettings";
import { LogisticsKYC } from "@/components/logistics/LogisticsKYC";
import { LogisticsSidebar } from "@/components/logistics/LogisticsSidebar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

export default function LogisticsDashboard() {
    const { user, loading } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const { data: details } = useQuery({
        queryKey: ["logistics-details", user?.id],
        queryFn: async () => {
            // First fetch logistics details
            const { data: detailsData, error: detailsError } = await (supabase as any)
                .from("logistics_details")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();

            // Then fetch is_online and zone from profiles
            const { data: profileData, error: profileError } = await (supabase as any)
                .from("profiles")
                .select("is_online, zone")
                .eq("user_id", user?.id)
                .maybeSingle();
            if (profileError) throw profileError;

            return { ...detailsData, is_online: profileData?.is_online };
        },
        enabled: !!user,
    });

    const { data: kycStatus } = useQuery({
        queryKey: ["rider-kyc-status", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("logistics_kyc")
                .select("status")
                .eq("user_id", user?.id)
                .maybeSingle();
            return data?.status || "none";
        },
        enabled: !!user,
        refetchOnWindowFocus: true,
    });

    // Real-time subscription for KYC status
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`rider-kyc-updates-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'logistics_kyc',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["rider-kyc-status", user.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, queryClient]);

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
                setActiveTab={setActiveTab} 
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                isOpen={isMobileMenuOpen}
                setIsOpen={setIsMobileMenuOpen}
                kycStatus={kycStatus}
            />

            <div className={cn(
                "flex-1 flex flex-col transition-all duration-300 ease-in-out w-full",
                "lg:ml-0",
                !isCollapsed ? "lg:ml-[280px]" : "lg:ml-[80px]"
            )}>
                <LogisticsHeader
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    balance={details?.balance || 0}
                    isOnline={details?.is_online || false}
                    isMobileMenuOpen={isMobileMenuOpen}
                    onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    kycStatus={kycStatus}
                />

                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8 overflow-x-hidden">
                    {activeTab === "dashboard" && <LogisticsOverview kycStatus={kycStatus} onVerificationClick={() => setActiveTab("verification")} />}
                    {activeTab === "orders" && <LogisticsOverview kycStatus={kycStatus} showAllOrders={true} onVerificationClick={() => setActiveTab("verification")} />}
                    {activeTab === "earnings" && <LogisticsEarnings />}
                    {activeTab === "verification" && <LogisticsKYC />}
                    {activeTab === "settings" && <LogisticsSettings details={details} />}
                </main>
            </div>
        </div>
    );
}
