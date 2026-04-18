import React, { useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Badge } from "@/shared/components/ui/badge";
import {
    MapPin,
    Loader2,
    Banknote,
    Navigation,
    Route,
    Package,
    Smartphone,
    ArrowRight,
    CheckCircle,
    Truck,
    Clock,
    ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    getPickupAddress,
    getDeliveryAddress,
    getBuyerContact,
    getSellerInfo,
    generateMapsUrl,
    calculateDistance
} from "../../logistics/utils/logistics-utils";

interface MissionDetailsModalV2Props {
    shipment: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MissionDetailsModalV2({ shipment, open, onOpenChange }: MissionDetailsModalV2Props) {
    const queryClient = useQueryClient();

    const { data: fullShipment, isLoading: shipmentLoading } = useQuery({
        queryKey: ["shipment-details-v2", shipment?.id],
        queryFn: async () => {
            if (!shipment?.id) return null;
            
            // Fetch as a list with limit(1) to avoid PGRST116 coercion errors entirely
            const { data, error } = await (supabase as any)
                .from("shipments")
                .select(`*, order:orders (*, order_recipient(*), buyer:profiles!buyer_id (*), seller:profiles!seller_id (*))`)
                .or(`id.eq.${shipment.id},order_id.eq.${shipment.id}`)
                .limit(1);

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        },
        enabled: !!shipment?.id && open,
    });

    const activeShipment = fullShipment || shipment;

    useEffect(() => {
        if (!open || !activeShipment?.id) return;
        const channel = supabase
            .channel(`shipment-tracking-v2-${activeShipment.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shipments', filter: `id=eq.${activeShipment.id}` },
                () => queryClient.invalidateQueries({ queryKey: ["shipment-details-v2", activeShipment.id] }))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [open, activeShipment?.id, queryClient]);

    const updateStatus = useMutation({
        mutationFn: async (newStatus: string) => {
            const orderId = activeShipment?.order_id || activeShipment?.id;
            const currentUserId = (await supabase.auth.getUser()).data.user?.id;

            if (newStatus === 'accepted') {
                const pickLat = activeShipment?.pickup_lat || activeShipment?.order?.seller?.latitude;
                const pickLng = activeShipment?.pickup_lng || activeShipment?.order?.seller?.longitude;
                const dropLat = activeShipment?.delivery_lat || activeShipment?.order?.order_recipient?.[0]?.lat || activeShipment?.order?.order_recipient?.lat || activeShipment?.order?.buyer?.latitude;
                const dropLng = activeShipment?.delivery_lng || activeShipment?.order?.order_recipient?.[0]?.lng || activeShipment?.order?.order_recipient?.lng || activeShipment?.order?.buyer?.longitude;

                // 1. Claim/Initialize the shipment with High-Fidelity Data
                const { error: shipError } = await (supabase as any)
                    .from("shipments")
                    .upsert({ 
                        order_id: orderId,
                        rider_id: currentUserId,
                        seller_id: activeShipment?.seller_id || activeShipment?.order?.seller_id,
                        status: 'accepted',
                        pickup_address: activeShipment?.pickup_address_text,
                        delivery_address: activeShipment?.delivery_address_text,
                        pickup_address_text: activeShipment?.pickup_address_text,
                        delivery_address_text: activeShipment?.delivery_address_text,
                        pickup_lat: pickLat,
                        pickup_lng: pickLng,
                        delivery_lat: dropLat,
                        delivery_lng: dropLng,
                        distance_km: calculateDistance(pickLat, pickLng, dropLat, dropLng),
                        delivery_fee_amount: activeShipment?.delivery_fee_amount || 1500,
                        city_id: activeShipment?.order?.city_id || activeShipment?.order?.order_recipient?.[0]?.city_id || activeShipment?.order?.order_recipient?.city_id,
                        zone_id: activeShipment?.order?.zone_id || activeShipment?.order?.order_recipient?.[0]?.zone_id || activeShipment?.order?.order_recipient?.zone_id,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'order_id' });

                if (shipError) throw shipError;

                // 2. Lock the Order
                const { error: orderError } = await (supabase as any)
                    .from("orders")
                    .update({ status: 'processing', updated_at: new Date().toISOString() })
                    .eq("id", orderId);

                if (orderError) throw orderError;
            } else {
                // Regular status update
                const { error } = await (supabase as any)
                    .from("shipments")
                    .update({ 
                        status: newStatus, 
                        updated_at: new Date().toISOString() 
                    })
                    .eq("order_id", orderId);

                if (error) throw error;
            }
        },
        onSuccess: () => {
            const orderId = activeShipment?.order_id || activeShipment?.id;
            queryClient.invalidateQueries({ queryKey: ["logistics-shipments-v2"] });
            queryClient.invalidateQueries({ queryKey: ["shipment-details-v2", shipment?.id] });
            queryClient.invalidateQueries({ queryKey: ["shipment-details-v2", orderId] });
            toast.success("Mission updated successfully");
        },
        onError: (error: any) => {
            console.error("Mission Update Error:", error);
            toast.error("Failed to update mission: " + (error.message || "Unknown error"));
        }
    });

    if (!shipment) return null;

    const buyer = getBuyerContact(activeShipment);
    const sellerInfo = getSellerInfo(activeShipment);
    
    const handleOpenMaps = (mode: 'pickup' | 'delivery' = 'delivery') => {
        const mapsUrl = generateMapsUrl(activeShipment, mode);
        if (mapsUrl) window.open(mapsUrl, "_blank");
        else toast.error("Location data missing for this node");
    };

    const statusStyles: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700",
        accepted: "bg-orange-100 text-[#E96F28]",
        started: "bg-indigo-100 text-indigo-700",
        arrived: "bg-purple-100 text-purple-700",
        picked_up: "bg-pink-100 text-pink-700",
        delivered: "bg-emerald-100 text-emerald-700",
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] rounded-[40px] p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-white">
                <div className="bg-primary/5 p-8 border-b border-primary/10 flex-shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-[20px] bg-[#E96F28]/10 flex items-center justify-center text-[#E96F28] shadow-inner">
                                    <Package size={24} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Mission Control</DialogTitle>
                                    <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                                        Ref: #{(activeShipment?.order?.id || activeShipment?.id || 'pending').slice(-8)}
                                    </DialogDescription>
                                </div>
                            </div>
                            <Badge className={cn("rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border-none", statusStyles[activeShipment?.status || 'pending'] || "bg-[#E96F28] text-white")}>
                                {activeShipment?.status === 'awaiting_agent' ? 'AVAILABLE' : (activeShipment?.status || 'POOL').replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30">
                    <div className="p-8 space-y-8 pb-32">
                        {/* Financial Snapshot */}
                        <div className="bg-emerald-50/50 p-6 rounded-[32px] border border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-600/20">
                                    <Banknote size={28} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Guaranteed Payout</p>
                                    <p className="text-3xl font-black text-emerald-950 tracking-tighter">₦{(activeShipment?.delivery_fee_amount || activeShipment?.order?.total_amount || 0).toLocaleString()}</p>
                                </div>
                            </div>
                            <ShieldCheck size={32} className="text-emerald-200" />
                        </div>

                        {/* Contacts Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-muted/30 p-5 rounded-[24px] border border-black/[0.03] space-y-2">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Smartphone size={12} strokeWidth={3} /> Seller
                                </p>
                                <p className="font-black text-[15px]">{sellerInfo.name}</p>
                                <p className="text-sm font-bold text-[#E96F28]">{sellerInfo.phone}</p>
                            </div>
                            <div className="bg-muted/30 p-5 rounded-[24px] border border-black/[0.03] space-y-2">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Smartphone size={12} strokeWidth={3} /> Recipient
                                </p>
                                <p className="font-black text-[15px]">{buyer.name}</p>
                                <p className="text-sm font-bold text-[#E96F28]">{buyer.phone}</p>
                            </div>
                        </div>

                        {/* Logistics Trace */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                                <Route size={14} strokeWidth={3} /> Path Trace
                            </h4>
                            <div className="relative space-y-8 before:absolute before:left-[23px] before:top-8 before:bottom-8 before:w-[2px] before:bg-gradient-to-b before:from-orange-500 before:to-[#E96F28] before:opacity-20">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-sm border border-orange-100 flex-shrink-0 z-10">
                                            <MapPin size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="pt-1">
                                            <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Pickup Node</p>
                                            <p className="text-sm font-bold text-foreground line-clamp-2 leading-snug">{getPickupAddress(activeShipment)}</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => handleOpenMaps('pickup')}>
                                        Map
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-[#E96F28] shadow-sm border border-orange-100 flex-shrink-0 z-10">
                                            <Navigation size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="pt-1">
                                            <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Delivery Node</p>
                                            <p className="text-sm font-bold text-foreground line-clamp-2 leading-snug">{getDeliveryAddress(activeShipment)}</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest border-orange-200 text-[#E96F28] hover:bg-orange-50" onClick={() => handleOpenMaps('delivery')}>
                                        Map
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-4 bg-muted/20 border-t border-black/[0.03] space-y-3">
                    {/* Integrated Action Logic */}
                    {!activeShipment.rider_id && (
                        <Button className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-[#E96F28] hover:bg-orange-700 text-white shadow-xl shadow-orange-600/20" onClick={() => updateStatus.mutate('accepted')}>
                            Accept Mission
                        </Button>
                    )}
                    {activeShipment.status === 'accepted' && (
                        <Button className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => updateStatus.mutate('started')}>
                            Start Journey
                        </Button>
                    )}
                    {activeShipment.status === 'started' && (
                        <Button className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-purple-600 hover:bg-purple-700 text-white" onClick={() => updateStatus.mutate('arrived')}>
                            Arrived at Pickup
                        </Button>
                    )}
                    {activeShipment.status === 'arrived' && (
                        <Button className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-pink-600 hover:bg-pink-700 text-white" onClick={() => updateStatus.mutate('picked_up')}>
                            Confirm Pickup
                        </Button>
                    )}
                    {activeShipment.status === 'picked_up' && (
                        <Button className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20" onClick={() => updateStatus.mutate('delivered')}>
                            Complete Delivery
                        </Button>
                    )}
                    
                    <Button variant="ghost" className="w-full font-black text-[10px] uppercase tracking-widest text-muted-foreground h-12" onClick={() => onOpenChange(false)}>
                        Close Control Center
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
