import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { 
    AlertCircle, CheckCircle2, XCircle, ShoppingBag, 
    User, Clock, ShieldAlert, Scale, RefreshCcw, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";
import { Textarea } from "@/shared/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";

export default function AdminDisputeManager() {
    const queryClient = useQueryClient();
    const [selectedDispute, setSelectedDispute] = useState<any>(null);
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [resolutionType, setResolutionType] = useState<"refund" | "release">("release");

    const { data: disputes, isLoading } = useQuery({
        queryKey: ["admin-disputes-list"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("issues")
                .select(`
                    *,
                    reporter: profiles!issues_reporter_profile_fkey(display_name, avatar_url),
                    order: orders(
                        id, 
                        total_amount, 
                        status, 
                        created_at,
                        seller: profiles!seller_id(display_name)
                    )
                `)
                .eq("category", "financial_dispute")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 2,
    });

    const resolveMutation = useMutation({
        mutationFn: async ({ id, resolution, notes }: { id: string, resolution: string, notes: string }) => {
            const { data, error } = await (supabase as any).rpc("resolve_dispute", {
                p_issue_id: id,
                p_resolution_type: resolution,
                p_admin_notes: notes
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Could not complete the refund/release.");
            return data;
        },
        onSuccess: () => {
            toast.success("Conflict resolved successfully", {
                description: "Payments have been updated and money has been moved.",
            });
            setIsResolveModalOpen(false);
            setSelectedDispute(null);
            setResolutionNotes("");
            queryClient.invalidateQueries({ queryKey: ["admin-disputes-list"] });
            queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });
        },
        onError: (err: any) => {
            toast.error("Resolution failed: " + err.message);
        }
    });

    const handleResolveClick = (dispute: any, type: "refund" | "release") => {
        setSelectedDispute(dispute);
        setResolutionType(type);
        setIsResolveModalOpen(true);
    };

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px] animate-pulse">
            <div className="flex flex-col items-center gap-4 text-primary/40 text-xs font-black uppercase tracking-widest">
                <Scale size={48} className="animate-bounce" />
                Checking problem reports...
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-200">
                        <Scale size={20} />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight">Order Conflicts</h2>
                </div>
                <p className="text-muted-foreground font-medium max-w-2xl">
                    Resolve money problems between buyers and sellers. Solving a conflict will automatically return money to the buyer or release it to the seller.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {disputes?.length === 0 ? (
                    <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-20 flex flex-col items-center justify-center text-center">
                        <CheckCircle2 size={64} className="text-emerald-400 opacity-20 mb-6" />
                        <h3 className="text-2xl font-black mb-2 tracking-tight">No Conflicts</h3>
                        <p className="text-muted-foreground font-medium">All orders are currently running smoothly without any problems.</p>
                    </Card>
                ) : (
                    disputes?.map((dispute: any) => (
                        <Card key={dispute.id} className={cn(
                            "border-none shadow-sm rounded-2xl bg-white overflow-hidden group transition-all duration-500",
                            dispute.status === 'open' ? "hover:shadow-2xl hover:shadow-red-500/5 ring-1 ring-black/[0.03]" : "opacity-70"
                        )}>
                            <div className="p-1 flex flex-col md:flex-row">
                                {/* Side Status Bar */}
                                <div className={cn(
                                    "w-full md:w-2 flex-shrink-0 transition-colors",
                                    dispute.status === 'open' ? "bg-red-500" : 
                                    dispute.status === 'resolved' ? "bg-emerald-500" : "bg-gray-300"
                                )} />

                                <div className="flex-1 p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    {/* Subject & Order Info */}
                                    <div className="lg:col-span-4 space-y-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                                                    dispute.status === 'open' ? "bg-red-50 text-red-600 border border-red-100" : "bg-gray-100 text-gray-500"
                                                )}>
                                                    {dispute.status}
                                                </Badge>
                                                <span className="text-[10px] font-mono font-bold text-muted-foreground">#{dispute.id.slice(0, 8).toUpperCase()}</span>
                                            </div>
                                            <h3 className="text-xl font-black tracking-tight mb-2 group-hover:text-red-600 transition-colors">{dispute.title}</h3>
                                            <p className="text-sm font-medium text-muted-foreground leading-relaxed italic border-l-2 border-red-100 pl-4">
                                                "{dispute.description || "No details provided by the customer."}"
                                            </p>
                                        </div>

                                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Order Amount</span>
                                                <span className="text-lg font-black text-foreground">₦{dispute.order?.total_amount?.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Order Status</span>
                                                <Badge variant="outline" className="text-[9px] font-bold border-black/5 bg-white">{dispute.order?.status}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Involved Parties */}
                                    <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-6 pb-4 lg:pb-0 lg:border-r border-black/[0.03]">
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                                <ShieldAlert size={14} /> Reported by (Buyer)
                                            </p>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Customer who complained</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-gray-200 overflow-hidden">
                                                        {dispute.reporter?.avatar_url && <img src={dispute.reporter.avatar_url} alt="" className="w-full h-full object-cover" />}
                                                    </div>
                                                    <p className="text-xs font-black">{dispute.reporter?.display_name || "Unknown Identity"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                <ShoppingBag size={14} /> Seller Involved
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-xl bg-gray-50 border-2 border-white shadow-sm flex items-center justify-center text-muted-foreground font-black uppercase">
                                                     {dispute.order?.seller?.display_name?.charAt(0) || "S"}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black">{dispute.order?.seller?.display_name || "Merchant Node"}</p>
                                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Money Held</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="sm:col-span-2 pt-4 flex items-center gap-6 border-t border-black/[0.02]">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Created At</span>
                                                <div className="flex items-center gap-1.5 text-xs font-bold">
                                                    <Clock size={12} className="text-primary" />
                                                    {format(new Date(dispute.created_at), "MMM d, HH:mm")}
                                                </div>
                                            </div>
                                            <div className="h-8 w-px bg-black/[0.05]" />
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Uploaded Proof</span>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                                                    <AlertCircle size={12} />
                                                    {dispute.evidence_url ? "Proof uploaded" : "Waiting for proof"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resolution Actions */}
                                    <div className="lg:col-span-3 flex flex-col justify-center gap-4">
                                        {dispute.status === 'open' ? (
                                            <>
                                                <Button 
                                                    className="w-full h-12 rounded-xl bg-black text-white hover:bg-primary transition-all font-black text-[11px] uppercase tracking-widest shadow-xl shadow-black/10 group/btn"
                                                    onClick={() => handleResolveClick(dispute, "release")}
                                                >
                                                    Pay the Seller <ArrowRight size={14} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="w-full h-12 rounded-xl border-2 border-red-100 text-red-600 hover:bg-red-50 font-black text-[11px] uppercase tracking-widest"
                                                    onClick={() => handleResolveClick(dispute, "refund")}
                                                >
                                                    Refund the Buyer <RefreshCcw size={14} className="ml-2" />
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-1">
                                                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 italic">Problem Solved</p>
                                                <p className="text-xs font-bold">{dispute.resolution_meta?.resolution === 'refund' ? "Buyer was refunded" : "Money was released"}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Resolution Modal */}
            <Dialog open={isResolveModalOpen} onOpenChange={setIsResolveModalOpen}>
                <DialogContent className="rounded-3xl border-none shadow-2xl p-8 max-w-lg">
                    <DialogHeader className="mb-6">
                        <DialogTitle className={cn(
                            "text-2xl font-black",
                            resolutionType === 'refund' ? "text-red-600" : "text-emerald-600"
                        )}>
                            {resolutionType === 'refund' ? "Confirm Refund" : "Release the Money"}
                        </DialogTitle>
                        <DialogDescription className="font-medium">
                            {resolutionType === 'refund' 
                                ? "This will return the money to the buyer and cancel the seller's payment." 
                                : "This will confirm the sale was okay and pay the seller immediately."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-muted p-4 rounded-2xl space-y-2">
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                                <span>Problem Order</span>
                                <span>Order Amount</span>
                             </div>
                             <div className="flex justify-between items-baseline">
                                <span className="font-mono text-xs font-bold">#{selectedDispute?.order?.id.slice(0, 12).toUpperCase()}</span>
                                <span className="text-lg font-black">₦{selectedDispute?.order?.total_amount?.toLocaleString()}</span>
                             </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Manager Notes</label>
                            <Textarea 
                                placeholder="Explain why you are taking this action..."
                                className="min-h-[120px] bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20"
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-8 gap-3 sm:flex-row flex-col">
                        <Button 
                            variant="ghost" 
                            className="rounded-xl h-12 font-black uppercase tracking-widest text-[11px]" 
                            onClick={() => setIsResolveModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className={cn(
                                "flex-1 rounded-xl h-12 font-black uppercase tracking-widest text-[11px] shadow-xl transition-all active:scale-95",
                                resolutionType === 'refund' ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                            )}
                            disabled={!resolutionNotes || resolveMutation.isPending}
                            onClick={() => resolveMutation.mutate({
                                id: selectedDispute.id,
                                resolution: resolutionType,
                                notes: resolutionNotes
                            })}
                        >
                            {resolveMutation.isPending ? "Processing..." : "Finish Problem"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
