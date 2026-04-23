import { useAuth } from "@/features/auth/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "@/shared/hooks/use-toast";
import { OrdersHeader } from "@/features/marketplace/components/OrdersHeader";
import { OrdersTabs } from "@/features/marketplace/components/OrdersTabs";

export default function Orders() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "all";

    const setActiveTab = (tab: string) => {
        setSearchParams({ tab });
    };

    // Fetch orders (Orders-Centric Mapping)
    const { data: rawOrders = [], isLoading, refetch } = useQuery({
        queryKey: ["orders", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("orders")
                .select(`
                    *,
                    shipments:shipments!shipments_order_id_fkey ( * ),
                    order_recipient (
                        full_name,
                        phone,
                        address_line
                    ),
                    order_items (
                        product_id,
                        size,
                        products (
                            title,
                            images,
                            price
                        )
                    )
                `)
                .eq("buyer_id", user.id)
                .order("created_at", { ascending: false });


            console.log("this is the orders data", data);

            if (error) {
                console.error("Query Error:", error);
                throw error;
            }
            console.log("this is the orders data", data);
            return data;
        },
        enabled: !!user,
    });

    // Fetch user's submitted issues/disputes
    const { data: userIssues = [], isLoading: issuesLoading } = useQuery({
        queryKey: ["user-issues", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from("issues" as any)
                .select(`
                    *,
                    seller:profiles!seller_id(display_name),
                    product:products(title, images)
                `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const formatStatus = (status: string) => {
        const map: Record<string, string> = {
            confirmed: "Order Confirmed",
            awaiting_agent: "Finding Courier...",
            broadcast: "Finding Courier...",
            accepted: "Courier Assigned",
            assigned: "Courier Assigned",
            out_for_pickup: "Heading to Seller",
            arrived_at_seller: "Arrived at Pickup",
            picked_up: "Picked Up & In Transit",
            started: "Picked Up & In Transit",
            out_for_delivery: "Heading to You",
            arrived_at_destination: "Arrived at New Hub",
            arrived: "Arrived",
            shipped: "Shipped",
            delivered: "Delivered 🎉",
            completed: "Completed ✅",
            cancelled: "Cancelled",
            disputed: "Under Dispute ⚖️",
        };
        return map[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
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

    const orderIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        orderIdsRef.current = new Set(rawOrders.map((o: any) => o.id));
    }, [rawOrders]);

    // Realtime setup
    useEffect(() => {
        if (!user) return;

        const orderChannel = supabase
            .channel(`buyer-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
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
                    const shipmentOrderId = (payload.new as any).order_id;
                    const newStatus = (payload.new as any).status;

                    if (orderIdsRef.current.has(shipmentOrderId)) {
                        playNotificationSound();
                        toast({
                            title: "Shipment Update",
                            description: `Delivery status: ${formatStatus(newStatus)}`,
                        });
                        refetch();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(orderChannel);
            supabase.removeChannel(shipmentChannel);
        };
    }, [user, refetch]);

    const orders = rawOrders.map((order: any) => {
        // Handle both array and single-object response for shipments join
        const shipmentData = order.shipments;
        const shipment = Array.isArray(shipmentData) ? shipmentData[0] : shipmentData;
        
        const orderItems = order.order_items || [];
        const normalizedItem = orderItems[0] || null;
        const productData = normalizedItem?.products || null;

        const title = productData?.title || `Order #${order.id.slice(0, 8)}`;
        const image = productData?.images?.[0] || "";
        const price = order.total_amount || 0;
        const store = "Linkup Partner";

        // Logic priority: Terminal order statuses take precedence
        // Otherwise, shipment status takes precedence once it moves past 'pending'
        const activeStatus = (["completed", "disputed", "cancelled", "refunded"].includes(order.status.toLowerCase()))
            ? order.status
            : (shipment && shipment.status && shipment.status !== 'pending')
                ? shipment.status
                : order.status;

        return {
            id: order.id,
            title,
            price,
            image,
            store,
            status: activeStatus,
            displayStatus: formatStatus(activeStatus),
            itemsCount: orderItems.length,
            deliveredBy: activeStatus === 'delivered' ? 'Linkup Logistics' : null,
            shipment,
            sellerId: order.seller_id,
            productId: normalizedItem?.product_id,
            size: normalizedItem?.size
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
        reports: userIssues.length,
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

    const isLoadingAll = isLoading || issuesLoading;

    if (isLoading) return <AppLayout><div className="flex items-center justify-center min-h-[60vh] text-primary animate-pulse font-bold tracking-widest uppercase text-xs">Loading all orders...</div></AppLayout>;

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
                    userIssues={userIssues}
                />
            </div>
        </AppLayout>
    );
}
