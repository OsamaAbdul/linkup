import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Check, ShoppingBag, User, Store, AlertCircle, Clock, Smartphone, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";

export default function AdminIssueManager() {
    const queryClient = useQueryClient();
    const { data: issues, isLoading: issuesLoading } = useQuery({
        queryKey: ["admin-issues-list"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("issues")
                .select(`
                    *,
                    reporter:profiles!issues_reporter_profile_fkey(id, display_name, phone),
                    seller:profiles!issues_seller_id_fkey(id, display_name, phone),
                    products(title, images)
                `)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 1, // 1 minute
    });

    const { data: allOrders } = useQuery({
        queryKey: ["admin-all-orders"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("orders")
                .select("*");
            if (error) throw error;
            return data;
        },
        staleTime: 1000 * 60 * 2,
    });

    // Real-time setup
    useEffect(() => {
        const channel = supabase
            .channel('admin-issues-feed')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'issues' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["admin-issues-list"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const getLinkedOrder = (orderId: string) => {
        return allOrders?.find(o => o.id === orderId);
    };

    const resolveIssueMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await (supabase as any)
                .from("issues")
                .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Complaint status updated successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-issues-list"] });
        }
    });

    if (issuesLoading) return (
        <div className="p-20 text-center bg-white rounded-[3rem] shadow-sm animate-pulse">
            <AlertCircle className="mx-auto h-12 w-12 text-primary opacity-20 mb-4" />
            <p className="font-black text-xl uppercase tracking-widest text-primary/40">Checking all reports and problems...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight">Manage Problems & Payouts</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {issues?.length === 0 ? (
                    <div className="col-span-full p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm">
                        <Check className="mx-auto h-16 w-16 text-emerald-500 opacity-20 mb-4" />
                        <h3 className="font-black text-2xl mb-2">Zero issues submitted</h3>
                        <p className="text-muted-foreground font-medium text-lg">All orders are completed and successful</p>
                    </div>
                ) : issues?.map((issue: any) => (
                    <Card key={issue.id} className="border-none shadow-sm rounded-xl bg-white hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                        <CardHeader className="p-8 pb-4">
                            <div className="flex items-center justify-between mb-4">
                                <Badge className={cn(
                                    "rounded-full text-[9px] font-black uppercase tracking-widest py-1 px-3",
                                    issue.priority === 'critical' ? 'bg-red-500 text-white shadow-lg shadow-red-200' :
                                        issue.priority === 'high' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' :
                                            'bg-blue-500 text-white shadow-lg shadow-blue-200'
                                )}>
                                    {issue.priority} priority
                                </Badge>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] bg-muted/50 px-2 py-1 rounded-lg">#{issue.id.slice(0, 8)}</span>
                            </div>
                            <CardTitle className="text-xl font-black tracking-tight mb-2 group-hover:text-primary transition-colors">{issue.title}</CardTitle>
                            <CardDescription className="line-clamp-3 font-medium text-sm leading-relaxed">{issue.description}</CardDescription>

                            <div className="flex flex-col gap-3 mt-6">
                                {issue.order_id && (
                                    <Badge variant="outline" className="rounded-xl bg-gray-50 border-gray-200 text-[10px] font-bold text-muted-foreground flex items-center w-full justify-between py-2 px-4 group/badge">
                                        <span className="flex items-center gap-2">
                                            <ShoppingBag className="w-4 h-4 text-primary" />
                                            Order ID: <span className="font-mono text-foreground">{issue.order_id.slice(0, 12).toUpperCase()}</span>
                                        </span>
                                        <span className="uppercase text-[9px] font-black text-primary opacity-0 group-hover/badge:opacity-100 transition-opacity">View Order</span>
                                    </Badge>
                                )}
                                {issue.product_id && (
                                    <Badge variant="outline" className="rounded-xl bg-primary/5 border-primary/10 text-[10px] font-bold text-primary flex items-center w-full gap-2 py-2 px-4">
                                        <AlertCircle className="w-4 h-4" />
                                        Linked Product: <span className="font-black underline decoration-2 underline-offset-4">{issue.products?.title || "Unknown Product"}</span>
                                    </Badge>
                                )}

                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                                    <Badge className={cn(
                                        "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                        issue.category === 'financial_dispute' ? "bg-red-50 text-red-600" : 
                                        issue.category === 'security' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                    )}>
                                        {issue.category?.replace('_', ' ')}
                                    </Badge>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                                        Priority: {issue.priority}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-black/[0.03]">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><User size={10} /> Reported By</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-foreground">{issue.reporter?.display_name || "Customer Name"}</p>
                                        <div className="flex gap-2">
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Store size={10} /> Against Seller</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-foreground">{issue.seller?.display_name || "Seller Name"}</p>
                                        <div className="flex gap-2">
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Clock size={10} /> Report Date</p>
                                    <p className="text-xs font-bold text-foreground">{format(new Date(issue.created_at), "MMMM d, yyyy HH:mm")}</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {issue.status !== 'resolved' ? (
                                    <Button
                                        className="flex-1 rounded-xl h-12 font-black text-[11px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 active:scale-95 transition-all"
                                        onClick={() => resolveIssueMutation.mutate({ id: issue.id, status: 'resolved' })}
                                        disabled={resolveIssueMutation.isPending}
                                    >
                                        <Check size={16} className="mr-2 stroke-[3px]" /> Fixed it
                                    </Button>
                                ) : (
                                    <Badge className="flex-1 justify-center rounded-xl h-12 bg-emerald-50 text-emerald-700 font-black uppercase text-[11px] tracking-widest border-2 border-emerald-100">Problem Solved</Badge>
                                )}
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest border-2 hover:bg-black hover:text-white transition-colors"
                                        >
                                            View Details
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl border-none p-0 bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
                                        <div className="bg-primary p-8 text-white">
                                            <div className="flex items-center justify-between mb-4">
                                                <Badge className="bg-white/20 text-white border-none uppercase text-[10px] font-black">{issue.category}</Badge>
                                                <span className="text-white/60 font-mono text-xs">#{issue.id}</span>
                                            </div>
                                            <h2 className="text-3xl font-black tracking-tight">{issue.title}</h2>
                                        </div>
                                        <div className="p-8 space-y-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description & Context</h4>
                                                    <div className="bg-gray-50 p-6 rounded-2xl border border-black/[0.03]">
                                                        <p className="text-sm font-medium leading-relaxed italic">"{issue.description}"</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Product Involved</h4>
                                                    <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl">
                                                        {issue.products?.images?.[0] && (
                                                            <img src={issue.products.images[0]} alt="" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-black">{issue.products?.title || "Unknown Item"}</p>
                                                            <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">Audit Required</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-8 border-t border-black/[0.05] grid grid-cols-2 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Customer</p>
                                                    <p className="text-sm font-bold">{issue.reporter?.display_name}</p>
                                                    {issue.reporter?.phone && (
                                                        <div className="flex flex-col gap-2">
                                                            <a href={`tel:${issue.reporter.phone}`} className="flex items-center gap-2 text-primary hover:underline text-xs font-bold">
                                                                <Smartphone size={12} /> {issue.reporter.phone}
                                                            </a>
                                                            <a 
                                                                href={`https://wa.me/${issue.reporter.phone.replace(/[^0-9]/g, '')}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 text-[#128C7E] hover:underline text-[10px] font-black uppercase"
                                                            >
                                                                <MessageSquare size={12} /> WhatsApp Customer
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Merchant</p>
                                                    <p className="text-sm font-bold">{issue.seller?.display_name}</p>
                                                    {issue.seller?.phone && (
                                                        <div className="flex flex-col gap-2">
                                                            <a href={`tel:${issue.seller.phone}`} className="flex items-center gap-2 text-primary hover:underline text-xs font-bold">
                                                                <Smartphone size={12} /> {issue.seller.phone}
                                                            </a>
                                                            <a 
                                                                href={`https://wa.me/${issue.seller.phone.replace(/[^0-9]/g, '')}`} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 text-[#128C7E] hover:underline text-[10px] font-black uppercase"
                                                            >
                                                                <MessageSquare size={12} /> WhatsApp Merchant
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Report Date</p>
                                                    <p className="text-sm font-bold">{format(new Date(issue.created_at), "MMM d, HH:mm")}</p>
                                                </div>
                                            </div>

                                            {issue.evidence_url && (
                                                <div className="space-y-4 pt-4">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">Visual Evidence (Uploaded by Buyer)</h4>
                                                    <img src={issue.evidence_url} alt="Evidence" className="w-full h-64 object-cover rounded-2xl shadow-xl border-4 border-white" />
                                                </div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

