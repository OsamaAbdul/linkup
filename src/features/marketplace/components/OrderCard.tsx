import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Store, Smartphone, Activity, ChevronUp, ChevronDown, AlertCircle, CheckCircle, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTimeline } from "./OrderTimeline";
import { OrderShipmentIntel } from "./OrderShipmentIntel";
import { ShieldAlert, Scale, ArrowRight, MessageSquare } from "lucide-react";
import { ShipmentStatusHistory } from "./ShipmentStatusHistory";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { LiveTrackingMap } from "./LiveTrackingMap";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
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
        productId?: string;
        size?: string;
    };
}

export function OrderCard({ order }: OrderCardProps) {

    const [isOpen, setIsOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
    const [issueTitle, setIssueTitle] = useState("");
    const [issueDescription, setIssueDescription] = useState("");
    const [issuePriority, setIssuePriority] = useState("low");
    
    // Dispute state
    const [disputeReason, setDisputeReason] = useState("");
    const [disputeDetails, setDisputeDetails] = useState("");
    
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Fetch dispute details if disputed
    const { data: disputeData } = useQuery({
        queryKey: ["order-dispute", order.id],
        queryFn: async () => {
            if (!user || order.status.toLowerCase() !== "disputed") return null;
            const { data, error } = await supabase
                .from("issues" as any)
                .select("*")
                .eq("order_id", order.id)
                .eq("category", "financial_dispute")
                .single();
            if (error) return null;
            return data;
        },
        enabled: !!user && order.status.toLowerCase() === "disputed",
    });

    // Fetch related issues for exact buyer id (Initiator)
    const { data: relatedIssues } = useQuery({
        queryKey: ["buyer-issues", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("issues" as any)
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });
            if (error) return [];
            return data;
        },
        enabled: !!user && order.status.toLowerCase() === "disputed",
    });

    const reportIssueMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Auth required");
            const { error } = await supabase
                .from("issues" as any)
                .insert([{
                    user_id: user.id,
                    order_id: order.id,
                    seller_id: order.sellerId,
                    product_id: order.productId, // Link to specific product
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

    const raiseDisputeMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Authentication protocol required");
            
            // 1. Insert into unified issues table
            const { error: disputeError } = await supabase
                .from("issues" as any)
                .insert([{
                    user_id: user.id,
                    order_id: order.id,
                    seller_id: order.sellerId,
                    product_id: order.productId,
                    category: "financial_dispute", // Distinguish from technical tickets
                    title: `Financial Dispute: ${disputeReason}`,
                    description: disputeDetails,
                    priority: "high",
                    status: "open"
                }]);
            
            if (disputeError) throw disputeError;

            // 2. Update order status to 'disputed'
            const { error: orderError } = await supabase
                .from("orders")
                .update({ status: "disputed" })
                .eq("id", order.id);
            
            if (orderError) throw orderError;
        },
        onSuccess: () => {
            toast.success("Judicial claim recorded successfully", {
                description: "Order status updated to 'Disputed'. Administration has been notified.",
            });
            setIsDisputeModalOpen(false);
            setDisputeReason("");
            setDisputeDetails("");
            queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
        },
        onError: (err: any) => {
            toast.error("Dispute failed: " + err.message);
        }
    });

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
            if (!data?.success) throw new Error(data?.error || "Settlement failed no earnings credited");

            return data;
        },
        onSuccess: (data) => {
            const earned = data.seller_credited ? `₦${Number(data.seller_credited).toLocaleString()} released to seller.` : "";
            toast.success(`Order finalized! ${earned}`, { duration: 5000 });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
        onError: (err: any) => {
            toast.error("Finalization failed: " + err.message);
        }
    });

    const isTrackingActive = order.shipment?.status && 
        ["accepted", "started", "out_for_pickup", "arrived_at_seller", "picked_up", "out_for_delivery", "arrived_at_destination"].includes(order.shipment.status.toLowerCase());

    return (
        <Card className="rounded-xl border-black/[0.03] bg-white shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden group">
            <CardContent className="p-0">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5">
                    {/* Visual Asset */}
                    <div className="relative w-full sm:w-24 h-40 sm:h-24 rounded-lg overflow-hidden bg-muted border border-black/5 flex-shrink-0 group-hover:shadow-lg transition-shadow duration-500">
                        {order.image ? (
                            <img src={order.image} alt={order.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1 p-3">
                                <Smartphone size={20} strokeWidth={1} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-center">No Identity</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                            <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5 text-primary/60">
                                        <Store size={10} />
                                        {order.store}
                                    </div>
                                    {order.shipment?.pickup_address && (
                                        <div className="flex items-center gap-1.5 text-orange-600/80 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                                            <MapPin size={10} strokeWidth={3} />
                                            {typeof order.shipment.pickup_address === 'string' 
                                                ? order.shipment.pickup_address 
                                                : (order.shipment.pickup_address as any)?.address || "Pickup Node"}
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight group-hover:text-primary transition-colors duration-300 line-clamp-1">{order.title}</h3>
                            </div>

                            <Badge className={cn(
                                "rounded-full px-2.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest border-none shadow-sm shrink-0",
                                ["pending", "confirmed", "processing", "awaiting_agent"].includes(order.status.toLowerCase()) ? "bg-amber-100 text-amber-700" :
                                    ["accepted", "out_for_pickup", "arrived_at_seller", "picked_up", "out_for_delivery", "arrived_at_destination", "shipped"].includes(order.status.toLowerCase()) ? "bg-blue-100 text-blue-700" :
                                        ["delivered", "completed"].includes(order.status.toLowerCase()) ? "bg-green-100 text-green-700" :
                                            "bg-red-100 text-red-700"
                            )}>
                                {order.displayStatus}
                            </Badge>
                        </div>

                        <div className="flex flex-row items-center justify-between gap-2 pt-1">
                            <div className="flex items-baseline gap-2">
                                <p className="text-xl sm:text-2xl font-black text-primary tracking-tighter">
                                    <span className="text-xs sm:text-sm opacity-60 mr-0.5">₦</span>
                                    {order.price.toLocaleString()}
                                </p>
                                {order.size && (
                                    <Badge variant="outline" className="rounded-full h-5 px-2 text-[8px] font-black border-primary/20 text-primary bg-primary/5 uppercase">
                                        Size: {order.size}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="text-right">
                                    <p className="text-[7px] sm:text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">ID</p>
                                    <code className="text-[9px] sm:text-[10px] font-mono text-foreground font-bold">{order.id.slice(0, 12).toUpperCase()}</code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Extended Tracking Interface */}
                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-muted/5 border-t border-black/[0.02]">
                    <div className="px-4 sm:p-5 py-3 flex flex-wrap items-center justify-between gap-3">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="rounded-full text-[9px] font-black uppercase tracking-widest gap-2 text-primary h-8 px-4">
                                {isOpen ? (
                                    <>
                                        <ChevronUp size={12} strokeWidth={3} />
                                        Close Status
                                    </>
                                ) : (
                                    <>
                                        <Activity size={12} strokeWidth={3} className={cn(isTrackingActive && "animate-pulse text-emerald-500")} />
                                        {isTrackingActive ? "Tracking Live.." : "Track this order.."}
                                        {isTrackingActive && (
                                            <span className="flex h-2 w-2 relative -top-1">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                        )}
                                    </>
                                )}
                            </Button>
                        </CollapsibleTrigger>

                        <div className="flex gap-2.5">
                            {["delivered", "shipped", "out_for_delivery", "picked_up"].includes(order.status.toLowerCase()) && (
                                <Button
                                    className="rounded-full bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 text-[9px] font-black uppercase tracking-widest h-8 px-4 active:scale-95 transition-transform gap-2"
                                    onClick={() => confirmDeliveryMutation.mutate()}
                                    disabled={confirmDeliveryMutation.isPending}
                                >
                                    {confirmDeliveryMutation.isPending ? <Activity className="animate-spin" size={12} /> : <CheckCircle size={12} strokeWidth={3} />}
                                    Accept Order & Finalize
                                </Button>
                            )}
                            {order.status.toLowerCase() === "completed" && (
                                <Button
                                    className="rounded-full bg-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest h-8 px-4 gap-1.5 cursor-not-allowed opacity-80"
                                    disabled
                                >
                                    <CheckCircle size={12} strokeWidth={3} />
                                    Order Finalized successfully
                                </Button>
                            )}
                            {/* General Issue Reporting (For non-delivered orders) */}
                            {!["delivered", "completed", "cancelled", "refunded", "disputed"].includes(order.status.toLowerCase()) && (
                                <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-full border-black/10 text-[9px] font-black uppercase tracking-widest h-8 px-4 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all">
                                            <AlertCircle size={12} className="mr-1.5" /> Report Issue
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-xl max-w-md border-none shadow-2xl p-6">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-black">Report a Delivery Issue</DialogTitle>
                                            <DialogDescription className="text-xs font-medium">
                                                Broadcast a high-priority ticket to our neural administration network.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-6 py-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Issue Subject</Label>
                                                <input
                                                    id="title"
                                                    placeholder="e.g. Delayed Delivery, Damaged Item"
                                                    className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                                                    value={issueTitle}
                                                    onChange={(e) => setIssueTitle(e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="priority" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Urgency Level</Label>
                                                <Select value={issuePriority} onValueChange={setIssuePriority}>
                                                    <SelectTrigger className="h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20">
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-xl">
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
                                                    className="min-h-[120px] bg-gray-50 border-none rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20"
                                                    value={issueDescription}
                                                    onChange={(e) => setIssueDescription(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter className="sm:flex-col gap-2">
                                            <Button
                                                className="w-full h-11 rounded-xl font-black bg-primary shadow-lg shadow-primary/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                                                onClick={() => reportIssueMutation.mutate()}
                                                disabled={reportIssueMutation.isPending || !issueTitle || !issueDescription}
                                            >
                                                {reportIssueMutation.isPending ? "Broadcasting..." : "Submit Report"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {/* Dispute Tracking (When already disputed) */}
                            {order.status.toLowerCase() === "disputed" && disputeData && (
                                <div className="mt-4 p-4 rounded-2xl bg-red-50/50 border border-red-100/50 backdrop-blur-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200">
                                                <Scale size={14} />
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-600">Dispute Under Review</h4>
                                                <p className="text-[8px] font-bold text-red-400 uppercase tracking-tight">Case ID: {disputeData.id.slice(0, 8).toUpperCase()}</p>
                                            </div>
                                        </div>
                                        <Badge className={cn(
                                            "rounded-full text-[8px] font-black uppercase tracking-widest px-2 py-0.5",
                                            disputeData.status === 'open' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                        )}>
                                            {disputeData.status}
                                        </Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-start gap-3">
                                            <MessageSquare size={12} className="text-red-400 mt-1 flex-shrink-0" />
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{disputeData.title}</p>
                                                <p className="text-xs font-medium text-foreground italic leading-relaxed">"{disputeData.description}"</p>
                                            </div>
                                        </div>

                                        {disputeData.resolution_meta && (
                                            <div className="mt-3 pt-3 border-t border-red-100/50 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert size={12} className="text-emerald-600" />
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Official Resolution</p>
                                                </div>
                                                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                                                    <p className="text-xs font-bold text-emerald-800 mb-1">
                                                        Protocol: {disputeData.resolution_meta.resolution === 'refund' ? "Buyer Refund Issued" : "Funds Released to Seller"}
                                                    </p>
                                                    <p className="text-[10px] font-medium text-emerald-600 leading-relaxed italic">
                                                        "{disputeData.resolution_meta.notes || "Resolved by Neural Administration"}"
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Buyer reported issues intelligence */}
                                        {relatedIssues && relatedIssues.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-red-100/20 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Activity size={10} className="text-muted-foreground" />
                                                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Historical Intelligence (Buyer Identity)</p>
                                                </div>
                                                <div className="space-y-2">
                                                    {relatedIssues.map((issue: any) => (
                                                        <div key={issue.id} className="bg-white/40 p-2.5 rounded-xl border border-black/[0.03] space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-black uppercase text-primary">#{issue.id.slice(0, 8)} • {issue.title}</span>
                                                                <Badge variant="outline" className="h-4 text-[7px] border-black/10 px-1.5">{issue.status}</Badge>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-muted-foreground line-clamp-1 italic">"{issue.description}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Financial Dispute Trigger (For delivered/completed orders) */}
                            {["delivered", "completed"].includes(order.status.toLowerCase()) && (
                                <Dialog open={isDisputeModalOpen} onOpenChange={setIsDisputeModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="rounded-full border-red-200 text-[9px] font-black uppercase tracking-widest h-8 px-4 text-red-600 hover:bg-red-50 transition-all">
                                            <AlertCircle size={12} className="mr-1.5" /> Raise Dispute
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-xl max-w-md border-none shadow-2xl p-6 bg-white">
                                        <DialogHeader>
                                            <DialogTitle className="text-2xl font-black text-red-600">Initialize Dispute</DialogTitle>
                                            <DialogDescription className="text-xs font-medium text-muted-foreground">
                                                Raising a dispute will immediately halt financial settlement. Use this if the product arrived damaged or is not as described.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-6 py-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dispute Protocol</Label>
                                                <Select value={disputeReason} onValueChange={setDisputeReason}>
                                                    <SelectTrigger className="h-12 bg-gray-50 border-none rounded-xl px-4 text-sm font-bold">
                                                        <SelectValue placeholder="Select primary reason" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                                        <SelectItem value="item_mismatch">Item not as described</SelectItem>
                                                        <SelectItem value="damaged">Product arrived damaged</SelectItem>
                                                        <SelectItem value="missing_parts">Missing components</SelectItem>
                                                        <SelectItem value="counterfeit">Product authenticity issue</SelectItem>
                                                        <SelectItem value="other">Other discrepancies</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Intelligence Report</Label>
                                                <Textarea
                                                    placeholder="State your case with absolute precision..."
                                                    className="min-h-[120px] bg-gray-50 border-none rounded-xl p-4 text-sm font-medium"
                                                    value={disputeDetails}
                                                    onChange={(e) => setDisputeDetails(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                className="w-full h-12 rounded-xl font-black bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-200 active:scale-95 transition-all text-xs uppercase tracking-widest"
                                                onClick={() => raiseDisputeMutation.mutate()}
                                                disabled={raiseDisputeMutation.isPending || !disputeReason || !disputeDetails}
                                            >
                                                {raiseDisputeMutation.isPending ? "Executing Protocol..." : "Halt Settlement & File Dispute"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {order.status.toLowerCase() === "disputed" && (
                                <Badge className="rounded-full bg-red-50 text-red-600 border border-red-100 text-[8px] font-black uppercase tracking-widest px-3 py-1">
                                    Dispute Active • Settlement Paused
                                </Badge>
                            )}
                        </div>
                    </div>

                    <CollapsibleContent className="animate-in slide-in-from-top-4 duration-500">
                        <div className="px-4 md:px-5 pb-6 pt-4 space-y-6">
                            {isTrackingActive && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            Live Neural Tracking
                                        </h4>
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">
                                            Rider: {order.shipment.rider_latitude?.toFixed(4)}, {order.shipment.rider_longitude?.toFixed(4)}
                                        </span>
                                    </div>
                                    <LiveTrackingMap 
                                        riderCoords={order.shipment.rider_latitude ? { lat: order.shipment.rider_latitude, lng: order.shipment.rider_longitude } : null}
                                        buyerCoords={order.shipment.delivery_lat ? { lat: order.shipment.delivery_lat, lng: order.shipment.delivery_lng } : null}
                                    />
                                </div>
                            )}
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
