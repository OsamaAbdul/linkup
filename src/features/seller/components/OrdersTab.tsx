import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { ShoppingBag, ChevronRight, Smartphone, MapPin, Truck, Check, ShieldCheck, Activity, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ZoneBroadcastSelector } from "./ZoneBroadcastSelector";
import { useState } from "react";

interface OrdersTabProps {
    orders: any[];
    updateOrderStatus: any;
    sellerZone?: string;
    sellerZoneId?: string;
    sellerCityId?: string;
    sellerAddress?: string;
    broadcastOrder?: (orderId: string, zone: string, zoneId: string, pickupAddress: string, pickupTime: string, lat?: number, lng?: number) => void;
}

export function OrdersTab({ orders, updateOrderStatus, sellerZone, sellerZoneId, sellerCityId, sellerAddress, broadcastOrder }: OrdersTabProps) {
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);



    const handleInitiateBroadcast = (orderId: string) => {
        setActiveOrderId(orderId);
        setSelectorOpen(true);
    };

    const handleZoneBroadcast = (zone: string, zoneId: string, pickupAddress: string, pickupTime: string, lat?: number, lng?: number) => {
        if (activeOrderId && broadcastOrder) {
            broadcastOrder(activeOrderId, zone, zoneId, pickupAddress, pickupTime, lat, lng);
        } else if (activeOrderId) {
            updateOrderStatus.mutate({ id: activeOrderId, status: "awaiting_agent" });
        }
        setSelectorOpen(false);
        setActiveOrderId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>

                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Orders Summary</h1>
            </div>

            <div className="space-y-4">
                {orders.length === 0 ? (
                    <div className="bg-white/50 backdrop-blur-sm border border-dashed border-black/10 rounded-xl p-12 text-center space-y-3">
                        <div className="w-16 h-16 bg-muted/20 rounded-xl flex items-center justify-center mx-auto text-muted-foreground/30">
                            <ShoppingBag size={32} strokeWidth={1} />
                        </div>
                        <div>
                            <p className="font-black text-lg text-foreground tracking-tight">No Active Orders</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 opacity-60 italic">Your orders queue is currently clear.</p>
                        </div>
                    </div>
                ) : orders.map((o) => {
                    const recipient = o.order_recipient || {};
                    const shipment = o.shipments?.[0];
                    const orderStatus = o.status.toLowerCase();
                    const status = (["completed", "disputed", "cancelled", "refunded"].includes(orderStatus))
                        ? orderStatus
                        : (shipment && shipment.status && shipment.status !== 'pending')
                            ? shipment.status.toLowerCase()
                            : orderStatus;
                    return (
                        <Card key={o.id} className="rounded-xl border-black/[0.03] bg-white shadow-sm overflow-hidden group">
                            <div className="bg-muted/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.03]">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary shadow-sm font-mono text-[9px] sm:text-[10px] font-black shrink-0">
                                        #{o.id.slice(0, 4)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Badge className={cn(
                                                "rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none h-fit",
                                                status === "completed" ? "bg-green-100 text-green-700" :
                                                    status === "confirmed" || status === "processing" ? "bg-amber-100 text-amber-700" :
                                                        status === "awaiting_agent" || status === "broadcast" ? "bg-orange-100 text-[#E96F28] animate-pulse" :
                                                            status === "accepted" || status === "assigned" ? "bg-indigo-100 text-indigo-700" :
                                                                status === "out_for_pickup" || status === "arrived_at_seller" ? "bg-amber-100 text-amber-700" :
                                                                    status === "picked_up" || status === "started" ? "bg-purple-100 text-purple-700" :
                                                                        status === "out_for_delivery" || status === "in_transit" ? "bg-orange-100 text-[#E96F28]" :
                                                                            status === "arrived_at_destination" || status === "arrived" ? "bg-cyan-100 text-cyan-700" :
                                                                                "bg-slate-100 text-slate-700"
                                            )}>
                                                {status === "awaiting_agent" || status === "broadcast" ? "Finding Partner" :
                                                    status === "accepted" || status === "assigned" ? "Partner Found" :
                                                        status === "picked_up" || status === "started" ? "In Transit" :
                                                            status.replace(/_/g, " ")}
                                            </Badge>
                                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest border-l pl-2 border-black/10">
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-[11px] font-bold opacity-60 flex items-center gap-1.5">
                                            Transaction Reference
                                            <ChevronRight size={12} className="text-muted-foreground" />
                                        </h3>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Your Earnings</p>
                                    <p className="text-xl sm:text-2xl font-black text-primary tracking-tighter flex items-center sm:justify-end gap-1">
                                        <span className="text-xs sm:text-sm opacity-40">₦</span>
                                        {((o.order_items as any[])?.reduce((sum, item) => sum + (Number(item.price_at_purchase || 0) * (item.quantity || 1)), 0) || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <CardContent className="p-4 sm:p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                                            <ShoppingBag size={12} strokeWidth={3} />
                                            Order Details
                                        </h4>
                                        <div className="space-y-2.5">                                            {(o.order_items as any[])?.map((item: any, idx: number) => {
                                            const productData = item.products || {};
                                            const productTitle = productData.title || "Product";
                                            const productImage = productData.images?.[0] || "";
                                            const purchasePrice = Number(item.price_at_purchase) || 0;

                                            return (
                                                <div key={item.id || idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/5 border border-black/[0.02] shadow-sm hover:shadow-md transition-shadow group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary/40 overflow-hidden">
                                                            {productImage ? (
                                                                <img src={productImage} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Smartphone size={16} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-[13px] text-foreground">{productTitle}</p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[10px] font-bold text-muted-foreground">Qty: {item.quantity}</p>
                                                                {item.size && (
                                                                    <Badge variant="outline" className="h-4 px-1.5 text-[8px] font-black border-primary/20 text-primary bg-primary/5 uppercase">
                                                                        Size: {item.size}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[13px] font-black text-primary">₦{(purchasePrice * (item.quantity || 1)).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 rounded-xl border border-black/[0.03] bg-muted/5 space-y-3">
                                            <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                <MapPin size={12} strokeWidth={3} />
                                                Delivery Destination
                                            </h4>
                                            <div className="space-y-1">
                                                <p className="font-black text-[13px] text-foreground">{recipient.full_name || "Guest Customer"}</p>
                                                <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">{recipient.address_line || "No address provided"}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {(recipient as any).cities?.name && (
                                                        <Badge variant="outline" className="h-5 px-2 text-[8px] font-black border-black/10 text-muted-foreground bg-white uppercase">
                                                            {(recipient as any).cities.name}
                                                        </Badge>
                                                    )}
                                                    {(recipient as any).delivery_zones?.name && (
                                                        <Badge variant="outline" className="h-5 px-2 text-[8px] font-black border-black/10 text-muted-foreground bg-white uppercase">
                                                            {(recipient as any).delivery_zones.name}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>



                                        {/* Assigned Rider Section */}
                                        {o.shipments?.[0] && (
                                            <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-[8px] font-black text-primary uppercase tracking-widest">Connect with a Local Delivery Partner</h5>
                                                    <Badge className="bg-primary/10 text-primary border-none text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
                                                        {o.shipments[0].status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 rounded-xl border border-white">
                                                        <AvatarFallback className="bg-white text-primary text-xs font-black">
                                                            {(o.shipments[0].rider?.display_name || o.shipments[0].profiles?.display_name)?.[0] || "R"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] text-foreground truncate">{(o.shipments[0].rider?.display_name || o.shipments[0].profiles?.display_name) || "Assigned Rider"}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">{o.shipments[0].zone?.split(' (')[0] || "Standard Zone"}</span>
                                                            <span className="w-0.5 h-0.5 rounded-full bg-primary/30" />
                                                            <span className="text-[9px] font-black text-primary/40 uppercase font-mono">{o.shipments[0].tracking_code}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="p-4 sm:p-5 pt-0 flex flex-col sm:flex-row gap-3">
                                {status === "pending" && (
                                    <Button
                                        className="flex-1 rounded-xl h-11 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform gap-2"
                                        onClick={() => {
                                            setActiveOrderId(o.id);
                                            updateOrderStatus.mutate({ id: o.id, status: "confirmed" });
                                        }}
                                        disabled={updateOrderStatus.isPending}
                                    >
                                        {updateOrderStatus.isPending && activeOrderId === o.id ? (
                                            <Activity className="animate-spin" size={14} />
                                        ) : (
                                            <Check size={14} strokeWidth={3} />
                                        )}
                                        {updateOrderStatus.isPending && activeOrderId === o.id ? "Confirming..." : "Accept Order"}
                                    </Button>
                                )}
                                {(status === "confirmed" || status === "processing") && !shipment && (
                                    <Button
                                        className="flex-1 rounded-xl h-11 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform gap-2 bg-primary hover:bg-primary/90"
                                        onClick={() => handleInitiateBroadcast(o.id)}
                                        disabled={updateOrderStatus.isPending}
                                    >
                                        <Truck size={14} strokeWidth={3} />
                                        Find Delivery Partner
                                    </Button>
                                )}
                                {status === "awaiting_agent" && (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-blue-600 font-black text-[9px] uppercase tracking-[0.2em] bg-blue-500/5 rounded-xl border border-blue-500/10 animate-pulse">
                                        <Truck size={14} />
                                        Waiting for a partner to accept...
                                    </div>
                                )}
                                {status === "delivered" && (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-amber-600 font-black text-[9px] uppercase tracking-[0.2em] bg-amber-500/5 rounded-xl border border-amber-500/10 animate-pulse">
                                        <Activity size={14} />
                                        Awaiting Buyer Confirmation
                                    </div>
                                )}

                            </CardFooter>
                        </Card>
                    );
                })}
            </div>

            <ZoneBroadcastSelector
                open={selectorOpen}
                onOpenChange={setSelectorOpen}
                onBroadcast={handleZoneBroadcast}
                isBroadcasting={updateOrderStatus.isPending}
                defaultZone={sellerZone}
                defaultPickupAddress={sellerAddress}
            />
        </div>
    );
}
