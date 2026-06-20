import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Eye, Package, User, MapPin, Calendar, Smartphone, Bike, Copy, Banknote, ShieldCheck, ArrowUpRight, AlertTriangle, Loader2, Play } from "lucide-react";
import { cn, maskPII } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/components/ui/dialog";

export default function AdminOrderTracker() {
    const [pageSize, setPageSize] = useState(50);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isSettling, setIsSettling] = useState(false);

    const { data: orders, isLoading } = useQuery({
        queryKey: ["admin-all-orders", pageSize],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    profiles:buyer_id(display_name, id),
                    order_recipient(full_name, phone, address_line, city_id, zone_id, lat, lng),
                    shipments(*)
                `)
                .order("created_at", { ascending: false })
                .limit(pageSize);
            if (error) throw error;

            // Fetch riders manually to bypass missing foreign key relation
            const riderIds = new Set<string>();
            data?.forEach(o => {
                const ships = Array.isArray(o.shipments) ? o.shipments : (o.shipments ? [o.shipments] : []);
                ships.forEach((s: any) => { if (s.rider_id) riderIds.add(s.rider_id); });
            });

            if (riderIds.size > 0) {
                const { data: riders } = await supabase.from("profiles").select("id, display_name, phone, avatar_url").in("id", Array.from(riderIds));
                const riderMap = new Map(riders?.map(r => [r.id, r]) || []);
                
                data?.forEach(o => {
                    const ships = Array.isArray(o.shipments) ? o.shipments : (o.shipments ? [o.shipments] : []);
                    ships.forEach((s: any) => {
                        if (s.rider_id) {
                            s.rider = riderMap.get(s.rider_id);
                        }
                    });
                });
            }

            return data;
        },
        refetchInterval: 30000, // Refresh admin view every 30 seconds
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    if (isLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-xl">Loading all orders...</div>;

    const renderOrderDetails = (order: any) => {
        if (!order) return null;
        const items = order.items as any[] || [];
        // Handle both 1-1 (object) and 1-N (array) relationships for shipments
        const shipment = Array.isArray(order.shipments) ? order.shipments[0] : order.shipments;

        const shipping = order.order_shipping?.[0] || order.order_shipping || {};
        const rider = shipment?.rider || (shipment as any)?.profiles;

        const handleReleaseFunds = async () => {
            if (!confirm("Are you sure you want to release these funds immediately? This will bypass the 48h hold and move funds to the main balance.")) {
                return;
            }

            try {
                setIsSettling(true);
                const { data, error } = await (supabase as any).rpc("admin_release_order_funds", {
                    p_order_id: order.id
                });

                if (error) throw error;
                const result = data as any;

                if (result.success) {
                    import("sonner").then(({ toast }) => {
                        toast.success(result.message || "Funds released successfully");
                    });
                    setSelectedOrder(null);
                    // Standard refetch handled by the query key
                } else {
                    throw new Error(result.error || "Failed to release funds");
                }
            } catch (err: any) {
                console.error("RELEASE_ERROR", err);
                import("sonner").then(({ toast }) => {
                    toast.error(err.message || "Failed to trigger release");
                });
            } finally {
                setIsSettling(false);
            }
        };

        console.log("Logistic Synthesis:", { shipment, shipping, rider });

        return (
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                            <User size={14} className="text-primary" />
                            Customer Info
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="font-bold text-sm">{(order.profiles as any)?.display_name || "Guest"}</p>
                            <p className="text-[10px] font-medium text-muted-foreground mt-1">ID: {order.buyer_id}</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                            <Calendar size={14} className="text-primary" />
                            Date & Time
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="font-bold text-sm">{new Date(order.created_at).toLocaleString()}</p>
                            <p className="text-[10px] font-medium text-muted-foreground mt-1 text-primary lowercase tracking-tighter">Order Placement Time</p>
                        </div>
                    </div>
                </div>

                {/* Rider Information Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <Bike size={14} className="text-primary" />
                        Delivery Agent Info
                    </div>
                    {rider ? (
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden border-2 border-white shadow-sm">
                                    {rider.avatar_url ? (
                                        <img src={rider.avatar_url} alt={rider.display_name} className="h-full w-full object-cover" />
                                    ) : (
                                        rider.display_name?.charAt(0) || "R"
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{rider.display_name || "Assigned Rider"}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Smartphone size={10} className="text-muted-foreground" />
                                        <a href={`tel:${rider.phone}`} className="text-[10px] font-medium text-primary hover:underline transition-all">
                                            {maskPII(rider.phone)}
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <Badge className="bg-primary text-white border-none font-black text-[8px] uppercase tracking-widest px-2">
                                Delivery Partner
                            </Badge>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 border-dashed text-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Agent Assigned Yet</p>
                            <p className="text-[9px] text-muted-foreground mt-1 italic">Waiting for a driver to take the order.</p>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <Package size={14} className="text-primary" />
                        Package Items ({items.length})
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-muted-foreground">
                                    <th className="px-4 py-3">Product Name</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map((item: any, i: number) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 font-bold">{item.title || item.name || "Unknown Product"}</td>
                                        <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right font-black">₦ {(item.price || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-indigo-50/50">
                                    <td colSpan={2} className="px-4 py-4 font-black uppercase text-[10px] tracking-widest">Total Price</td>
                                    <td className="px-4 py-4 text-right font-black text-primary text-sm">₦{(order.total_amount || 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <Bike size={14} className="text-primary" />
                        Mission Control (Logistics V2)
                    </div>
                    {shipment ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-2">Tracking Code</p>
                                <div className="flex items-center justify-between">
                                    <code className="text-xs font-black text-primary select-all">
                                        {shipment.tracking_code || "GEN-000-000"}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 rounded-md hover:bg-white"
                                        onClick={() => {
                                            navigator.clipboard.writeText(shipment.tracking_code);
                                            // Optional: show a mini toast
                                        }}
                                    >
                                        <Copy size={12} className="text-muted-foreground" />
                                    </Button>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-2">Verification PINs</p>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-mono text-[10px]">
                                        PICK: {shipment.pickup_code || "----"}
                                    </Badge>
                                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 font-mono text-[10px]">
                                        DROP: {shipment.delivery_code || "----"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-1 sm:col-span-2 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Distance</p>
                                        <p className="text-xs font-bold">{shipment.distance_km ? `${shipment.distance_km.toFixed(1)} KM` : "---"}</p>
                                    </div>
                                    <div className="h-8 w-px bg-gray-200" />
                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Logistics Status</p>
                                        <p className="text-xs font-bold uppercase tracking-tighter text-indigo-600">{shipment.status || "N/A"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 border-dashed text-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Active Shipment Record</p>
                        </div>
                    )}
                </div>

                {/* Financial Ledger Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <Banknote size={14} className="text-primary" />
                        Financial Payout Ledger
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 bg-gray-50/30">
                            {[
                                { label: 'Rider Payout', key: 'rider', icon: Bike, color: 'text-indigo-600' },
                                { label: 'Seller Payout', key: 'seller', icon: User, color: 'text-emerald-600' },
                                { label: 'Platform Rev', key: 'platform', icon: ShieldCheck, color: 'text-blue-600' },
                                { label: 'Promoter', key: 'promoter', icon: ArrowUpRight, color: 'text-orange-600' }
                            ].map((item: any) => {
                                const value = shipment?.fee_breakdown?.[item.key] || 0;
                                return (
                                    <div key={item.key} className="p-4 flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 opacity-60">
                                            <item.icon size={10} />
                                            <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
                                        </div>
                                        <p className={cn("text-sm font-black", item.color)}>
                                            ₦{Number(value).toLocaleString()}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="px-4 py-3 bg-indigo-50/50 flex items-center justify-between">
                            <span className="text-[9px] font-black text-indigo-800 uppercase tracking-widest">Total Distribution</span>
                            <span className="text-xs font-black text-indigo-900 leading-none">
                                ₦{(order.total_amount || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Action Button for Manual Release */}
                    {order.status !== 'completed' && order.status !== 'delivered' ? (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm text-amber-600">
                                <AlertTriangle size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-amber-900 uppercase tracking-tighter">Settlement on Hold</p>
                                <p className="text-[10px] text-amber-700 font-medium">Funds can only be released after delivery.</p>
                            </div>
                        </div>
                    ) : order.settlement_status === 'settled' ? (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm text-emerald-600">
                                <ShieldCheck size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-900 uppercase tracking-tighter">Settlement Finalized</p>
                                <p className="text-[10px] text-emerald-700 font-medium tracking-tight">Funds have been successfully moved to main balances.</p>
                            </div>
                        </div>
                    ) : (
                        <Button 
                            onClick={handleReleaseFunds}
                            disabled={isSettling}
                            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            {isSettling ? (
                                <>
                                    <Loader2 size={16} className="animate-spin mr-2" />
                                    Processing Release...
                                </>
                            ) : (
                                <>
                                    <Play size={14} className="mr-2 fill-current" />
                                    Release Payouts Now
                                </>
                            )}
                        </Button>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <MapPin size={14} className="text-primary" />
                        Shipping Address
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-sm font-medium leading-relaxed">
                            {shipping.address_line || shipment?.delivery_address || "Address Unspecified"}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">All Orders</h2>
                <Badge className="bg-primary/10 text-primary border-none">{orders?.length} Total Orders</Badge>
            </div>

            <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Order ID</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tracking</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Customer</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rider</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders?.map((o) => {
                                // Handle both 1-1 (object) and 1-N (array) relationships for shipments
                                const shipment: any = Array.isArray((o as any).shipments)
                                    ? (o as any).shipments[0]
                                    : (o as any).shipments;

                                const rider = shipment?.rider || shipment?.profiles;
                                return (
                                    <tr key={o.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-8 py-6 font-mono text-xs font-bold text-primary">#{o.id.slice(0, 8)}</td>
                                        <td className="px-8 py-6">
                                            {shipment?.tracking_code ? (
                                                <div className="flex flex-col">
                                                    <code className="text-[10px] font-black text-foreground">
                                                        {shipment.tracking_code}
                                                    </code>
                                                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">V2 Logistics</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-medium text-muted-foreground italic">No Tracker</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="font-bold text-sm text-foreground">{(o.profiles as any)?.display_name || "Guest"}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            {rider ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 border-2 border-white shadow-sm overflow-hidden">
                                                        {rider.avatar_url ? (
                                                            <img src={rider.avatar_url} className="h-full w-full object-cover" alt={rider.display_name || "Agent"} />
                                                        ) : (
                                                            rider.display_name?.charAt(0) || "R"
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <p className="font-black text-xs text-foreground truncate">{rider.display_name || "Agent"}</p>
                                                        {rider.phone && (
                                                            <a
                                                                href={`tel:${rider.phone}`}
                                                                className="text-[10px] font-bold text-primary hover:underline transition-all flex items-center gap-1 mt-0.5"
                                                            >
                                                                <Smartphone size={8} />
                                                                {rider.phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 opacity-40 italic">
                                                    <Bike size={14} className="text-muted-foreground" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Unassigned</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-xs font-medium text-muted-foreground">
                                            {new Date(o.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-6 font-black text-sm">₦{(o.total_amount || 0).toLocaleString()}</td>
                                        <td className="px-8 py-6">
                                            <Badge className={cn(
                                                "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                                                o.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                                    o.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                                        o.status === 'awaiting_agent' ? 'bg-orange-100 text-orange-800' :
                                                            o.status === 'accepted' ? 'bg-indigo-100 text-indigo-800' :
                                                                o.status === 'picked_up' ? 'bg-purple-100 text-purple-800' :
                                                                    o.status === 'out_for_delivery' ? 'bg-blue-100 text-blue-800' :
                                                                        o.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                                            o.status === 'completed' ? 'bg-black text-white' :
                                                                                'bg-muted text-muted-foreground'
                                            )}>
                                                {o.status.replace(/_/g, ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-xl group-hover:bg-white group-hover:shadow-sm"
                                                onClick={() => setSelectedOrder(o)}
                                            >
                                                <Eye size={18} />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {orders && orders.length >= pageSize && (
                    <div className="p-6 bg-gray-50/30 border-t border-gray-100 flex justify-center">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold text-[10px] uppercase tracking-widest px-8 bg-white hover:bg-primary hover:text-white transition-all border-none shadow-sm"
                            onClick={() => setPageSize(prev => prev + 50)}
                        >
                            Load More Historical Data
                        </Button>
                    </div>
                )}
            </Card>

            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent className="max-w-2xl rounded-xl border-none shadow-2xl overflow-hidden p-0 bg-white">
                    <div className="bg-primary/5 p-8 border-b border-gray-100">
                        <DialogHeader>
                            <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-primary text-white border-none font-black text-[9px] uppercase tracking-widest rounded-full py-1">
                                    Order Summary
                                </Badge>
                                <Badge variant="outline" className="border-primary/20 text-primary font-bold text-[10px] rounded-xl px-3 py-1">
                                    ST-OR-{selectedOrder?.id?.slice(0, 5).toUpperCase()}
                                </Badge>
                            </div>
                            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                                Order Details
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground">
                                Full list of items, shipping location, and customer details.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="px-8 pb-8 max-h-[70vh] overflow-y-auto">
                        {renderOrderDetails(selectedOrder)}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

