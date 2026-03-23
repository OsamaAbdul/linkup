import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import { Store, Smartphone, Activity, ChevronUp, ChevronDown, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderTimeline } from "./OrderTimeline";
import { OrderShipmentIntel } from "./OrderShipmentIntel";
import { ShipmentStatusHistory } from "./ShipmentStatusHistory";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
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
            if (!data?.success) throw new Error(data?.error || "Settlement failed €” no earnings credited");

            return data;
        },
        onSuccess: (data) => {
            const earned = data.seller_credited ? `‚¦${Number(data.seller_credited).toLocaleString()} released to seller.` : "";
            toast.success(`Order finalized! ${earned}`, { duration: 5000 });
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        },
        onError: (err: any) => {
            toast.error("Finalization failed: " + err.message);
        }
    });

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
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-primary/60 uppercase tracking-widest">
                                    <Store size={10} />
                                    {order.store}
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
                            <p className="text-xl sm:text-2xl font-black text-primary tracking-tighter">
                                <span className="text-xs sm:text-sm opacity-60 mr-0.5">‚¦</span>
                                {order.price.toLocaleString()}
                            </p>

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
                                        <Activity size={12} strokeWidth={3} />
                                        Track this order..
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
                                    Order Finalized œ“
                                </Button>
                            )}
                            {!["delivered", "completed"].includes(order.status.toLowerCase()) && (
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
                                                <Label htmlFor="priority" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Priority Level</Label>
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
                        </div>
                    </div>

                    <CollapsibleContent className="animate-in slide-in-from-top-4 duration-500">
                        <div className="px-4 md:px-5 pb-6 pt-4">
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

