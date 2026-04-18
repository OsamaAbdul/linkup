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

    //  Accept an available mission
    const claimMissionMutation = useMutation({
        mutationFn: async (shipmentId: string) => {
            const { data, error } = await (supabase as any).rpc("claim_order_mission", {
                p_shipment_id: shipmentId,
                p_rider_id: user?.id,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Mission already accepted");
            return data;
        },
        onMutate: async (shipmentId) => {
            await queryClient.cancelQueries({ queryKey: ["broadcast-missions", user?.id] });
            await queryClient.cancelQueries({ queryKey: ["agent-shipments", user?.id] });

            const previousMissions = queryClient.getQueryData(["broadcast-missions", user?.id]);
            const previousShipments = queryClient.getQueryData(["agent-shipments", user?.id]);

            // Optimistically remove from broadcast
            queryClient.setQueryData(["broadcast-missions", user?.id], (old: any[]) =>
                old?.filter(m => m.id !== shipmentId) || []
            );

            return { previousMissions, previousShipments };
        },
        onError: (error: any, shipmentId, context) => {
            queryClient.setQueryData(["broadcast-missions", user?.id], context?.previousMissions);
            queryClient.setQueryData(["agent-shipments", user?.id], context?.previousShipments);
            toast.error(error.message || "Mission was already taken by another partner");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["agent-shipments", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["broadcast-missions", user?.id] });
        },
        onSuccess: (data) => {
            toast.success("Mission Accepted! You're on it.", {
                description: `Order #${data.order_id?.slice(-8)} is now assigned to you.`,
            });
        },
    });

    // Fetch this agent's own active shipments 
    const { data: shipments = [] } = useQuery({
        queryKey: ["agent-shipments", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .select(`*, order:orders (*, order_recipient (*), buyer:profiles!buyer_id (*), seller:profiles!seller_id (*))`)
                .eq("rider_id", user?.id)
                .order("created_at", { ascending: false });
            return (data as any[]) || [];
        },
        enabled: !!user,
    });

    // Fetch broadcast (unclaimed) missions (Source of Truth: Orders Table)
    const { data: broadcastMissions = [] } = useQuery({
        queryKey: ["broadcast-missions", user?.id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("orders")
                .select(`
                    *, 
                    order_recipient (*),
                    buyer:profiles!buyer_id (*), 
                    seller:profiles!seller_id (*),
                    shipments!inner (*)
                `)
                .eq("status", "awaiting_agent")
                .order("created_at", { ascending: false });

            console.log("Missions Pool Data:", data);

            if (error) {
                console.error("Missions Pool Fetch Error:", error);
                return [];
            }

            // Transform Orders into "Mission" format expected by the UI
            // This maps each order to its shipment while nesting the order data
            return (data as any[]).map(o => ({
                ...(o.shipments?.[0] || {}),
                order: {
                    ...o,
                    order_recipient: o.order_recipient
                }
            }));
        },
        enabled: !!user,
        refetchInterval: 8000,
    });

    const isKycVerified = kycStatus?.toLowerCase() === "verified" || kycStatus?.toLowerCase() === "approved";

    // Real-time listener: High-frequency sync
    useEffect(() => {
        if (!user) return;

        // 1. My Shipments: Listen to all changes (*) assigned to me
        const myChannel = supabase
            .channel(`agent-shipments-${user.id}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "shipments",
                filter: `rider_id=eq.${user.id}`,
            }, (payload) => {
                console.log("Realtime: My shipment updated", payload);
                queryClient.invalidateQueries({ queryKey: ["agent-shipments", user.id] });
                // Also invalidate specific order detail if needed
                if (payload.new && (payload.new as any).order_id) {
                    queryClient.invalidateQueries({ queryKey: ["order", (payload.new as any).order_id] });
                }
            })
            .subscribe();

        // 2. Broadcast Missions: Catch new ones and removals
        const broadcastChannel = supabase
            .channel(`broadcast-global-${user.id}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "shipments",
            }, (payload) => {
                // If it's a new broadcast OR an existing one changed (e.g. taken by someone else)
                const isBroadcast = (payload.new as any)?.status === "broadcast" || (payload.old as any)?.status === "broadcast";
                if (isBroadcast) {
                    console.log("Realtime: Broadcast mission updated");
                    queryClient.invalidateQueries({ queryKey: ["broadcast-missions", user.id] });

                    if (payload.eventType === "INSERT" && (payload.new as any).status === "broadcast") {
                        toast("📡 New Mission Available!", {
                            description: "A new mission has entered the pool.",
                            action: {
                                label: "View",
                                onClick: () => console.log("Navigate to missions")
                            }
                        });
                    }
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
