import { lazy, Suspense, useEffect } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/shared/components/ui/skeleton";

// Lazy load admin sections
const AdminOverview = lazy(() => import("@/features/admin/components/dashboard/AdminOverview"));
const AdminOrderTracker = lazy(() => import("@/features/admin/components/dashboard/AdminOrderTracker"));
const AdminUserManagement = lazy(() => import("@/features/admin/components/dashboard/AdminUserManagement"));
const AdminIssueManager = lazy(() => import("@/features/admin/components/dashboard/AdminIssueManager"));
const AdminSystemHistory = lazy(() => import("@/features/admin/components/dashboard/AdminSystemHistory"));
const AdminKycManager = lazy(() => import("@/features/admin/components/dashboard/AdminKycManager"));
const AdminPaymentsSection = lazy(() => import("@/features/admin/components/dashboard/AdminPaymentsSection"));
const AdminLogisticsManager = lazy(() => import("@/features/admin/components/dashboard/AdminLogisticsManager"));
const AdminFeeConfig = lazy(() => import("@/features/admin/components/dashboard/AdminFeeConfig"));
const AdminDisputeManager = lazy(() => import("@/features/admin/components/dashboard/AdminDisputeManager"));
const AdminCategoryManager = lazy(() => import("@/features/admin/components/dashboard/AdminCategoryManager"));

interface AdminDashboardProps {
    activeSection?: "overview" | "orders" | "users" | "issues" | "disputes" | "history" | "kyc" | "payments" | "logistics" | "fees" | "categories";
}

export default function AdminDashboard({ activeSection = "overview" }: AdminDashboardProps) {
    const queryClient = useQueryClient();

    // Prefetch all admin data on mount for faster navigation
    useEffect(() => {
        const prefetchAdminData = async () => {
            // Revenue data
            queryClient.prefetchQuery({
                queryKey: ["admin-revenue"],
                queryFn: async () => {
                    const { data, error } = await (supabase as any).rpc("get_admin_revenue");
                    if (error) throw error;
                    return data || 0;
                },
                staleTime: 1000 * 60 * 5,
            });

            // Force refetch to avoid stale/cached zero values
            queryClient.invalidateQueries({ queryKey: ["admin-revenue"] });

            // Active orders count
            queryClient.prefetchQuery({
                queryKey: ["admin-active-orders-count"],
                queryFn: async () => {
                    const { count, error } = await supabase.from("orders").select("*", { count: 'exact', head: true }).not("status", "in", "(completed,cancelled,delivered)");
                    if (error) throw error;
                    return count || 0;
                },
                staleTime: 1000 * 60 * 2,
            });

            // Users count
            queryClient.prefetchQuery({
                queryKey: ["admin-users-count"],
                queryFn: async () => {
                    const { count, error } = await supabase.from("profiles").select("*", { count: 'exact', head: true });
                    if (error) throw error;
                    return count || 0;
                },
                staleTime: 1000 * 60 * 10,
            });

            // Open issues count
            queryClient.prefetchQuery({
                queryKey: ["admin-open-issues-count"],
                queryFn: async () => {
                    const { count, error } = await (supabase as any).from("issues").select("*", { count: 'exact', head: true }).eq("status", "open");
                    if (error) throw error;
                    return count || 0;
                },
                staleTime: 1000 * 60 * 1,
            });

            // Global Orders (for across-section context)
            queryClient.prefetchQuery({
                queryKey: ["admin-all-orders"],
                queryFn: async () => {
                    const { data, error } = await supabase
                        .from("orders")
                        .select("*, profiles:buyer_id(display_name)")
                        .order("created_at", { ascending: false });
                    if (error) throw error;
                    return data;
                },
                staleTime: 1000 * 60 * 2,
            });
        };

        prefetchAdminData();
    }, [queryClient]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <Suspense fallback={<AdminSectionSkeleton />}>
                {activeSection === "overview" && <AdminOverview />}
                {activeSection === "orders" && <AdminOrderTracker />}
                {activeSection === "users" && <AdminUserManagement />}
                {activeSection === "issues" && <AdminIssueManager />}
                {activeSection === "history" && <AdminSystemHistory />}
                {activeSection === "kyc" && <AdminKycManager />}
                {activeSection === "payments" && <AdminPaymentsSection />}
                {activeSection === "logistics" && <AdminLogisticsManager />}
                {activeSection === "fees" && <AdminFeeConfig />}
                {activeSection === "disputes" && <AdminDisputeManager />}
                {activeSection === "categories" && <AdminCategoryManager />}
            </Suspense>
        </div>
    );
}

function AdminSectionSkeleton() {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-64 rounded-xl" />
                    <Skeleton className="h-4 w-48 rounded-lg" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-11 w-24 rounded-xl" />
                    <Skeleton className="h-11 w-32 rounded-xl" />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
                <Skeleton className="h-96 rounded-xl" />
            </div>
        </div>
    );
}

