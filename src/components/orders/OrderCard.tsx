import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Store, Smartphone, Activity, ChevronUp, ChevronDown, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTimeline } from "./OrderTimeline";
import { OrderShipmentIntel } from "./OrderShipmentIntel";
import { ShipmentStatusHistory } from "./ShipmentStatusHistory";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface OrderCardProps {
    order: {
        id: string;
        title: string;
        price: number;
        image: string;
        store: string;
        status: string;
        displayStatus: string;
        shipment?: any;
        sellerId?: string;
    };
}

export function OrderCard({ order }: OrderCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [issueTitle, setIssueTitle] = useState("");
    const [issueDescription, setIssueDescription] = useState("");
    const [issuePriority, setIssuePriority] = useState("low");
    const { user } = useAuth();

    const reportIssueMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Auth required");
            const { error } = await supabase
                .from("issues" as any)
                .insert([{
                    user_id: user.id,
                    order_id: order.id,
                    seller_id: order.sellerId,
                    title: issueTitle,
                    description: issueDescription,
                    priority: issuePriority,
                    status: "open"
                }]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Security ticket broadcasted to administration");
            setIsReportModalOpen(false);
            setIssueTitle("");
            setIssueDescription("");
        },
        onError: (err: any) => {
            toast.error("Transmission failed: " + err.message);
        }
    });
    const queryClient = useQueryClient();

    const confirmDeliveryMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Auth required");

            // Call the RPC which atomically:
            // 1. Sets order status to 'completed'
            // 2. Credits seller (95%) and rider (5%) wallets
            const { data, error } = await (supabase as any).rpc("complete_order_and_settle", {
                p_order_id: order.id,
            });

            if (error) throw new Error(error.message);
            if (!data?.success) throw new Error(data?.error || "Settlement failed — no earnings credited");

            return data;
        },
        onSuccess: (data) => {
            const earned = data.seller_credited ? `₦${Number(data.seller_credited).toLocaleString()} released to seller.` : "";
            toast.success(`Order finalized! ${earned}`, { duration: 5000 });
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        },
        onError: (err: any) => {
            toast.error("Finalization failed: " + err.message);
        }
    });

    return (
        <Card className="rounded-[2rem] border-black/[0.03] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_40px_rgb(0,0,0,0.05)] transition-all duration-500 overflow-hidden group">
            <CardContent className="p-0">
                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6">
                    {/* Visual Asset */}
                    <div className="relative w-full md:w-32 h-48 md:h-32 rounded-2xl overflow-hidden bg-muted border border-black/5 flex-shrink-0 group-hover:shadow-lg transition-shadow duration-500">
                        {order.image ? (
                            <img src={order.image} alt={order.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2 p-4">
                                <Smartphone size={24} strokeWidth={1} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-center">No Identity</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[10px] font-black text-primary/60 uppercase tracking-widest">
                                    <Store size={12} />
                                    {order.store}
                                </div>
                                <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors duration-300">{order.title}</h3>
                            </div>

                            <Badge className={cn(
                                "rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none shadow-sm",
                                ["pending", "confirmed", "processing", "awaiting_agent"].includes(order.status.toLowerCase()) ? "bg-amber-100 text-amber-700" :
                                    ["accepted", "out_for_pickup", "arrived_at_seller", "picked_up", "out_for_delivery", "arrived_at_destination", "shipped"].includes(order.status.toLowerCase()) ? "bg-blue-100 text-blue-700" :
                                        ["delivered", "completed"].includes(order.status.toLowerCase()) ? "bg-green-100 text-green-700" :
                                            "bg-red-100 text-red-700"
                            )}>
                                {order.displayStatus}
                            </Badge>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                            <p className="text-2xl md:text-3xl font-black text-primary tracking-tighter">
                                <span className="text-lg opacity-60 mr-1">₦</span>
                                {order.price.toLocaleString()}
                            </p>

                            <div className="flex items-center gap-2">
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Transaction ID</p>
                                    <code className="text-[11px] font-mono text-foreground font-bold">{order.id.slice(0, 12).toUpperCase()}</code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Extended Tracking Interface */}
                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-muted/5 border-t border-black/[0.03]">
                    <div className="px-6 md:px-8 py-4 flex items-center justify-between">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="rounded-full text-[10px] font-black uppercase tracking-widest gap-2 text-primary h-10 px-6">
                                {isOpen ? (
                                    <>
                                        <ChevronUp size={14} strokeWidth={3} />
                                        Close Status
                                    </>
                                ) : (
                                    <>
                                        <Activity size={14} strokeWidth={3} />
                                        Track this order..
                                    </>
                                )}
                            </Button>
                        </CollapsibleTrigger>

                        <div className="flex gap-3">
                            {order.status.toLowerCase() === "delivered" && (
                                <Button
                                    className="rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 text-[10px] font-black uppercase tracking-widest h-10 px-6 active:scale-95 transition-transform gap-2"
                                    onClick={() => confirmDeliveryMutation.mutate()}
                                    disabled={confirmDeliveryMutation.isPending}
                                >
                                    {confirmDeliveryMutation.isPending ? <Activity className="animate-spin" size={14} /> : <CheckCircle size={14} strokeWidth={3} />}
                                    Confirm Receipt & Finalize
                                </Button>
                            )}
                            {order.status.toLowerCase() === "completed" && (
                                <Button
                                    className="rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest h-10 px-6 gap-2 cursor-not-allowed opacity-80"
                                    disabled
                                >
                                    <CheckCircle size={14} strokeWidth={3} />
                                    Order Finalized ✓
                                </Button>
                            )}
                            {!["delivered", "completed"].includes(order.status.toLowerCase()) && (
                                <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-full border-black/10 text-[10px] font-black uppercase tracking-widest h-10 px-6 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all">
                                            <AlertCircle size={14} className="mr-2" /> Report Issue
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-[2.5rem] max-w-md border-none shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-2xl font-black">Report a Delivery Issue</DialogTitle>
                                            <DialogDescription className="font-medium">
                                                Broadcast a high-priority ticket to our neural administration network.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-6 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Issue Subject</Label>
                                                <input
                                                    id="title"
                                                    placeholder="e.g. Delayed Delivery, Damaged Item"
                                                    className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                                                    value={issueTitle}
                                                    onChange={(e) => setIssueTitle(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="priority" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Priority Level</Label>
                                                <Select value={issuePriority} onValueChange={setIssuePriority}>
                                                    <SelectTrigger className="h-12 bg-gray-50 border-none rounded-2xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20">
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl border-none shadow-xl">
                                                        <SelectItem value="low">Standard Priority</SelectItem>
                                                        <SelectItem value="high">High Urgency</SelectItem>
                                                        <SelectItem value="critical">Critical - System Failure</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="desc" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detailed Intelligence</Label>
                                                <Textarea
                                                    id="desc"
                                                    placeholder="Describe the anomalies in detail..."
                                                    className="min-h-[120px] bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                                                    value={issueDescription}
                                                    onChange={(e) => setIssueDescription(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                className="w-full h-12 rounded-2xl font-black bg-primary shadow-xl shadow-primary/20 active:scale-95 transition-all"
                                                onClick={() => reportIssueMutation.mutate()}
                                                disabled={reportIssueMutation.isPending || !issueTitle || !issueDescription}
                                            >
                                                {reportIssueMutation.isPending ? "Broadcasting..." : "Submit Report"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>

                    <CollapsibleContent className="animate-in slide-in-from-top-4 duration-500">
                        <div className="px-6 md:px-8 pb-10 pt-6">
                            <OrderTimeline status={order.status} shipmentStatus={order.shipment?.status} />
                            {order.shipment?.id && (
                                <ShipmentStatusHistory shipmentId={order.shipment.id} />
                            )}
                            <OrderShipmentIntel shipment={order.shipment} />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    );
}
