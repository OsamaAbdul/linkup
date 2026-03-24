import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { ShoppingBag, ChevronRight, Smartphone, MapPin, Truck, Check, ShieldCheck, Activity } from "lucide-react";
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
    broadcastOrder?: (orderId: string, zone: string, zoneId: string, pickupAddress: string, pickupTime: string) => void;
}

export function OrdersTab({ orders, updateOrderStatus, sellerZone, sellerZoneId, sellerCityId, sellerAddress, broadcastOrder }: OrdersTabProps) {
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

    const handleInitiateBroadcast = (orderId: string) => {
        setActiveOrderId(orderId);
        setSelectorOpen(true);
    };

    const handleZoneBroadcast = (zone: string, zoneId: string, pickupAddress: string, pickupTime: string) => {
        if (activeOrderId && broadcastOrder) {
            broadcastOrder(activeOrderId, zone, zoneId, pickupAddress, pickupTime);
        } else if (activeOrderId) {
            updateOrderStatus.mutate({ id: activeOrderId, status: "awaiting_agent" });
        }
        setSelectorOpen(false);
        setActiveOrderId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Operational Queue</p>
                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Orders Registry</h1>
            </div>

            <div className="space-y-4">
                {orders.length === 0 ? (
                    <div className="bg-white/50 backdrop-blur-sm border border-dashed border-black/10 rounded-xl p-12 text-center space-y-3">
                        <div className="w-16 h-16 bg-muted/20 rounded-xl flex items-center justify-center mx-auto text-muted-foreground/30">
                            <ShoppingBag size={32} strokeWidth={1} />
                        </div>
                        <div>
                            <p className="font-black text-lg text-foreground tracking-tight">No Active Orders</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 opacity-60 italic">Your operational queue is currently clear.</p>
                        </div>
                    </div>
                ) : orders.map((o) => {
                    const shipping = (o.shipping_address as any) || {};
                    const status = o.status.toLowerCase();
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
                                                "rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest border-none shadow-sm",
                                                status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                    status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                                        status === 'awaiting_agent' ? 'bg-orange-100 text-orange-800' :
                                                            status === 'accepted' ? 'bg-indigo-100 text-indigo-800' :
                                                                status === 'picked_up' ? 'bg-purple-100 text-purple-800' :
                                                                    status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800' :
                                                                        status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                                            status === 'completed' ? 'bg-black text-white' :
                                                                                'bg-muted text-muted-foreground'
                                            )}>
                                                {status.replace(/_/g, ' ')}
                                            </Badge>
                                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest border-l pl-2 border-black/10">
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-[11px] font-bold opacity-60 flex items-center gap-1.5">
                                            Transaction Reference Registry
                                            <ChevronRight size={12} className="text-muted-foreground" />
                                        </h3>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Settlement Total</p>
                                    <p className="text-xl sm:text-2xl font-black text-primary tracking-tighter flex items-center sm:justify-end gap-1">
                                        <span className="text-xs sm:text-sm opacity-40">₦</span>
                                        {(o.total || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <CardContent className="p-4 sm:p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                                            <ShoppingBag size={12} strokeWidth={3} />
                                            Logistics Bundle
                                        </h4>
                                        <div className="space-y-2.5">
                                            {(o.items as any[])?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-muted/5 border border-black/[0.02] shadow-sm hover:shadow-md transition-shadow group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary/40">
                                                            {item.image ? <img src={item.image} className="w-full h-full object-cover rounded-xl" /> : <Smartphone size={16} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-[13px] text-foreground">{item.title || "Standard Asset"}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground">Qty: {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[13px] font-black text-primary">₦{((item.price || 0) * item.quantity).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                                            <MapPin size={12} strokeWidth={3} />
                                            Consignee Identity
                                        </h4>
                                        <div className="p-4 sm:p-5 rounded-xl border border-black/5 bg-primary/[0.01] space-y-3 shadow-inner">
                                            <div className="flex items-center gap-3 mb-1">
                                                <Avatar className="h-10 w-10 rounded-xl border-2 border-primary/5">
                                                    <AvatarFallback className="bg-primary/5 text-primary text-lg font-black">
                                                        {(shipping.receiver_name || shipping.name)?.[0]?.toUpperCase() || "A"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm sm:text-base font-black text-foreground tracking-tight">{shipping.receiver_name || shipping.name}</p>
                                                    <p className="text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-widest">{shipping.phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 pt-3 border-t border-black/5">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="mt-0.5 w-5 h-5 rounded bg-white shadow-sm flex items-center justify-center text-primary/40 flex-shrink-0">
                                                        <MapPin size={10} strokeWidth={3} />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <p className="text-[13px] font-medium text-muted-foreground leading-snug italic pr-4">{shipping.address}</p>
                                                        {(o as any).cities?.name && (
                                                            <p className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                                                                {(o as any).cities.name} €¢ {(o as any).delivery_zones?.name || (o.shipping_address as any)?.zone || "Standard Zone"}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Assigned Rider Section */}
                                        {o.shipments?.[0] && (
                                            <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-[8px] font-black text-primary uppercase tracking-widest">Assigned Logistics Partner</h5>
                                                    <Badge className="bg-primary text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full ring-2 ring-white shadow-sm">
                                                        {o.shipments[0].status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 rounded-xl border border-white">
                                                        <AvatarFallback className="bg-white text-primary text-xs font-black">
                                                            {o.shipments[0].profiles?.display_name?.[0] || "R"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-[13px] text-foreground truncate">{o.shipments[0].profiles?.display_name || "Assigned Rider"}</p>
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
                                {(status === "confirmed" || status === "processing") && (
                                    <Button
                                        className="flex-1 rounded-xl h-11 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform gap-2 bg-primary hover:bg-primary/90"
                                        onClick={() => handleInitiateBroadcast(o.id)}
                                        disabled={updateOrderStatus.isPending}
                                    >
                                        <Truck size={14} strokeWidth={3} />
                                        Broadcast to Zone
                                    </Button>
                                )}
                                {status === "awaiting_agent" && (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-blue-600 font-black text-[9px] uppercase tracking-[0.2em] bg-blue-500/5 rounded-xl border border-blue-500/10 animate-pulse">
                                        <Truck size={14} />
                                        Waiting for Agent to Claim
                                    </div>
                                )}
                                {status === "delivered" && (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-amber-600 font-black text-[9px] uppercase tracking-[0.2em] bg-amber-500/5 rounded-xl border border-amber-500/10 animate-pulse">
                                        <Activity size={14} />
                                        Awaiting Buyer Confirmation
                                    </div>
                                )}
                                <Button variant="ghost" className="rounded-xl h-11 px-6 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:bg-black/5" disabled={updateOrderStatus.isPending}>Print Manifest</Button>
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

