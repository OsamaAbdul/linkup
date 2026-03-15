import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Operational Queue</p>
                <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Orders Registry</h1>
            </div>

            <div className="space-y-6">
                {orders.length === 0 ? (
                    <div className="bg-white/50 backdrop-blur-sm border border-dashed border-black/10 rounded-[2.5rem] p-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-muted/20 rounded-[2rem] flex items-center justify-center mx-auto text-muted-foreground/30">
                            <ShoppingBag size={40} strokeWidth={1} />
                        </div>
                        <div>
                            <p className="font-black text-xl text-foreground tracking-tight">No Active Orders</p>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60 italic">Your operational queue is currently clear.</p>
                        </div>
                    </div>
                ) : orders.map((o) => {
                    const shipping = (o.shipping_address as any) || {};
                    const status = o.status.toLowerCase();
                    return (
                        <Card key={o.id} className="rounded-[2.5rem] border-black/[0.03] bg-white shadow-xl shadow-black/[0.02] overflow-hidden group">
                            <div className="bg-muted/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-black/[0.03]">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-3xl bg-white border border-black/5 flex items-center justify-center text-primary shadow-sm font-mono text-xs font-black">
                                        #{o.id.slice(0, 4)}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <Badge className={cn(
                                                "rounded-full px-4 py-1 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
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
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest border-l pl-3 border-black/10">
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-bold opacity-60 flex items-center gap-2">
                                            Transaction Reference Registry
                                            <ChevronRight size={14} className="text-muted-foreground" />
                                        </h3>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Settlement Total</p>
                                    <p className="text-3xl font-black text-primary tracking-tighter flex items-center justify-end gap-1">
                                        <span className="text-base opacity-40">₦</span>
                                        {(o.total || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <CardContent className="p-6 md:p-10">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <ShoppingBag size={14} strokeWidth={3} />
                                            Logistics Bundle
                                        </h4>
                                        <div className="space-y-4">
                                            {(o.items as any[])?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between p-5 rounded-3xl bg-muted/5 border border-black/[0.02] shadow-sm hover:shadow-md transition-shadow group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-white border border-black/5 flex items-center justify-center text-primary/40">
                                                            {item.image ? <img src={item.image} className="w-full h-full object-cover rounded-2xl" /> : <Smartphone size={20} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-sm text-foreground">{item.title || "Standard Asset"}</p>
                                                            <p className="text-[11px] font-bold text-muted-foreground">Quantity: {item.quantity}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-primary">₦{((item.price || 0) * item.quantity).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <MapPin size={14} strokeWidth={3} />
                                            Consignee Identity
                                        </h4>
                                        <div className="p-8 rounded-[2rem] border border-black/5 bg-primary/[0.01] space-y-4 shadow-inner">
                                            <div className="flex items-center gap-4 mb-2">
                                                <Avatar className="h-14 w-14 rounded-2xl border-2 border-primary/5">
                                                    <AvatarFallback className="bg-primary/5 text-primary text-xl font-black">
                                                        {(shipping.receiver_name || shipping.name)?.[0]?.toUpperCase() || "A"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-xl font-black text-foreground tracking-tight">{shipping.receiver_name || shipping.name}</p>
                                                    <p className="text-[11px] font-bold text-primary uppercase tracking-widest">{shipping.phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-3 pt-4 border-t border-black/5">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1 w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary/40 flex-shrink-0">
                                                        <MapPin size={12} strokeWidth={3} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium text-muted-foreground leading-relaxed italic pr-4">{shipping.address}</p>
                                                        {(o as any).cities?.name && (
                                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                                                                {(o as any).cities.name} • {(o as any).delivery_zones?.name || (o.shipping_address as any)?.zone || "Standard Zone"}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Assigned Rider Section */}
                                        {o.shipments?.[0] && (
                                            <div className="p-6 rounded-[2rem] border border-primary/10 bg-primary/5 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h5 className="text-[9px] font-black text-primary uppercase tracking-widest">Assigned Logistics Partner</h5>
                                                    <Badge className="bg-primary text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full ring-2 ring-white shadow-sm">
                                                        {o.shipments[0].status}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-12 w-12 rounded-xl border border-white">
                                                        <AvatarFallback className="bg-white text-primary text-sm font-black">
                                                            {o.shipments[0].profiles?.display_name?.[0] || "R"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-foreground truncate">{o.shipments[0].profiles?.display_name || "Assigned Rider"}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{o.shipments[0].zone?.split(' (')[0] || "Standard Zone"}</span>
                                                            <span className="w-1 h-1 rounded-full bg-primary/30" />
                                                            <span className="text-[10px] font-black text-primary/40 uppercase font-mono">{o.shipments[0].tracking_code}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="p-8 pt-0 flex flex-col md:flex-row gap-4">
                                {status === "pending" && (
                                    <Button
                                        className="flex-1 rounded-2xl h-14 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform gap-2"
                                        onClick={() => {
                                            setActiveOrderId(o.id);
                                            updateOrderStatus.mutate({ id: o.id, status: "confirmed" });
                                        }}
                                        disabled={updateOrderStatus.isPending}
                                    >
                                        {updateOrderStatus.isPending && activeOrderId === o.id ? (
                                            <Activity className="animate-spin" size={16} />
                                        ) : (
                                            <Check size={16} strokeWidth={3} />
                                        )}
                                        {updateOrderStatus.isPending && activeOrderId === o.id ? "Confirming..." : "Accept Order"}
                                    </Button>
                                )}
                                {(status === "confirmed" || status === "processing") && (
                                    <Button
                                        className="flex-1 rounded-2xl h-14 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform gap-2 bg-primary hover:bg-primary/90"
                                        onClick={() => handleInitiateBroadcast(o.id)}
                                        disabled={updateOrderStatus.isPending}
                                    >
                                        <Truck size={16} strokeWidth={3} />
                                        Broadcast to Zone
                                    </Button>
                                )}
                                {status === "awaiting_agent" && (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] bg-blue-500/5 rounded-2xl border border-blue-500/10 animate-pulse">
                                        <Truck size={16} />
                                        Waiting for Agent to Claim
                                    </div>
                                )}
                                {status === "delivered" && (
                                    <div className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-amber-600 font-black text-[10px] uppercase tracking-[0.2em] bg-amber-500/5 rounded-2xl border border-amber-500/10 animate-pulse">
                                        <Activity size={16} />
                                        Awaiting Buyer Confirmation
                                    </div>
                                )}
                                <Button variant="ghost" className="rounded-2xl h-14 px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-black/5" disabled={updateOrderStatus.isPending}>Print Manifest</Button>
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
