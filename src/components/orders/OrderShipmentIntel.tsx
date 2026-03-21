import { MapPin, LocateFixed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LiveTrackingMap } from "./LiveTrackingMap";

interface OrderShipmentIntelProps {
    shipment: any;
}

export function OrderShipmentIntel({ shipment }: OrderShipmentIntelProps) {
    const [riderCoords, setRiderCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Fetch rider profile separately
    const { data: riderProfile } = useQuery({
        queryKey: ["rider-profile", shipment?.rider_id],
        queryFn: async () => {
            if (!shipment?.rider_id) return null;
            const { data, error } = await supabase
                .from("profiles")
                .select("display_name, avatar_url, phone")
                .eq("user_id", shipment.rider_id)
                .single();
            if (error) return null;
            return data;
        },
        enabled: !!shipment?.rider_id,
    });
    const [isSharing, setIsSharing] = useState(false);

    useEffect(() => {
        if (!isSharing || !shipment?.id) return;

        console.log("Starting live location sharing for buyer...");
        let watchId: number;

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const { error } = await (supabase as any)
                        .from("shipments")
                        .update({
                            buyer_latitude: latitude,
                            buyer_longitude: longitude,
                            buyer_location_last_updated: new Date().toISOString()
                        })
                        .eq("id", shipment.id);

                    if (error) console.error("Error updating buyer location:", error);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    toast.error("Location access denied. Tracking disabled.");
                    setIsSharing(false);
                },
                { enableHighAccuracy: true }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, [isSharing, shipment?.id]);

    useEffect(() => {
        if (!shipment?.rider_id) return;

        // Initial fetch
        const fetchRiderLocation = async () => {
            const { data } = await supabase
                .from("profiles")
                .select("latitude, longitude")
                .eq("id", shipment.rider_id)
                .single();
            if (data?.latitude && data?.longitude) {
                setRiderCoords({ lat: data.latitude, lng: data.longitude });
            }
        };

        fetchRiderLocation();

        // Realtime subscription
        const channel = supabase
            .channel(`rider-location-${shipment.rider_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${shipment.rider_id}`
                },
                (payload: any) => {
                    const { latitude, longitude } = payload.new;
                    if (latitude && longitude) {
                        setRiderCoords({ lat: latitude, lng: longitude });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shipment?.rider_id]);

    if (!shipment) {
        return (
            <div className="bg-muted/30 p-5 rounded-xl border border-dashed border-black/5 text-center">
                <p className="text-[11px] font-bold text-muted-foreground lowercase tracking-tight italic opacity-60">Waiting for logistics network assignment...</p>
            </div>
        );
    }

    const buyerCoordsState = isSharing ? riderCoords : null; // placeholder for actual buyer coords

    return (
        <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-card p-4 rounded-xl border border-border/50 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Logistics Identifier</p>
                    <Badge variant="outline" className="font-mono text-[10px] border-border/50 bg-muted/30">{shipment.tracking_code}</Badge>
                </div>

                {riderProfile && (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-lg border-2 border-primary/10">
                            <AvatarImage src={riderProfile.avatar_url || ""} />
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">
                                {riderProfile.display_name?.[0]?.toUpperCase() || "R"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Authenticated Rider</p>
                            <p className="text-[13px] font-black text-foreground">{riderProfile.display_name || "Agent Assigned"}</p>
                            {riderProfile.phone && (
                                <p className="text-[10px] text-muted-foreground font-medium">{riderProfile.phone}</p>
                            )}
                        </div>
                        <Button size="sm" className="rounded-full h-7 text-[9px] font-black px-3 bg-muted hover:bg-muted/80 text-foreground transition-colors">Call</Button>
                    </div>
                )}
            </div>

            <div className={cn(
                "p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all duration-500 relative overflow-hidden",
                riderCoords ? "border-primary shadow-lg shadow-primary/20" : "bg-primary/[0.02] border-primary/5"
            )}>
                {riderCoords ? (
                    <div className="relative">
                        <div className="absolute top-1.5 left-1.5 z-[1000] flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-md border border-border/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-foreground">Live</span>
                        </div>
                        <LiveTrackingMap riderCoords={riderCoords} buyerCoords={buyerCoordsState} />
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <MapPin size={18} strokeWidth={3} />
                            <p className="text-sm font-black tracking-tight">Deployment Terminal</p>
                        </div>
                        <p className="text-xs font-medium leading-relaxed pl-7 text-muted-foreground">
                            Your asset is currently in the Linkup Global logistics network. Real-time updates will fire as the status evolves.
                        </p>
                    </div>
                )}
            </div>

            {/* Buyer Live Sharing Policy */}
            <div className={cn(
                "col-span-1 md:col-span-2 p-4 rounded-xl border flex items-center justify-between transition-all duration-300",
                isSharing ? "bg-green-50/50 border-green-200" : "bg-muted/10 border-black/[0.03]"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        isSharing ? "bg-green-100 text-green-600" : "bg-black/5 text-muted-foreground"
                    )}>
                        <LocateFixed size={18} strokeWidth={3} className={isSharing ? "animate-pulse" : ""} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Mutual Visibility</p>
                        <p className="text-[13px] font-black text-foreground">Share Live Position</p>
                        <p className="text-[10px] font-medium text-muted-foreground opacity-60">Enable real-time tracking for your logistics partner.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-xl border border-black/5 shadow-sm">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", isSharing ? "text-green-600" : "text-muted-foreground")}>
                        {isSharing ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                        checked={isSharing}
                        onCheckedChange={setIsSharing}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
            </div>
        </div>
    );
}
