import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

// Modular Components
import { DashboardSidebar, Tab } from "@/features/dashboard/components/DashboardSidebar";
import { InventoryTab } from "@/features/dashboard/components/InventoryTab";
import { ListProductTab } from "@/features/dashboard/components/ListProductTab";
import { OrdersTab } from "@/features/dashboard/components/OrdersTab";
import { WalletTab } from "@/features/dashboard/components/WalletTab";
import { AnalyticsTab } from "@/features/dashboard/components/AnalyticsTab";
import { CategoryTab } from "@/features/dashboard/components/CategoryTab";
import { IssuesTab } from "@/features/dashboard/components/IssuesTab";
import { EditProductModal } from "@/features/dashboard/components/EditProductModal";
import { PaymentReconciliationTab } from "@/features/dashboard/components/PaymentReconciliationTab";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("products");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productsPage, setProductsPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const PAGE_SIZE = 10;

  const { data: productsData } = useQuery({
    queryKey: ["seller-products", user?.id, productsPage],
    queryFn: async () => {
      if (!user) return { data: [], count: 0 };
      const { data, count } = await supabase
        .from("products")
        .select("id, title, price, inventory, images, description", { count: "exact" })
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .range(productsPage * PAGE_SIZE, (productsPage + 1) * PAGE_SIZE - 1);
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!user,
  });

  const products = productsData?.data || [];
  const totalProducts = productsData?.count || 0;

  const { data: ordersData } = useQuery({
    queryKey: ["seller-orders", user?.id, ordersPage],
    queryFn: async () => {
      if (!user) return { data: [], count: 0 };
      const { data, count } = await (supabase as any)
        .from("orders")
        .select(`
          id, status, created_at, total, shipping_address, items, city_id, zone_id,
          cities:city_id(name),
          delivery_zones:zone_id(name),
          shipments (
            id, status, tracking_code, zone, zone_id,
            profiles:rider_id (
              display_name, avatar_url
            )
          )
        `, { count: "exact" })
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .range(ordersPage * PAGE_SIZE, (ordersPage + 1) * PAGE_SIZE - 1);
      return { data: (data as any[]) ?? [], count: count ?? 0 };
    },
    enabled: !!user,
  });

  const orders = ordersData?.data || [];

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("zone, city_id, zone_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: verification } = await (supabase as any)
        .from("seller_verifications")
        .select("business_address")
        .eq("user_id", user.id)
        .maybeSingle();

      return {
        ...(profile as any),
        business_address: verification?.business_address
      };
    },
    enabled: !!user,
  });

  const { data: pendingOrdersCount = 0 } = useQuery({
    queryKey: ["pending-orders-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "pending");
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: openIssuesCount = 0 } = useQuery({
    queryKey: ["open-issues-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("issues" as any)
        .select("*", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "open");
      return count ?? 0;
    },
    enabled: !!user,
  });


  const { data: analytics } = useQuery({
    queryKey: ["seller-analytics", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any).rpc("get_seller_analytics", { seller_uuid: user.id });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("wallets").select("id, balance").eq("seller_id", user.id).maybeSingle();
      if (!data) {
        const { data: newWallet } = await supabase.from("wallets").insert({ seller_id: user.id }).select().single();
        return newWallet;
      }
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["wallet-transactions", wallet?.id],
    queryFn: async () => {
      if (!wallet) return [];
      const { data } = await supabase.from("wallet_transactions").select("id, amount, type, created_at").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
    enabled: !!wallet,
  });

  const { data: dbCategories = [] } = useQuery({
    queryKey: ["product-categories", "full"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("categories").select("*").order("name");
      return (data as any[]) ?? [];
    },
  });

  const updateProduct = useMutation({
    mutationFn: async (product: any) => {
      const { error } = await supabase.from("products").update({
        title: product.title,
        price: product.price,
        inventory: product.inventory,
        description: product.description
      }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      toast.success("Product updated successfully");
      setEditingProduct(null);
    },
    onError: (err: any) => toast.error("Failed to update: " + err.message)
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error: orderError } = await supabase.from("orders").update({ status }).eq("id", id);
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      queryClient.invalidateQueries({ queryKey: ["seller-analytics"] });
      toast.success("Order status updated");
    },
    onError: (error: any) => {
      console.error("Mutation Error:", error);
      toast.error("Failed to update status: " + (error.message || "Unknown error"));
    }
  });

  // Zone-based broadcast: update order and let trigger handle shipment basic creation/sync
  const broadcastOrderMutation = useMutation({
    mutationFn: async ({ id, zone, zoneId, cityId, pickupAddress, pickupTime }: { id: string; zone: string; zoneId?: string; cityId?: string; pickupAddress: string; pickupTime: string }) => {
      // 1. Update order status to awaiting_agent + store zone info
      // This fires the database trigger tr_sync_order_to_shipment
      const { error: orderError } = await (supabase as any)
        .from("orders")
        .update({
          status: "awaiting_agent",
          broadcast_zone: zone,
          zone_id: zoneId,
          city_id: cityId
        })
        .eq("id", id);
      if (orderError) throw orderError;

      // 2. Update the shipment with the specific pickup details provided by the seller
      // The trigger has already ensured a shipment exists and is linked.
      const { error: shipmentError } = await (supabase as any)
        .from("shipments")
        .update({
          zone: zone,
          zone_id: zoneId,
          city_id: cityId,
          status: "broadcast",
          pickup_address: pickupAddress,
          pickup_time: pickupTime ? new Date(pickupTime).toISOString() : null,
        })
        .eq("order_id", id);

      if (shipmentError) {
        console.error("Secondary Shipment Update Error (Non-Critical):", shipmentError);
      }

      console.log(`Broadcasted order ${id} to zone: ${zone}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      toast.success("Order broadcasted! Waiting for an agent to claim.");
    },
    onError: (error: any) => {
      toast.error("Failed to broadcast: " + (error.message || "Unknown error"));
    }
  });

  // Realtime subscription for orders, issues, and wallet
  useEffect(() => {
    if (!user) return;

    const ordersChannel = supabase
      .channel('seller-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
          queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
          queryClient.invalidateQueries({ queryKey: ["seller-analytics"] });
        })
      .subscribe();

    const issuesChannel = supabase
      .channel('seller-issues-badge-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `seller_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ["open-issues-count"] }); })
      .subscribe();

    // Real-time wallet + earnings updates — fires when settlement trigger inserts a transaction
    const walletChannel = supabase
      .channel('seller-wallet-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wallet", user.id] });
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wallet", user.id] });
          queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
        })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(issuesChannel);
      supabase.removeChannel(walletChannel);
    };
  }, [user, queryClient]);

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      toast.success("Product removed from inventory");
    },
    onError: (err: any) => toast.error("Failed to delete asset: " + err.message),
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      const { error } = await (supabase as any).from("categories").insert({ name, slug });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories", "full"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success("Category added");
      setNewCategoryName("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories", "full"] });
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const sellerAnalytics = analytics as any;
  const revenue = sellerAnalytics?.total_revenue || 0;
  const totalOrders = sellerAnalytics?.total_orders || 0;

  const chartData = Object.entries(orders.reduce((acc: Record<string, number>, o) => {
    const date = new Date(o.created_at).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {})).map(([date, count]) => ({ date, orders: count }));

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-black uppercase tracking-[0.2em] text-xs animate-pulse font-mono">Loading Secure Node...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="flex items-start">
        <DashboardSidebar activeTab={tab} setTab={setTab} pendingOrdersCount={pendingOrdersCount} openIssuesCount={openIssuesCount} />


        <main className="flex-1 p-6 md:p-10 pt-24 md:pt-10 pb-32 md:pb-10 max-w-6xl mx-auto space-y-10">
          {tab === "products" && (
            <InventoryTab
              products={products}
              totalProducts={totalProducts}
              productsPage={productsPage}
              setProductsPage={setProductsPage}
              setEditingProduct={setEditingProduct}
              deleteProductMutation={deleteProductMutation}
              pageSize={PAGE_SIZE}
              onListProduct={() => setTab("list-product")}
            />
           )}

          {tab === "list-product" && <ListProductTab />}

          {tab === "orders" && (
            <OrdersTab
              orders={orders}
              updateOrderStatus={updateOrderStatus}
              sellerZone={sellerProfile?.zone || undefined}
              sellerZoneId={(sellerProfile as any)?.zone_id}
              sellerCityId={(sellerProfile as any)?.city_id}
              sellerAddress={sellerProfile?.business_address || undefined}
              broadcastOrder={(orderId, zone, zoneId, pickupAddress, pickupTime) =>
                broadcastOrderMutation.mutate({ id: orderId, zone, zoneId, cityId: (sellerProfile as any)?.city_id, pickupAddress, pickupTime })
              }
            />
          )}

          {tab === "wallet" && <WalletTab />}

          {tab === "analytics" && (
            <AnalyticsTab
              revenue={revenue}
              totalOrders={totalOrders}
              chartData={chartData}
            />
          )}

          {tab === "categories" && (
            <CategoryTab
              dbCategories={dbCategories}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              addCategoryMutation={addCategoryMutation}
              deleteCategoryMutation={deleteCategoryMutation}
            />
          )}

          {tab === "issues" && <IssuesTab />}

          {tab === "payments" && <PaymentReconciliationTab />}
        </main>
      </div>

      <EditProductModal
        product={editingProduct}
        setProduct={setEditingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={(p) => updateProduct.mutate(p)}
      />
    </div>
  );
}
