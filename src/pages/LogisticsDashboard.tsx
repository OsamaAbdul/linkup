import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { LogisticsHeader } from "@/components/logistics/LogisticsHeader";
import { LogisticsOverview } from "@/components/logistics/LogisticsOverview";
import { LogisticsEarnings } from "@/components/logistics/LogisticsEarnings";
import { LogisticsSettings } from "@/components/logistics/LogisticsSettings";
import { LogisticsSidebar } from "@/components/logistics/LogisticsSidebar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function LogisticsDashboard() {
    const { user, loading } = useAuth();
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
                .single();
            if (detailsError && detailsError.code !== "PGRST116") throw detailsError;

            // Then fetch is_online and zone from profiles
            const { data: profileData, error: profileError } = await (supabase as any)
                .from("profiles")
                .select("is_online, zone")
                .eq("user_id", user?.id)
                .single();
            if (profileError) throw profileError;

            return { ...detailsData, is_online: profileData?.is_online };
        },
        enabled: !!user,
    });

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
                />

                <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8 overflow-x-hidden">
                    {activeTab === "dashboard" && <LogisticsOverview />}
                    {activeTab === "orders" && <LogisticsOverview showAllOrders={true} />}
                    {activeTab === "earnings" && <LogisticsEarnings />}
                    {activeTab === "settings" && <LogisticsSettings details={details} />}
                </main>
            </div>
        </div>
    );
}
