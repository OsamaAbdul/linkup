import React from "react";
import { 
    MapPin, 
    ArrowUpRight, 
    Clock, 
    Package, 
    ChevronRight,
    Star,
    Navigation2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { calculateDistance } from "../../logistics/utils/logistics-utils";

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
            
            if (newStatus === 'accepted') {
                const { data: claimData, error: claimError } = await (supabase as any).rpc("claim_order_mission", {
                    p_shipment_id: shipment.id,
                    p_rider_id: user?.id
                });

                if (claimError) throw claimError;
                if (!claimData?.success) {
                    throw new Error(claimData?.error || "Mission already accepted");
                }
            } else {
                // For all other transitions, update the existing shipment record
                const { error } = await supabase
                    .from("shipments")
                    .update({ 
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq("order_id", orderId);

                if (error) throw error;
            }
            
            queryClient.invalidateQueries({ queryKey: ["logistics-shipments-v2"] });
            toast.success(`Mission updated to ${newStatus.toUpperCase()}`);
        } catch (error: any) {
            console.error("Mission Update Failure:", error);
            toast.error("Status update failed: " + (error.message || "Unknown error"));
        }
    };

    return (
        <div 
            onClick={onClick}
            className="w-full text-left bg-white rounded-[32px] p-6 border border-black/[0.04] shadow-sm hover:shadow-xl hover:border-orange-100 transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner",
                        getStatusStyles(status)
                    )}>
                        <Package size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Mission Ref.</p>
                        <p className="text-base font-black text-foreground tracking-tight uppercase">#{shipment.id?.slice(-6)}</p>
                    </div>
                </div>
                
                <Badge className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-none",
                    getStatusStyles(status)
                )}>
                    {isBroadcast ? "Available" : status}
                </Badge>
            </div>

            <div className="space-y-5 mb-6">
                <div className="flex items-start gap-4">
                    <div className="mt-1 flex flex-col items-center gap-1">
                        <div className="w-3 h-3 rounded-full border-2 border-[#E96F28] bg-white" />
                        <div className="w-0.5 h-8 bg-gray-100 rounded-full" />
                        <div className="w-3 h-3 rounded-full bg-[#E96F28]" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Pickup Point</p>
                            <p className="text-[14px] font-bold text-foreground line-clamp-1">{shipment.pickup_address_text || "Retrieving point..."}</p>
                        </div>
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Drop-off Hub</p>
                            <p className="text-[14px] font-bold text-foreground line-clamp-1">{shipment.delivery_address_text || "Retrieving destination..."}</p>
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
                        <div className="flex items-center gap-1.5">
                            <Clock size={16} className="text-muted-foreground" />
                            <span className="text-sm font-black text-foreground tracking-tight">₦ {shipment.delivery_fee_amount?.toLocaleString() || "0"} <span className="text-[10px] text-muted-foreground uppercase">fee</span></span>
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
                            className="w-full h-11 rounded-2xl bg-[#E96F28] hover:bg-orange-700 text-white font-black text-[11px] uppercase tracking-widest shadow-lg shadow-orange-600/20"
                        >
                            Accept Mission
                        </Button>
                    )}

                    {status === 'accepted' && (
                        <Button 
                            onClick={(e) => updateStatus('started', e)}
                            className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Start Mission
                        </Button>
                    )}

                    {status === 'started' && (
                        <Button 
                            onClick={(e) => updateStatus('arrived', e)}
                            className="w-full h-11 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Arrived at Pickup
                        </Button>
                    )}

                    {status === 'arrived' && (
                        <Button 
                            onClick={(e) => updateStatus('picked_up', e)}
                            className="w-full h-11 rounded-2xl bg-pink-600 hover:bg-pink-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Confirm Pickup
                        </Button>
                    )}

                    {status === 'picked_up' && (
                        <Button 
                            onClick={(e) => updateStatus('delivered', e)}
                            className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest"
                        >
                            Mark Delivered
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
