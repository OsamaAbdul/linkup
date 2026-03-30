import { useAuth } from "@/features/auth/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "@/shared/hooks/use-toast";
import { OrdersHeader } from "@/features/commerce/components/OrdersHeader";
import { OrdersTabs } from "@/features/commerce/components/OrdersTabs";

export default function Orders() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "all";

    const setActiveTab = (tab: string) => {
        setSearchParams({ tab });
    };

    // Fetch orders
    const { data: rawOrders = [], isLoading, refetch } = useQuery({
        queryKey: ["orders", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    shipments (
                        id,
                        status,
                        tracking_code,
                        rider_id,
                        rider_latitude,
                        rider_longitude,
                        buyer_latitude,
                        buyer_longitude,
                        pickup_address,
                        delivery_address,
                        delivery_fee
                    )
                `)
                .eq("buyer_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            console.log("these are your orders", data)
            return data;
        },
        enabled: !!user,
    });

    const formatStatus = (status: string) => {
        const map: Record<string, string> = {
            confirmed: "Order Confirmed",
            awaiting_agent: "Finding Courier...",
            accepted: "Courier Assigned",
            picked_up: "Picked Up & In Transit",
            out_for_delivery: "Out for Delivery",
            delivered: "Delivered 🎉",
            completed: "Completed ✅",
            cancelled: "Cancelled",
        };
        return map[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
    };

    const prevOrderStatuses = useRef<Record<string, string>>({});

    // Seed initial statuses to avoid toasts on first load
    useEffect(() => {
        if (rawOrders.length > 0 && Object.keys(prevOrderStatuses.current).length === 0) {
            rawOrders.forEach((o: any) => {
                prevOrderStatuses.current[o.id] = o.status;
            });
        }
    }, [rawOrders]);

    const playNotificationSound = () => {
        try {
            const audio = new Audio("/sounds/notification.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch { }
    };

    // Realtime setup
    useEffect(() => {
        if (!user) return;

        const orderChannel = supabase
            .channel(`buyer-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE)
                    schema: 'public',
                    table: 'orders',
                    filter: `buyer_id=eq.${user.id}`
                },
                (payload) => {
                    const newStatus = (payload.new as any).status;
                    const orderId = (payload.new as any).id;
                    const prev = prevOrderStatuses.current[orderId];

                    if (prev && prev !== newStatus) {
                        playNotificationSound();
                        toast({
                            title: "Order Updated",
                            description: `Order #${orderId.slice(0, 8)} → ${formatStatus(newStatus)}`,
                        });
                    }
                    prevOrderStatuses.current[orderId] = newStatus;
                    refetch();
                }
            )
            .subscribe();

        const shipmentChannel = supabase
            .channel(`buyer-shipments-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'shipments',
                },
                (payload) => {
                    const newStatus = (payload.new as any).status;
                    playNotificationSound();
                    toast({
                        title: "Shipment Update",
                        description: `Delivery status: ${formatStatus(newStatus)}`,
                    });
                    refetch();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(orderChannel);
            supabase.removeChannel(shipmentChannel);
        };
    }, [user, refetch]);

    const orders = rawOrders.map((order: any) => {
        const shipment = order.shipments?.[0];
        const items = Array.isArray(order.items) ? order.items : [];
        const jsonItem = items[0] || null;

        const title = jsonItem?.title || `Order #${order.id.slice(0, 8)}`;
        const image = jsonItem?.image || jsonItem?.images?.[0] || "";
        const price = order.total || 0;
        const store = "Linkup Partner";

        return {
            id: order.id,
            title,
            price,
            image,
            store,
            status: order.status,
            displayStatus: formatStatus(order.status),
            itemsCount: items.length,
            deliveredBy: order.status === 'delivered' ? 'Linkup Logistics' : null,
            shipment,
            sellerId: order.seller_id,
            size: jsonItem?.size // Map first item's size
        };
    });

    const isToShip = (s: string) => ["pending", "confirmed", "processing", "awaiting_agent"].includes(s.toLowerCase());
    const isToReceive = (s: string) => ["accepted", "out_for_pickup", "arrived_at_seller", "picked_up", "out_for_delivery", "arrived_at_destination", "shipped", "delivered"].includes(s.toLowerCase());
    const isCompleted = (s: string) => ["completed"].includes(s.toLowerCase());

    const counts = {
        toShip: orders.filter(o => isToShip(o.status)).length,
        toReceive: orders.filter(o => isToReceive(o.status)).length,
        completed: orders.filter(o => isCompleted(o.status)).length,
        cancelled: orders.filter(o => o.status.toLowerCase() === "cancelled").length,
    };

    const filteredOrders = activeTab === "all"
        ? orders
        : orders.filter(o => {
            const s = o.status.toLowerCase();
            if (activeTab === "to-ship") return isToShip(s);
            if (activeTab === "to-receive") return isToReceive(s);
            if (activeTab === "completed") return isCompleted(s);
            if (activeTab === "cancelled") return s === "cancelled";
            return true;
        });

    if (isLoading) return <AppLayout><div className="flex items-center justify-center min-h-[60vh] text-primary animate-pulse font-bold tracking-widest uppercase text-xs">Loading Secure Registry...</div></AppLayout>;

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-4 sm:space-y-8 pb-24">
                <OrdersHeader />
                <OrdersTabs
                    orders={orders}
                    filteredOrders={filteredOrders}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    counts={counts}
                />
            </div>
        </AppLayout>
    );
}
