import React from "react";
import { 
    MapPin, 
    ArrowUpRight, 
    Clock, 
    Package, 
    ChevronRight,
    Star,
    Navigation2,
    Phone,
    AlertTriangle,
    User,
    Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { calculateDistance, calculateRiderEarnings } from "../../logistics/utils/logistics-utils";

interface ShipmentCardProps {
    shipment: any;
    onClick: () => void;
}

export function ShipmentCardV2({ shipment, onClick }: ShipmentCardProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const status = shipment?.status?.toLowerCase() || 'pending';
    const isBroadcast = !shipment.rider_id;
    
    const getStatusStyles = (s: string) => {
        switch (s) {
            case 'pending': return "bg-amber-100 text-amber-700 border-amber-200/50";
            case 'accepted': return "bg-orange-100 text-[#E96F28] border-orange-200/50";
            case 'started': return "bg-indigo-100 text-indigo-700 border-indigo-200/50";
            case 'arrived': return "bg-purple-100 text-purple-700 border-purple-200/50";
            case 'picked_up': return "bg-pink-100 text-pink-700 border-pink-200/50";
            case 'delivered': return "bg-emerald-100 text-emerald-700 border-emerald-200/50";
            case 'completed': return "bg-gray-100 text-gray-700 border-gray-200/50";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const updateStatus = async (newStatus: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Use the Order ID as the unique link for the shipment record
            const orderId = shipment.order_id || shipment.id;
            
            // Try to get rider location
            let currentLat = null;
            let currentLng = null;
            try {
                if (navigator.geolocation) {
                    const pos: any = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    currentLat = pos.coords.latitude;
                    currentLng = pos.coords.longitude;
                }
            } catch (err) {
                console.warn("Could not get rider location", err);
            }
            
            // Handle SEND Package Mission Claim & Transitions
            if (shipment.is_send_order || String(shipment.id || '').startsWith('LSEND')) {
                const sendOrderId = shipment.order_id || shipment.id;
                if (newStatus === 'accepted') {
                    const { data: claimData, error: claimError } = await (supabase as any).rpc("claim_send_order_mission", {
                        p_order_id: sendOrderId,
                        p_rider_id: user?.id
                    });
                    if (claimError) throw claimError;
                    if (!claimData?.success) throw new Error(claimData?.error || "Mission already accepted");
                } else {
                    const statusMap: Record<string, string> = {
                        'started': 'assigned_rider',
                        'arrived': 'pickup',
                        'picked_up': 'on_the_way',
                        'delivered': 'delivered',
                    };
                    const mappedStatus = statusMap[newStatus] || newStatus;
                    const updatePayload: any = {
                        status: mappedStatus,
                        updated_at: new Date().toISOString(),
                    };
                    if (currentLat && currentLng) {
                        updatePayload.rider_lat = currentLat;
                        updatePayload.rider_lng = currentLng;
                    }
                    if (mappedStatus === 'delivered') {
                        updatePayload.delivered_at = new Date().toISOString();
                    }
                    await (supabase as any)
                        .from("send_orders")
                        .update(updatePayload)
                        .eq("id", sendOrderId);
                }
                queryClient.invalidateQueries({ queryKey: ["logistics-shipments-v2"] });
                toast.success(`Send Package updated to ${newStatus.toUpperCase()}`);
                return;
            }

            if (newStatus === 'accepted') {
                // Prefer order_id for the RPC — the updated function handles both
                // shipment IDs and order IDs, but order_id is the reliable fallback
                // when no shipment row exists yet (broadcast-only flow).
                const missionId = shipment.order_id || shipment.id;
                const { data: claimData, error: claimError } = await (supabase as any).rpc("claim_order_mission", {
                    p_shipment_id: missionId,
                    p_rider_id: user?.id
                });

                if (claimError) throw claimError;
                if (!claimData?.success) {
                    throw new Error(claimData?.error || "Mission already accepted");
                }
                
                // Quick patch for coordinates if fetched
                if (currentLat && currentLng) {
                    await supabase.from("shipments").update({
                        rider_latitude: currentLat,
                        rider_longitude: currentLng,
                    }).eq("order_id", orderId);
                }
            } else {
                // For all other transitions, update the existing shipment record
                const updatePayload: any = { 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                };
                
                if (currentLat && currentLng) {
                    updatePayload.rider_latitude = currentLat;
                    updatePayload.rider_longitude = currentLng;
                }

                const { error } = await supabase
                    .from("shipments")
                    .update(updatePayload)
                    .eq("order_id", orderId);

                if (error) throw error;
            }
            
            queryClient.invalidateQueries({ queryKey: ["logistics-shipments-v2"] });
            queryClient.invalidateQueries({ queryKey: ["logistics-details"] });
            toast.success(
                newStatus === 'delivered' 
                    ? `Mission delivered! ₦${calculateRiderEarnings(shipment).toLocaleString()} credited to your escrow wallet.`
                    : `Mission updated to ${newStatus.toUpperCase()}`
            );
        } catch (error: any) {
            console.error("Mission Update Failure:", error);
            toast.error("Status update failed: " + (error.message || "Unknown error"));
        }
    };

    const isSendOrder = shipment.is_send_order || String(shipment.id || '').startsWith("LSEND") || String(shipment.order_id || '').startsWith("LSEND");
    const riderEarnings = calculateRiderEarnings(shipment);

    const senderName = shipment.sender_name || shipment.seller?.name || shipment.seller?.full_name || (isSendOrder ? "Sender" : "Merchant/Seller");
    const senderPhone = shipment.sender_phone || shipment.seller?.phone || "";
    const pickupAddress = shipment.pickup_address || "Pickup address pending";
    const pickupDirections = shipment.pickup_directions || "";

    const recipientName = shipment.recipient_name || shipment.dropoff_recipient_name || shipment.buyer?.name || shipment.buyer?.full_name || (isSendOrder ? "Recipient" : "Buyer");
    const recipientPhone = shipment.recipient_phone || shipment.dropoff_recipient_phone || shipment.buyer?.phone || "";
    const deliveryAddress = shipment.delivery_address || shipment.dropoff_address || "Drop-off destination pending";
    const dropoffDirections = shipment.dropoff_directions || "";

    const packageDetails = shipment.package_details;

    return (
        <div 
            onClick={onClick}
            className="w-full text-left bg-white rounded-[32px] p-6 border border-black/[0.04] shadow-sm hover:shadow-xl hover:border-orange-100 transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner",
                        getStatusStyles(status)
                    )}>
                        <Package size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Mission Ref.</p>
                            {isSendOrder && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-black uppercase">
                                    SEND
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-black text-foreground tracking-tight uppercase mt-0.5">#{String(shipment.id || '').slice(-8)}</p>
                    </div>
                </div>
                
                <Badge className={cn(
                    "px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-none",
                    getStatusStyles(status)
                )}>
                    {isBroadcast ? "Available" : status}
                </Badge>
            </div>

            {/* PACKAGE DETAILS HIGHLIGHT BOX (for Send Orders) */}
            {isSendOrder && (
                <div className="mb-4 p-3 rounded-2xl bg-orange-500/5 border border-orange-500/20 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                            📦 Package Details
                        </span>
                        {packageDetails?.weight_kg && (
                            <Badge variant="outline" className="text-[10px] font-bold border-orange-200 text-orange-800 bg-white">
                                {packageDetails.weight_kg <= 2 ? 'Small (Under 2kg)' : `${packageDetails.weight_kg}kg`}
                            </Badge>
                        )}
                    </div>
                    {packageDetails?.contents && (
                        <div className="text-xs text-foreground flex items-center gap-1.5 font-semibold">
                            <span className="text-muted-foreground font-normal text-[11px]">Item:</span>
                            <span className="text-foreground font-bold">{packageDetails.contents}</span>
                            {packageDetails.is_fragile && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">
                                    Fragile ⚠️
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* SENDER & RECIPIENT FULL ROUTE INFORMATION */}
            <div className="space-y-4 mb-5">
                <div className="flex items-start gap-3">
                    <div className="mt-1 flex flex-col items-center gap-1">
                        <div className="w-3 h-3 rounded-full border-2 border-[#E96F28] bg-white shrink-0" />
                        <div className="w-0.5 h-14 bg-gray-100 rounded-full" />
                        <div className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
                    </div>

                    <div className="flex-1 space-y-3.5">
                        {/* Sender info */}
                        <div className="leading-tight">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    {isSendOrder ? "Sender (Pickup)" : "Pickup Point"}
                                </p>
                                {senderPhone && (
                                    <a
                                        href={`tel:${senderPhone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E96F28] hover:underline"
                                    >
                                        <Phone size={11} />
                                        <span>{senderPhone}</span>
                                    </a>
                                )}
                            </div>
                            <p className="text-[12px] font-extrabold text-foreground mt-0.5">{senderName}</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{pickupAddress}</p>
                            {pickupDirections && (
                                <p className="text-[10.5px] italic text-muted-foreground/90 mt-0.5">
                                    Note: "{pickupDirections}"
                                </p>
                            )}
                        </div>

                        {/* Recipient info */}
                        <div className="leading-tight pt-1 border-t border-dashed border-gray-100">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                    {isSendOrder ? "Recipient (Drop-off)" : "Drop-off Destination"}
                                </p>
                                {recipientPhone && (
                                    <a
                                        href={`tel:${recipientPhone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
                                    >
                                        <Phone size={11} />
                                        <span>{recipientPhone}</span>
                                    </a>
                                )}
                            </div>
                            <p className="text-[12px] font-extrabold text-foreground mt-0.5">{recipientName}</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">{deliveryAddress}</p>
                            {dropoffDirections && (
                                <p className="text-[10.5px] italic text-muted-foreground/90 mt-0.5">
                                    Note: "{dropoffDirections}"
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 pt-5 border-t border-black/[0.03]">
                {/* Metrics Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Navigation2 size={16} className="text-[#E96F28] fill-[#E96F28]" />
                            <span className="text-sm font-black text-foreground tracking-tight">{shipment.distance_km || "0.0"} <span className="text-[10px] text-muted-foreground uppercase">km</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/80 shadow-sm">
                            <Banknote size={15} className="text-emerald-700" />
                            <span className="text-sm font-black text-emerald-950 tracking-tight">₦{riderEarnings.toLocaleString()}</span>
                            <span className="text-[9px] text-emerald-800 uppercase font-black tracking-wider">Your Cut</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-[#E96F28] group-hover:translate-x-1 transition-transform">
                        <span className="text-[11px] font-black uppercase tracking-widest">Route</span>
                        <ChevronRight size={16} strokeWidth={3} />
                    </div>
                </div>

                {/* Quick Actions Action Bar */}
                <div className="flex gap-2 w-full">
                    {isBroadcast && (
                        <Button 
                            onClick={(e) => updateStatus('accepted', e)}
                            className="w-full h-12 rounded-2xl bg-[#E96F28] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
                        >
                            <span>Accept Mission</span>
                            <span className="opacity-60">·</span>
                            <span className="text-white/95 font-black">₦{riderEarnings.toLocaleString()} Payout</span>
                        </Button>
                    )}

                    {status === 'assigned' && (
                        <Button 
                            onClick={(e) => updateStatus('picked_up', e)}
                            className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Confirm Pickup
                        </Button>
                    )}

                    {status === 'picked_up' && (
                        <Button 
                            onClick={(e) => updateStatus('in_transit', e)}
                            className="w-full h-11 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Start Delivery
                        </Button>
                    )}

                    {status === 'in_transit' && (
                        <Button 
                            onClick={(e) => updateStatus('delivered', e)}
                            className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Handed to Buyer
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
