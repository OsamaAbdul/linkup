import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Truck, MapPin, Package, CheckCircle2, Navigation, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Logistics() {
    const { user, loading } = useAuth();
    const queryClient = useQueryClient();

    const { data: shipments = [], isLoading } = useQuery({
        queryKey: ["rider-shipments", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data } = await (supabase as any)
                .from("shipments")
                .select(`
                    *,
                    order:orders (
                        id,
                        status,
                        total,
                        shipping_address
                    )
                `)
                .eq("rider_id", user.id)
                .order("created_at", { ascending: false });
            return (data as any[]) ?? [];
        },
        enabled: !!user,
    });

    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const updateShipmentStatus = useMutation({
        mutationFn: async ({ id, status, orderId }: { id: string, status: any, orderId: string }) => {
            const { error: sError } = await (supabase as any).from("shipments").update({ status }).eq("id", id);
            if (sError) throw sError;

            // Sync with order status if relevant
            if (status === "delivered") {
                await supabase.from("orders").update({ status: "delivered" }).eq("id", orderId);
            } else if (status === "picked_up") {
                await supabase.from("orders").update({ status: "picked_up" }).eq("id", orderId);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rider-shipments"] });
            toast.success("Shipment protocol updated");
            setUpdatingId(null);
        },
        onError: (error: any) => {
            console.error("Logistic Error:", error);
            toast.error("Failed to update status: " + (error.message || "Unauthorized"));
            setUpdatingId(null);
        }
    });

    // Realtime for shipments
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('rider-shipments-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'shipments',
                    filter: `rider_id=eq.${user.id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["rider-shipments"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    if (loading) return null;
    if (!user) return <Navigate to="/auth" replace />;

    return (
        <AppLayout>
            <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 pb-32">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                            <Truck size={20} strokeWidth={3} />
                        </div>
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em]">Logistics Intelligence</p>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tight">Assigned Deliveries</h1>
                    <p className="text-muted-foreground font-medium mt-2">Manage your current mission queue and real-time transit protocols.</p>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-40 animate-pulse">
                        {[1, 2].map(i => <div key={i} className="h-64 bg-muted rounded-xl" />)}
                    </div>
                ) : shipments.length === 0 ? (
                    <Card className="rounded-xl border-dashed border-2 border-black/5 bg-white shadow-none p-12 text-center flex flex-col items-center justify-center space-y-4">
                        <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center text-muted-foreground/30">
                            <Package size={40} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Mission Queue Empty</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto mt-2 text-sm font-medium">You currently have no assigned shipments. Check back once a seller initiates transit.</p>
                        </div>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {shipments.map((s) => (
                            <Card key={s.id} className="rounded-xl border-black/[0.03] bg-white shadow-xl shadow-black/[0.01] overflow-hidden flex flex-col">
                                <CardHeader className="p-8 border-b border-black/[0.03] bg-muted/5 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white border border-black/5 flex items-center justify-center text-primary font-mono text-xs font-black">
                                            #{s.tracking_code?.slice(-4)}
                                        </div>
                                        <div>
                                            <Badge className={cn(
                                                "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none",
                                                s.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                                                    s.status === 'picked_up' ? 'bg-amber-100 text-amber-800' :
                                                        s.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
                                            )}>
                                                {s.status}
                                            </Badge>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">Initiated {new Date(s.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-foreground">‚¦{s.order?.total?.toLocaleString()}</p>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-8 space-y-6 flex-1">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 flex-shrink-0">
                                                <AlertCircle size={16} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Pickup Information</p>
                                                <p className="text-sm font-bold text-foreground leading-tight">{(s.pickup_address as any)?.address || "Contact Seller"}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 flex-shrink-0">
                                                <Navigation size={16} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Delivery Destination</p>
                                                <p className="text-sm font-bold text-foreground leading-tight">{(s.delivery_address as any)?.address || "Check Registry"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="p-8 pt-0 gap-3">
                                    {s.status === "assigned" && (
                                        <Button
                                            className="w-full rounded-xl h-14 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-transform"
                                            onClick={() => {
                                                const address = (s.delivery_address as any)?.address;
                                                const lat = (s.delivery_address as any)?.lat;
                                                const lng = (s.delivery_address as any)?.lng;

                                                let mapsUrl = "";
                                                if (lat && lng) {
                                                    mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                                } else if (address) {
                                                    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                                                }
                                                if (mapsUrl) window.open(mapsUrl, "_blank");

                                                setUpdatingId(s.id);
                                                updateShipmentStatus.mutate({ id: s.id, status: "picked_up", orderId: s.order_id });
                                            }}
                                            disabled={updateShipmentStatus.isPending}
                                        >
                                            {updateShipmentStatus.isPending && updatingId === s.id ? "Processing..." : "Confirm Pickup"}
                                        </Button>
                                    )}
                                    {s.status === "picked_up" && (
                                        <Button
                                            className="w-full rounded-xl h-14 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 bg-green-600 hover:bg-green-700 active:scale-95 transition-transform"
                                            onClick={() => {
                                                setUpdatingId(s.id);
                                                updateShipmentStatus.mutate({ id: s.id, status: "delivered", orderId: s.order_id });
                                            }}
                                            disabled={updateShipmentStatus.isPending}
                                        >
                                            {updateShipmentStatus.isPending && updatingId === s.id ? "Completing..." : "Confirm Delivered"}
                                        </Button>
                                    )}
                                    {s.status === "delivered" && (
                                        <div className="w-full flex items-center justify-center gap-2 py-4 text-green-600 font-black text-[10px] uppercase tracking-[0.2em] bg-green-500/5 rounded-xl">
                                            <CheckCircle2 size={16} />
                                            Mission Completed
                                        </div>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

