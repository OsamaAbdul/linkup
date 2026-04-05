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
    Percent,
    Info,
    Navigation,
    Route
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
    generateMapsUrl 
} from "../utils/logistics-utils";

interface MissionDetailsModalProps {
    shipment: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MissionDetailsModal({ shipment, open, onOpenChange }: MissionDetailsModalProps) {

    // logging the shipments details

    console.log("this is the shipments:", shipment)
    const queryClient = useQueryClient();

    // Fetch full shipment details if missing or as a source of truth
    const { data: fullShipment, isLoading: shipmentLoading } = useQuery({
        queryKey: ["shipment-details", shipment?.id],
        queryFn: async () => {
            if (!shipment?.id) return null;
            const { data, error } = await (supabase as any)
                .from("shipments")
                .select(`*, order:orders (*, buyer:profiles!buyer_id (*), seller:profiles!seller_id (*))`)
                .eq("id", shipment.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!shipment?.id && open,
    });

    const activeShipment = fullShipment || shipment;

    // Subscribe to live shipment updates
    useEffect(() => {
        if (!open || !activeShipment?.id) return;

        const channel = supabase
            .channel(`shipment-tracking-${activeShipment.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'shipments',
                    filter: `id=eq.${activeShipment.id}`
                },
                () => {
                    // Refetch details on status change
                    queryClient.invalidateQueries({ queryKey: ["shipment-details", activeShipment.id] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [open, activeShipment?.id, queryClient]);

    // Fetch items associated with this shipment/order
    const { data: items = [], isLoading: itemsLoading } = useQuery({
        queryKey: ["shipment-items", activeShipment?.order_id || activeShipment?.id],
        queryFn: async () => {
            const orderId = activeShipment?.order_id || (activeShipment as any)?.order?.id;
            if (!orderId) return [];
            
            const { data, error } = await (supabase as any)
                .from("order_items")
                .select("*, products(title, images)")
                .eq("order_id", orderId);
            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: !!(activeShipment?.order_id || (activeShipment as any)?.order?.id) && open,
    });

    const updateStatus = useMutation({
        mutationFn: async (newStatus: any) => {
            const { error } = await (supabase as any)
                .from("shipments")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", shipment.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agent-shipments"] });
            toast.success("Shipment status updated");
            onOpenChange(false);
        },
    });

    if (!shipment) return null;

    const buyer = getBuyerContact(activeShipment);
    const sellerInfo = getSellerInfo(activeShipment);
    
    const handleOpenMaps = (mode: 'pickup' | 'delivery' = 'delivery') => {
        const mapsUrl = generateMapsUrl(activeShipment, mode);
        if (mapsUrl) {
            window.open(mapsUrl, "_blank");
        } else {
            toast.error(`Target ${mode} location data missing`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] md:max-h-[85vh] rounded-3xl p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-white">
                <div className="bg-primary/5 p-6 border-b border-primary/10 flex-shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Package size={18} strokeWidth={3} />
                                    </div>
                                    Mission Details
                                </DialogTitle>
                                <DialogDescription className="text-[11px] font-bold text-muted-foreground pt-1">
                                    Track and manage Shipment #{shipment.id.slice(-8)}
                                </DialogDescription>
                            </div>
                            <Badge className={cn(
                                "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border-none",
                                activeShipment.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                                activeShipment.status === 'accepted' ? 'bg-indigo-100 text-indigo-700' :
                                activeShipment.status === 'out_for_pickup' ? 'bg-amber-100 text-amber-700' :
                                activeShipment.status === 'arrived_at_seller' ? 'bg-orange-100 text-orange-700' :
                                activeShipment.status === 'picked_up' ? 'bg-purple-100 text-purple-700' :
                                activeShipment.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-700' :
                                activeShipment.status === 'arrived_at_destination' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-green-100 text-green-700'
                            )}>
                                {activeShipment.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30">
                    <div className="p-6 space-y-6">
                        {/* Contact Information */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Seller Identity */}
                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Smartphone size={12} strokeWidth={3} />
                                    Seller Contact
                                </h4>
                                <div className="bg-muted/30 p-4 rounded-2xl border border-black/[0.03]">
                                    <p className="font-black text-sm">{sellerInfo.name}</p>
                                    <p className="text-xs font-bold text-primary mt-0.5">{sellerInfo.phone}</p>
                                </div>
                            </section>

                            {/* Consignee Identity */}
                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <Smartphone size={12} strokeWidth={3} />
                                    Consignee Identity
                                </h4>
                                <div className="bg-muted/30 p-4 rounded-2xl border border-black/[0.03]">
                                    <p className="font-black text-sm">{buyer.name}</p>
                                    <p className="text-xs font-bold text-primary mt-0.5">{buyer.phone}</p>
                                </div>
                            </section>
                        </div>

                        {/* Item List */}
                        <section className="space-y-3">
                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Package size={12} strokeWidth={3} />
                                Bundle Inventory
                            </h4>
                            
                            {/* Detailed Earnings Breakdown */}
                            <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-4 mb-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h5 className="text-[10px] font-black text-green-700 uppercase tracking-widest flex items-center gap-2">
                                        <Banknote size={12} />
                                        Total Earnings
                                    </h5>
                                    <span className="text-sm font-black text-green-700">
                                        ₦{activeShipment.delivery_fee_amount || 0}
                                    </span>
                                </div>
                                
                                {activeShipment.fee_breakdown && (
                                    <div className="space-y-1.5 border-t border-green-500/10 pt-3">
                                        <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                                            <span>Base Pickup Fee</span>
                                            <span>₦{activeShipment.fee_breakdown.base_fee || 0}</span>
                                        </div>
                                        {activeShipment.fee_breakdown.zone_bonus > 0 && (
                                            <div className="flex justify-between text-[10px] font-bold text-orange-600">
                                                <span>Out-of-Zone Bonus</span>
                                                <span>+ ₦{activeShipment.fee_breakdown.zone_bonus}</span>
                                            </div>
                                        )}
                                        {activeShipment.fee_breakdown.distance_surcharge > 0 && (
                                            <div className="flex justify-between text-[10px] font-bold text-blue-600">
                                                <span>Distance Surcharge ({activeShipment.fee_breakdown.distance_km}km)</span>
                                                <span>+ ₦{activeShipment.fee_breakdown.distance_surcharge}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {!activeShipment.fee_breakdown && activeShipment.status === 'broadcast' && (
                                    <div className="flex items-center gap-2 text-[9px] font-medium text-muted-foreground bg-white/50 p-2 rounded-lg italic">
                                        <Info size={10} />
                                        Final payout includes bonuses for distance and out-of-zone travel.
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                {itemsLoading ? (
                                    <div className="flex items-center gap-2 py-4 text-muted-foreground italic text-xs">
                                        <Loader2 className="animate-spin" size={12} />
                                        Retrieving item manifest...
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="text-[10px] text-muted-foreground italic bg-muted/20 p-4 rounded-xl text-center">
                                        No items found in manifest
                                    </div>
                                ) : items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-black/5 shadow-sm">
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
                            <div className="space-y-4 relative before:absolute before:left-[11px] before:top-4 before:bottom-4 before:w-[2px] before:bg-black/5">
                                <div className="flex items-start justify-between gap-4 z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-orange-600/20">
                                            <MapPin size={10} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Pickup Node ({sellerInfo.name})</p>
                                            <p className="text-[11px] font-bold text-foreground line-clamp-2">
                                                {getPickupAddress(activeShipment)}
                                            </p>
                                        </div>
                                    </div>
                                    <Button 
                                        size="sm" variant="outline" 
                                        className="h-8 px-3 text-[9px] font-black uppercase tracking-widest border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 shrink-0 shadow-sm rounded-full"
                                        onClick={() => handleOpenMaps('pickup')}
                                    >
                                        <Navigation size={10} className="mr-1" /> Navigate
                                    </Button>
                                </div>
                                <div className="flex items-start justify-between gap-4 z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-600/20">
                                            <Navigation size={10} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-tighter">Delivery Node</p>
                                            <p className="text-[11px] font-bold text-foreground line-clamp-2">
                                                {getDeliveryAddress(activeShipment)}
                                            </p>
                                        </div>
                                    </div>
                                    <Button 
                                        size="sm" variant="outline" 
                                        className="h-8 px-3 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 shrink-0 shadow-sm rounded-full"
                                        onClick={() => handleOpenMaps('delivery')}
                                    >
                                        <Navigation size={10} className="mr-1" /> Navigate
                                    </Button>
                                </div>
                            </div>
                        </section>

                        {/* Actions */}
                        <div className="space-y-3 pt-6 border-t border-black/[0.03] pb-6">
                            {activeShipment.status === 'assigned' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('accepted')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <CheckCircle size={14} strokeWidth={3} />
                                    Accept Mission
                                </Button>
                            )}
                            {activeShipment.status === 'accepted' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('out_for_pickup')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <Navigation size={14} strokeWidth={3} />
                                    Start Pickup Journey
                                </Button>
                            )}
                            {activeShipment.status === 'out_for_pickup' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('arrived_at_seller')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <MapPin size={14} strokeWidth={3} />
                                    Arrived at Seller
                                </Button>
                            )}
                            {activeShipment.status === 'arrived_at_seller' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('picked_up')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <Truck size={14} strokeWidth={3} />
                                    Confirm Handoff
                                </Button>
                            )}
                            {activeShipment.status === 'picked_up' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('out_for_delivery')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <Navigation size={14} strokeWidth={3} />
                                    Start Delivery Journey
                                </Button>
                            )}
                            {activeShipment.status === 'out_for_delivery' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-cyan-600 hover:bg-cyan-700 text-white shadow-xl shadow-cyan-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('arrived_at_destination')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <MapPin size={14} strokeWidth={3} />
                                    Arrived at Destination
                                </Button>
                            )}
                            {activeShipment.status === 'arrived_at_destination' && (
                                <Button
                                    className="w-full rounded-2xl h-12 font-black text-[10px] uppercase tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20 active:scale-95 transition-all gap-2"
                                    onClick={() => updateStatus.mutate('delivered')}
                                    disabled={updateStatus.isPending || shipmentLoading}
                                >
                                    <CheckCircle size={14} strokeWidth={3} />
                                    Finalize Delivery
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="w-full rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-black/5"
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

