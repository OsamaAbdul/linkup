import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Check, ShoppingBag, User, Store, AlertCircle, Clock, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { format } from "date-fns";

export default function AdminIssueManager() {
    const queryClient = useQueryClient();
    const { data: issues, isLoading: issuesLoading } = useQuery({
        queryKey: ["admin-issues-list"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("issues")
                .select(`
                    *,
                    reporter:profiles!issues_user_id_fkey(id, display_name),
                    seller:profiles!issues_seller_id_fkey(id, display_name),
                    products(title, images),
                    orders(shipping_address),
                    seller_info:seller_verifications!issues_seller_id_fkey(phone_number),
                    logistics_info:logistics_verifications!issues_user_id_fkey(phone_number)
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
            toast.success("Security ticket updated successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-issues-list"] });
        }
    });

    if (issuesLoading) return (
        <div className="p-20 text-center bg-white rounded-[3rem] shadow-sm animate-pulse">
            <AlertCircle className="mx-auto h-12 w-12 text-primary opacity-20 mb-4" />
            <p className="font-black text-xl uppercase tracking-widest text-primary/40">Wait, loading all issues and fixes...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tight">Manage Disputes and Settlements</h2>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {issues?.length === 0 ? (
                    <div className="col-span-full p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm">
                        <Check className="mx-auto h-16 w-16 text-emerald-500 opacity-20 mb-4" />
                        <h3 className="font-black text-2xl mb-2">Security Zone</h3>
                        <p className="text-muted-foreground font-medium text-lg">Platform 100% secured. No active threats reported.</p>
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
                                        <Store className="w-4 h-4" />
                                        Linked Asset: <span className="font-black underline decoration-2 underline-offset-4">{issue.products?.title || "Unknown Product"}</span>
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 pt-4">
                            <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-black/[0.03]">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><User size={10} /> Reported By</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-foreground">{issue.reporter?.display_name || "Nexus Client"}</p>
                                        <div className="flex gap-2">
                                            {(issue.orders?.shipping_address as any)?.phone || issue.logistics_info?.phone_number ? (
                                                <a
                                                    href={`tel:${(issue.orders?.shipping_address as any)?.phone || issue.logistics_info?.phone_number}`}
                                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                                    title="Call Reporter"
                                                >
                                                    <Smartphone size={10} strokeWidth={3} />
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Store size={10} /> Against Seller</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-foreground">{issue.seller?.display_name || "Merchant Node"}</p>
                                        <div className="flex gap-2">
                                            {issue.seller_info?.phone_number && (
                                                <a href={`tel:${issue.seller_info.phone_number}`} className="p-1.5 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
                                                    <Smartphone size={10} strokeWidth={3} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Clock size={10} /> Transmission Date</p>
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
                                        <Check size={16} className="mr-2 stroke-[3px]" /> Resolve Ticket
                                    </Button>
                                ) : (
                                    <Badge className="flex-1 justify-center rounded-xl h-12 bg-emerald-50 text-emerald-700 font-black uppercase text-[11px] tracking-widest border-2 border-emerald-100">Operation Restored</Badge>
                                )}
                                <Button
                                    variant="outline"
                                    className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest border-2 hover:bg-black hover:text-white transition-colors"
                                    onClick={() => {
                                        const contact = issue.seller_info?.phone_number || issue.logistics_info?.phone_number || "No contact info";
                                        toast.info(`Rapid Intel: Contact [ ${contact} ]`);
                                    }}
                                >
                                    Intel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

