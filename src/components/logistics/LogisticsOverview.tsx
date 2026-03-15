import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Truck, CheckCircle, AlertTriangle, MapPin, Navigation, Eye, Radio, Zap } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { MissionDetailsModal } from "./MissionDetailsModal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface LogisticsOverviewProps {
    showAllOrders?: boolean;
}

export function LogisticsOverview({ showAllOrders = false }: LogisticsOverviewProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [viewingOrder, setViewingOrder] = useState<any>(null);

    // ── Claim a broadcast mission (atomic, race-safe via RPC) ──
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

    // ── Update status for shipments already assigned to this agent ──
    const updateShipmentStatus = useMutation({
        mutationFn: async ({ id, status, orderId }: { id: string; status: any; orderId: string }) => {
            const { error: sError } = await (supabase as any)
                .from("shipments")
                .update({ status, updated_at: new Date().toISOString() })
                .eq("id", id);
            if (sError) throw sError;

            // Sync order status
            const orderStatusMap: Record<string, string> = {
                delivered: "delivered",
                picked_up: "picked_up",
                accepted: "accepted",
                out_for_delivery: "out_for_delivery",
            };
            if (orderStatusMap[status]) {
                await supabase.from("orders").update({ status: orderStatusMap[status] }).eq("id", orderId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
            toast.success("Mission protocol updated");
        },
        onError: (error: any) => {
            toast.error("Failed to update status: " + (error.message || "Unauthorized"));
        },
    });

    // ── Fetch this agent's own active shipments ──
    const { data: shipments = [] } = useQuery({
        queryKey: ["agent-shipments", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("shipments")
                .select(`*, order:orders (*)`)
                .eq("rider_id", user?.id)
                .order("created_at", { ascending: false });
            return (data as any[]) || [];
        },
        enabled: !!user,
    });

    // ── Fetch broadcast (unclaimed) missions in agent's zone ──
    const { data: broadcastMissions = [] } = useQuery({
        queryKey: ["broadcast-missions", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("shipments")
                .select(`*, order:orders (*)`)
                .eq("status", "broadcast")
                .is("rider_id", null)
                .order("created_at", { ascending: false });
            return data || [];
        },
        enabled: !!user,
        refetchInterval: 8000, // Poll every 8 seconds for new missions
    });

    // ── Real-time listener for both assigned shipments and broadcasts ──
    useEffect(() => {
        if (!user) return;

        // 1. Listen for updates on OWN shipments
        const myChannel = supabase
            .channel(`agent-shipments-${user.id}`)
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "shipments",
                filter: `rider_id=eq.${user.id}`,
            }, (payload) => {
                queryClient.invalidateQueries({ queryKey: ["agent-shipments", user.id] });
                if (payload.eventType === "UPDATE" && (payload.new as any).status === "accepted") {
                    toast.success("You have a new active mission!");
                }
            })
            .subscribe();

        // 2. Listen for NEW broadcast missions in the zone
        const broadcastChannel = supabase
            .channel(`broadcast-zone-${user.id}`)
            .on("postgres_changes", {
                event: "INSERT",
                schema: "public",
                table: "shipments",
            }, (payload) => {
                if ((payload.new as any).status === "broadcast") {
                    queryClient.invalidateQueries({ queryKey: ["broadcast-missions", user.id] });
                    toast("📡 New Mission Available!", {
                        description: "A new order has been broadcast to your zone. Be the first to claim it!",
                    });
                }
            })
            .subscribe();

        // 3. Also listen for broadcast missions being CLAIMED (remove from list)
        const claimChannel = supabase
            .channel(`claims-watch-${user.id}`)
            .on("postgres_changes", {
                event: "UPDATE",
                schema: "public",
                table: "shipments",
            }, (payload) => {
                if ((payload.new as any).status === "accepted" && (payload.new as any).rider_id !== user.id) {
                    queryClient.invalidateQueries({ queryKey: ["broadcast-missions", user.id] });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(myChannel);
            supabase.removeChannel(broadcastChannel);
            supabase.removeChannel(claimChannel);
        };
    }, [user, queryClient]);

    const handleOpenMaps = (shipment: any) => {
        const address = (shipment.delivery_address as any)?.address;
        const lat = (shipment.delivery_address as any)?.lat;
        const lng = (shipment.delivery_address as any)?.lng;
        let mapsUrl = lat && lng
            ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
            : address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                : "";
        if (mapsUrl) window.open(mapsUrl, "_blank");
        else toast.error("Endpoint coordinates missing for navigation");
    };

    const stats = [
        { label: "Available Missions", value: broadcastMissions.length, icon: Radio, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "In Transit", value: shipments.filter((s: any) => s.status === "picked_up").length, icon: Truck, color: "text-amber-600", bg: "bg-amber-50" },
        { label: "Delivered Today", value: shipments.filter((s: any) => s.status === "delivered" && new Date(s.updated_at).toDateString() === new Date().toDateString()).length, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
        { label: "Issues", value: 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    ];

    const activeShipments = shipments.filter((s: any) => s.status !== "delivered" && s.status !== "completed");

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm rounded-[2rem] overflow-hidden">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
                                <stat.icon size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black text-foreground">{stat.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ━━━ AVAILABLE MISSIONS (BROADCAST POOL) ━━━ */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <Radio size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Available Missions</h2>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Open to all agents in your zone — first to claim wins</p>
                    </div>
                    {broadcastMissions.length > 0 && (
                        <span className="ml-auto px-3 py-1 rounded-full bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                            {broadcastMissions.length} Live
                        </span>
                    )}
                </div>

                <AnimatePresence>
                    {broadcastMissions.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-10 text-center border-2 border-dashed border-black/5 rounded-[2rem] text-muted-foreground text-sm font-medium"
                        >
                            <Radio size={32} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
                            No missions broadcast to your zone yet. Stay ready!
                        </motion.div>
                    ) : (
                        <div className="grid gap-4">
                            {broadcastMissions.map((mission: any) => (
                                <motion.div
                                    key={mission.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-transparent p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
                                >
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[11px] font-mono shrink-0">
                                            #{mission.order_id?.slice(-6).toUpperCase()}
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className="bg-blue-100 text-blue-700 font-black text-[9px] uppercase tracking-wider border-none">
                                                    <Radio size={8} className="mr-1" /> Open Mission
                                                </Badge>
                                                <span className="text-[10px] font-black text-muted-foreground uppercase">
                                                    {mission.zone?.split(" (")[0]}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="shrink-0 mt-1">
                                                    <MapPin size={12} className="text-orange-500" />
                                                </div>
                                                <p className="text-sm font-medium text-foreground line-clamp-1">
                                                    Pickup: {(mission.pickup_address as any)?.address || "TBD"}
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="shrink-0 mt-1">
                                                    <Navigation size={12} className="text-blue-500" />
                                                </div>
                                                <p className="text-sm font-medium text-muted-foreground line-clamp-1">
                                                    Deliver to: {(mission.order?.shipping_address as any)?.address || "Buyer Location"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        className="rounded-2xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest gap-2 active:scale-95 transition-all shrink-0 shadow-lg shadow-blue-600/20"
                                        onClick={() => claimMissionMutation.mutate(mission.id)}
                                        disabled={claimMissionMutation.isPending}
                                    >
                                        <Zap size={14} strokeWidth={3} />
                                        Claim Mission
                                    </Button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </section>

            {/* ━━━ ACTIVE TRANSITS (already-claimed shipments) ━━━ */}
            <section className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <Truck size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Active Transits</h2>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Real-time mission tracking</p>
                    </div>
                </div>

                <Card className="border-none shadow-xl shadow-black/[0.02] rounded-[2.5rem] overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pl-8">Order ID</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Pickup</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Drop-off</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Status</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 text-right pr-8">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeShipments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium">
                                        No active transits. Claim a mission above to get started!
                                    </TableCell>
                                </TableRow>
                            ) : activeShipments.map((s: any) => (
                                <TableRow key={s.id} className="border-black/[0.03] group transition-colors">
                                    <TableCell className="font-bold text-xs pl-8">#{s.order_id?.slice(-8)}</TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                                <MapPin size={12} strokeWidth={3} />
                                            </div>
                                            <p className="text-xs font-bold line-clamp-1">{(s.pickup_address as any)?.address}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                <Navigation size={12} strokeWidth={3} />
                                            </div>
                                            <p className="text-xs font-bold line-clamp-1">{(s.order?.shipping_address as any)?.address}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none",
                                            s.status === "accepted" ? "bg-indigo-100 text-indigo-700" :
                                            s.status === "out_for_pickup" ? "bg-amber-100 text-amber-700" :
                                            s.status === "arrived_at_seller" ? "bg-orange-100 text-orange-700" :
                                            s.status === "picked_up" ? "bg-purple-100 text-purple-700" :
                                            s.status === "out_for_delivery" ? "bg-blue-100 text-blue-700" :
                                            s.status === "arrived_at_destination" ? "bg-cyan-100 text-cyan-700" :
                                            s.status === "delivered" ? "bg-green-100 text-green-700" :
                                            "bg-amber-100 text-amber-700"
                                        )}>
                                            {s.status.replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="flex items-center justify-end gap-2">
                                            {s.status === "accepted" && (
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl h-9 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest gap-2"
                                                    onClick={() => handleOpenMaps(s)}
                                                >
                                                    <Navigation size={12} strokeWidth={3} /> Navigate
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-xl h-9 hover:bg-blue-50 hover:text-blue-600 font-bold"
                                                onClick={() => setViewingOrder(s)}
                                            >
                                                <Eye size={16} className="mr-1" /> Details
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </section>

            <MissionDetailsModal
                shipment={viewingOrder}
                open={!!viewingOrder}
                onOpenChange={(open) => !open && setViewingOrder(null)}
            />
        </div>
    );
}
