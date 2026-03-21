import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    MapPin,
    Navigation,
    Smartphone,
    Package,
    CheckCircle,
    Truck,
    ArrowRight,
    Loader2,
    LocateFixed
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

// Fix for default marker icons in Leaflet with Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const AgentIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#2563eb; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px rgba(37,99,235,0.5);'></div>",
    iconSize: [12, 12],
    iconAnchor: [6, 6]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MissionDetailsModalProps {
    shipment: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Helper component to center map when coordinates change
function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

export function MissionDetailsModal({ shipment, open, onOpenChange }: MissionDetailsModalProps) {
    const queryClient = useQueryClient();
    const [agentLocation, setAgentLocation] = useState<[number, number] | null>(null);
    const [buyerLocation, setBuyerLocation] = useState<[number, number] | null>(null);

    // Subscribe to live shipment updates (for buyer location)
    useEffect(() => {
        if (!open || !shipment?.id) return;

        const channel = supabase
            .channel(`shipment-tracking-${shipment.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'shipments',
                    filter: `id=eq.${shipment.id}`
                },
                (payload) => {
                    const { buyer_latitude, buyer_longitude } = payload.new;
                    if (buyer_latitude && buyer_longitude) {
                        setBuyerLocation([buyer_latitude, buyer_longitude]);
                    }
                }
            )
            .subscribe();

        // Initial fetch for buyer location
        const fetchInitialBuyerLoc = async () => {
            const { data } = await (supabase as any)
                .from("shipments")
                .select("buyer_latitude, buyer_longitude")
                .eq("id", shipment.id)
                .single();
            if (data?.buyer_latitude && data?.buyer_longitude) {
                setBuyerLocation([data.buyer_latitude, data.buyer_longitude]);
            }
        };

        fetchInitialBuyerLoc();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [open, shipment?.id]);

    // Fetch items associated with this shipment/order
    const { data: items = [], isLoading: itemsLoading } = useQuery({
        queryKey: ["shipment-items", shipment?.id],
        queryFn: async () => {
            if (!shipment?.id) return [];
            const { data, error } = await (supabase as any)
                .from("order_items")
                .select("*, products(title, images)")
                .eq("shipment_id", shipment.id);
            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: !!shipment?.id && open,
    });

    // Real-time location tracking
    useEffect(() => {
        if (!open || !shipment) return;

        let watchId: number;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    setAgentLocation([latitude, longitude]);

                    // Update agent's location in the database for tracking
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await supabase
                            .from("profiles")
                            .update({
                                latitude,
                                longitude,
                                last_seen: new Date().toISOString()
                            })
                            .eq("user_id", user.id);
                    }
                },
                (error) => console.error("Geolocation error:", error),
                { enableHighAccuracy: true }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [open, shipment]);

    const updateStatus = useMutation({
        mutationFn: async (newStatus: any) => {
            const { error } = await (supabase as any)
                .from("shipments")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", shipment.id);
            if (error) throw error;

            // Sync with order status
            if (newStatus === "delivered") {
                await supabase.from("orders").update({ status: "delivered" }).eq("id", shipment.order_id);
            } else if (newStatus === "picked_up") {
                await supabase.from("orders").update({ status: "picked_up" }).eq("id", shipment.order_id);
            } else if (newStatus === "accepted") {
                await supabase.from("orders").update({ status: "accepted" }).eq("id", shipment.order_id);
            } else if (newStatus === "out_for_delivery") {
                await supabase.from("orders").update({ status: "out_for_delivery" }).eq("id", shipment.order_id);
            } else if (newStatus === "out_for_pickup") {
                // Agent is moving, order remains confirmed/processing or moves to specific transit status if needed
                // For now, keep it as accepted or move to a general 'processing' if not already
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
            toast.success("Shipment status updated");
            onOpenChange(false);
        },
    });

    if (!shipment) return null;

    const deliveryAddress = shipment.delivery_address as any;
    const destCoords: [number, number] | null = deliveryAddress?.lat && deliveryAddress?.lng
        ? [deliveryAddress.lat, deliveryAddress.lng]
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] rounded-xl p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-primary/5 p-8 border-b border-primary/10">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Package size={20} strokeWidth={3} />
                                    </div>
                                    Mission Details
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground font-medium pt-1">
                                    Track and manage Shipment #{shipment.id.slice(-8)}
                                </DialogDescription>
                            </div>
                            <Badge className={cn(
                                "rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none",
                                shipment.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                shipment.status === 'accepted' ? 'bg-indigo-100 text-indigo-700' :
                                shipment.status === 'out_for_pickup' ? 'bg-amber-100 text-amber-700' :
                                shipment.status === 'arrived_at_seller' ? 'bg-orange-100 text-orange-700' :
                                shipment.status === 'picked_up' ? 'bg-purple-100 text-purple-700' :
                                shipment.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-700' :
                                shipment.status === 'arrived_at_destination' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-green-100 text-green-700'
                            )}>
                                {shipment.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    </DialogHeader>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left Side: Map & Location */}
                    <div className="h-[400px] md:h-full min-h-[400px] relative border-r border-black/5">
                        <MapContainer
                            center={agentLocation || destCoords || [9.05785, 7.49508]}
                            zoom={13}
                            style={{ height: "100%", width: "100%" }}
                            scrollWheelZoom={false}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            {agentLocation && (
                                <>
                                    <Marker position={agentLocation} icon={AgentIcon}>
                                        <Popup>Current Position</Popup>
                                    </Marker>
                                    <ChangeView center={agentLocation} />
                                </>
                            )}
                            {buyerLocation ? (
                                <>
                                    <Marker position={buyerLocation}>
                                        <Popup>Buyer Live Position</Popup>
                                    </Marker>
                                    {agentLocation && <Polyline positions={[agentLocation, buyerLocation]} color="#16a34a" weight={3} dashArray="5, 10" />}
                                </>
                            ) : destCoords && (
                                <Marker position={destCoords}>
                                    <Popup>Drop-off Location</Popup>
                                </Marker>
                            )}
                            {agentLocation && destCoords && !buyerLocation && (
                                <Polyline positions={[agentLocation, destCoords]} color="#2563eb" dashArray="10, 10" weight={2} />
                            )}
                        </MapContainer>

                        {/* Map Overlay Info */}
                        <div className="absolute bottom-4 left-4 right-4 z-[1000] space-y-2">
                            {buyerLocation && (
                                <div className="bg-green-600/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/20 text-white flex items-center justify-between animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                            <LocateFixed size={14} className="animate-pulse" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white/70">Live Tracker</p>
                                            <p className="text-xs font-black">Buyer Shared Location</p>
                                        </div>
                                    </div>
                                    <Badge className="bg-white/20 text-white border-none text-[8px] font-black uppercase">Active</Badge>
                                </div>
                            )}
                            <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-black/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                                    <Navigation size={10} strokeWidth={3} />
                                    Drop-off Coordinates
                                </p>
                                <p className="text-xs font-bold text-foreground line-clamp-1">{deliveryAddress?.address || "Loading address..."}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Order Info & Items */}
                    <div className="flex flex-col h-[500px]">
                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-6">
                                {/* Consignee Identity */}
                                <section className="space-y-3">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                        <Smartphone size={12} strokeWidth={3} />
                                        Consignee Identity
                                    </h4>
                                    <div className="bg-muted/30 p-4 rounded-xl border border-black/[0.03]">
                                        <p className="font-black text-sm">{deliveryAddress?.name || "Customer"}</p>
                                        <p className="text-xs font-bold text-primary mt-0.5">{deliveryAddress?.phone || "No phone link"}</p>
                                    </div>
                                </section>

                                {/* Item List */}
                                <section className="space-y-3">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                        <Package size={12} strokeWidth={3} />
                                        Bundle Inventory
                                    </h4>
                                    <div className="space-y-2">
                                        {itemsLoading ? (
                                            <div className="flex items-center gap-2 py-4 text-muted-foreground italic text-xs">
                                                <Loader2 className="animate-spin" size={12} />
                                                Retrieving item manifest...
                                            </div>
                                        ) : items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-black/5 shadow-sm">
                                                <div className="w-10 h-10 rounded-lg bg-muted/20 overflow-hidden flex-shrink-0">
                                                    {item.products?.images?.[0] ? (
                                                        <img src={item.products.images[0]} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                                            <Package size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-xs font-bold text-foreground truncate">{item.products?.title || "Item Component"}</p>
                                                    <p className="text-[10px] font-black text-primary opacity-60 italic">Quantity: {item.quantity}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Path Trace */}
                                <section className="space-y-3">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                        <ArrowRight size={12} strokeWidth={3} />
                                        Path Trace
                                    </h4>
                                    <div className="space-y-3 relative before:absolute before:left-[11px] before:top-4 before:bottom-4 before:w-[2px] before:bg-black/5">
                                        <div className="flex items-start gap-4 z-10">
                                            <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-orange-600/20">
                                                <MapPin size={10} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Pickup Node</p>
                                                <p className="text-[11px] font-bold text-foreground">{(shipment.pickup_address as any)?.address}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 z-10">
                                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-600/20">
                                                <Navigation size={10} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Delivery Node</p>
                                                <p className="text-[11px] font-bold text-foreground">{deliveryAddress?.address}</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </ScrollArea>

                        {/* Actions */}
                        <div className="p-6 bg-muted/10 border-t border-black/[0.03] space-y-3 flex flex-col">
                            {shipment.status === 'assigned' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('accepted')}
                                    disabled={updateStatus.isPending}
                                >
                                    <CheckCircle size={14} strokeWidth={3} />
                                    Accept Mission
                                </Button>
                            )}
                            {shipment.status === 'accepted' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('out_for_pickup')}
                                    disabled={updateStatus.isPending}
                                >
                                    <Navigation size={14} strokeWidth={3} />
                                    Start Pickup Journey
                                </Button>
                            )}
                            {shipment.status === 'out_for_pickup' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('arrived_at_seller')}
                                    disabled={updateStatus.isPending}
                                >
                                    <MapPin size={14} strokeWidth={3} />
                                    Arrived at Seller
                                </Button>
                            )}
                            {shipment.status === 'arrived_at_seller' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('picked_up')}
                                    disabled={updateStatus.isPending}
                                >
                                    <Truck size={14} strokeWidth={3} />
                                    Confirm Handoff
                                </Button>
                            )}
                            {shipment.status === 'picked_up' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('out_for_delivery')}
                                    disabled={updateStatus.isPending}
                                >
                                    <Navigation size={14} strokeWidth={3} />
                                    Start Delivery Journey
                                </Button>
                            )}
                            {shipment.status === 'out_for_delivery' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-cyan-600 hover:bg-cyan-700 text-white shadow-xl shadow-cyan-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('arrived_at_destination')}
                                    disabled={updateStatus.isPending}
                                >
                                    <MapPin size={14} strokeWidth={3} />
                                    Arrived at Destination
                                </Button>
                            )}
                            {shipment.status === 'arrived_at_destination' && (
                                <Button
                                    className="w-full rounded-xl h-12 font-black text-[10px] uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('delivered')}
                                    disabled={updateStatus.isPending}
                                >
                                    <CheckCircle size={14} strokeWidth={3} />
                                    Finalize Delivery
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="w-full rounded-xl h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-black/5"
                            >
                                Close Details
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

