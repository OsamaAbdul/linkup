import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { MissionDetailsModal } from "./MissionDetailsModal";
import { LogisticsStats } from "./dashboard/LogisticsStats";
import { BroadcastMissions } from "./dashboard/BroadcastMissions";
import { ActiveTransits } from "./dashboard/ActiveTransits";
import { generateMapsUrl } from "../utils/logistics-utils";

interface LogisticsOverviewProps {
    showAllOrders?: boolean;
    kycStatus?: string;
    profile?: any;
    onVerificationClick?: () => void;
}

export function LogisticsOverview({
    kycStatus = "none",
    profile,
    onVerificationClick
}: LogisticsOverviewProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [viewingOrder, setViewingOrder] = useState<any>(null);

    //  Claim a broadcast mission
    const claimMissionMutation = useMutation({
        mutationFn: async (shipmentId: string) => {
            const { data, error } = await (supabase as any).rpc("claim_order_mission", {
                p_shipment_id: shipmentId,
                p_rider_id: user?.id,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Mission already claimed");
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
            queryClient.invalidateQueries({ queryKey: ["broadcast-missions"] });
            toast.success("Mission claimed! You're on it.", {
                description: `Order #${data.order_id?.slice(-8)} is now yours.`,
            });
        },
        onError: (error: any) => {
            toast.error(error.message || "Mission was already taken by another agent");
            queryClient.invalidateQueries({ queryKey: ["broadcast-missions"] });
        },
    });

    // Fetch this agent's own active shipments 
    const { data: shipments = [] } = useQuery({
        queryKey: ["agent-shipments", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("shipments")
                .select(`*, order:orders (*, buyer:profiles!buyer_id (*), seller:profiles!seller_id (*))`)
                .eq("rider_id", user?.id)
                .order("created_at", { ascending: false });
            return (data as any[]) || [];
        },
        enabled: !!user,
    });

    // Fetch broadcast (unclaimed) missions 
    const { data: broadcastMissions = [] } = useQuery({
        queryKey: ["broadcast-missions", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("shipments")
                .select(`*, order:orders (*, buyer:profiles!buyer_id (*), seller:profiles!seller_id (*))`)
                .eq("status", "broadcast")
                .is("rider_id", null)
                .order("created_at", { ascending: false });
            return data || [];
        },
        enabled: !!user,
        refetchInterval: 8000,
    });

    const isKycVerified = kycStatus?.toLowerCase() === "verified" || kycStatus?.toLowerCase() === "approved";

    // Real-time listener
    useEffect(() => {
        if (!user) return;

        const myChannel = supabase
            .channel(`agent-shipments-${user.id}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "shipments",
                filter: `rider_id=eq.${user.id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ["agent-shipments", user.id] });
            })
            .subscribe();

        const broadcastChannel = supabase
            .channel(`broadcast-zone-${user.id}`)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "shipments",
            }, (payload) => {
                if ((payload.new as any).status === "broadcast") {
                    queryClient.invalidateQueries({ queryKey: ["broadcast-missions", user.id] });
                    toast("📡 New Mission Available!");
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(myChannel);
            supabase.removeChannel(broadcastChannel);
        };
    }, [user, queryClient]);

    const handleOpenMaps = (shipment: any, mode: 'pickup' | 'delivery') => {
        const mapsUrl = generateMapsUrl(shipment, mode);
        if (mapsUrl) {
            window.open(mapsUrl, "_blank");
        } else {
            toast.error(`Target ${mode} location data missing`);
        }
    };

    const activeShipments = shipments.filter((s: any) => s.status !== "delivered" && s.status !== "completed");

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <LogisticsStats 
                shipments={shipments} 
                broadcastMissionsCount={broadcastMissions.length} 
            />

            <BroadcastMissions 
                missions={broadcastMissions}
                isKycVerified={isKycVerified}
                kycStatus={kycStatus}
                profile={profile}
                onVerificationClick={onVerificationClick}
                onClaimMission={(id) => claimMissionMutation.mutate(id)}
                onViewDetails={setViewingOrder}
                isClaiming={claimMissionMutation.isPending}
            />

            <ActiveTransits 
                shipments={activeShipments}
                onViewDetails={setViewingOrder}
                onNavigate={handleOpenMaps}
            />

            <MissionDetailsModal
                shipment={viewingOrder}
                open={!!viewingOrder}
                onOpenChange={(open) => !open && setViewingOrder(null)}
            />
        </div>
    );
}
