import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Package, User, MapPin, Calendar, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

export default function AdminOrderTracker() {
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    const { data: orders, isLoading } = useQuery({
        queryKey: ["admin-all-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*, profiles:buyer_id(display_name, id)")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    if (isLoading) return <div className="p-12 text-center text-muted-foreground font-bold bg-white rounded-xl">Global Order Tracker Loading...</div>;

    const renderOrderDetails = (order: any) => {
        if (!order) return null;
        const items = order.items as any[] || [];
        const shipping = order.shipping_address as any || {};

        return (
            <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                            <User size={14} className="text-primary" />
                            Customer Identification
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="font-bold text-sm">{(order.profiles as any)?.display_name || "Guest"}</p>
                            <p className="text-[10px] font-medium text-muted-foreground mt-1">ID: {order.buyer_id}</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                            <Calendar size={14} className="text-primary" />
                            Temporal Marker
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="font-bold text-sm">{new Date(order.created_at).toLocaleString()}</p>
                            <p className="text-[10px] font-medium text-muted-foreground mt-1 text-primary lowercase tracking-tighter">System Recorded</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <Package size={14} className="text-primary" />
                        Manifest Contents ({items.length} Units)
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-muted-foreground">
                                    <th className="px-4 py-3">Item Descriptor</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 text-right">Valuation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {items.map((item: any, i: number) => (
                                    <tr key={i}>
                                        <td className="px-4 py-3 font-bold">{item.title || item.name || "Unknown Product"}</td>
                                        <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right font-black">‚¦{(item.price || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-indigo-50/50">
                                    <td colSpan={2} className="px-4 py-4 font-black uppercase text-[10px] tracking-widest">Aggregate Valuation</td>
                                    <td className="px-4 py-4 text-right font-black text-primary text-sm">‚¦{(order.total || 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
                        <MapPin size={14} className="text-primary" />
                        Logistic Endpoint (Shipping)
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-sm font-medium leading-relaxed">
                            {shipping.address}<br />
                            {shipping.city}, {shipping.state}<br />
                            <span className="font-bold text-primary">{shipping.phone}</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Global Order Registry</h2>
                <Badge className="bg-primary/10 text-primary border-none">{orders?.length} Total Orders</Badge>
            </div>

            <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Order ID</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Customer</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders?.map((o) => (
                                <tr key={o.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-8 py-6 font-mono text-xs font-bold text-primary">#{o.id.slice(0, 8)}</td>
                                    <td className="px-8 py-6">
                                        <p className="font-bold text-sm text-foreground">{(o.profiles as any)?.display_name || "Guest"}</p>
                                    </td>
                                    <td className="px-8 py-6 text-xs font-medium text-muted-foreground">
                                        {new Date(o.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-6 font-black text-sm">‚¦{(o.total || 0).toLocaleString()}</td>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent className="max-w-2xl rounded-xl border-none shadow-2xl overflow-hidden p-0 bg-white">
                    <div className="bg-primary/5 p-8 border-b border-gray-100">
                        <DialogHeader>
                            <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-primary text-white border-none font-black text-[9px] uppercase tracking-widest rounded-full py-1">
                                    Order Analysis
                                </Badge>
                                <Badge variant="outline" className="border-primary/20 text-primary font-bold text-[10px] rounded-xl px-3 py-1">
                                    ST-OR-{selectedOrder?.id?.slice(0, 5).toUpperCase()}
                                </Badge>
                            </div>
                            <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2">
                                Order Details Extraction
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-muted-foreground">
                                Granular breakdown of order manifest, logistics endpoint, and customer data.
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

