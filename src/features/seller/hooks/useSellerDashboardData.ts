import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "sonner";

import { useCategories } from "@/shared/hooks/use-marketplace-metadata";

export function useSellerDashboardData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productsPage, setProductsPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
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

  const { data: ordersData } = useQuery({
    queryKey: ["seller-orders-v3", user?.id, ordersPage],
    queryFn: async () => {
      if (!user) return { data: [], count: 0 };
      const { data, count } = await supabase
        .from("orders")
        .select(`
          id, status, created_at, total_amount, 
          order_items (
            id,
            product_id,
            quantity,
            price_at_purchase,
            products (
              title,
              images
            )
          ),
          order_recipient (
            full_name,
            phone,
            address_line,
            city_id,
            zone_id,
            cities: city_id (name),
            delivery_zones: zone_id (name)
          ),
          shipments(
            id, status, tracking_code, zone, zone_id,
            profiles: rider_id(
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
    refetchInterval: 15000,
  });

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: verification } = await supabase
        .from("seller_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      return {
        ...profile,
        verification: verification
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
        .select("id", { count: "exact" })
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
        .select("id", { count: "exact" })
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
      const { data, error } = await supabase.rpc("get_seller_analytics", { seller_uuid: user.id });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("wallets").select("id, balance, escrow_balance").eq("seller_id", user.id).maybeSingle();
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

  const { data: dbCategories = [] } = useCategories();

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
      queryClient.invalidateQueries({ queryKey: ["seller-orders-v3"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      queryClient.invalidateQueries({ queryKey: ["seller-analytics"] });
      toast.success("Order status updated");
    },
    onError: (error: any) => {
      console.error("Mutation Error:", error);
      toast.error("Failed to update status: " + (error.message || "Unknown error"));
    }
  });

  const broadcastOrderMutation = useMutation({
    mutationFn: async ({ id, zone, zoneId, cityId, pickupAddress, pickupTime, lat, lng }: { 
        id: string; 
        zone: string; 
        zoneId?: string; 
        cityId?: string; 
        pickupAddress: string; 
        pickupTime: string;
        lat?: number;
        lng?: number;
    }) => {
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "awaiting_agent"
        })
        .eq("id", id);
      if (orderError) throw orderError;

      const { error: shipmentError } = await supabase
        .from("shipments")
        .upsert({
          order_id: id,
          zone: zone,
          zone_id: zoneId,
          city_id: cityId,
          status: "broadcast",
          pickup_address_text: pickupAddress,
          pickup_time: pickupTime ? new Date(pickupTime).toISOString() : null,
          pickup_lat: lat,
          pickup_lng: lng,
          updated_at: new Date().toISOString()
        }, { onConflict: 'order_id' });

      if (shipmentError) {
        console.error("Secondary Shipment Update Error (Non-Critical):", shipmentError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders-v3"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
      toast.success("Order broadcasted! Waiting for an agent to claim.");
    },
    onError: (error: any) => {
      toast.error("Failed to broadcast: " + (error.message || "Unknown error"));
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (!user) throw new Error("Not authenticated");
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: formData.display_name,
          phone: formData.phone,
          bio: formData.bio,
          email: formData.email,
          payout_bank_name: formData.payout_bank_name,
          payout_account_number: formData.payout_account_number,
          payout_account_name: formData.payout_account_name
        })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      const { error: verificationError } = await supabase
        .from("seller_verifications")
        .update({
          business_name: formData.business_name,
          business_address: formData.business_address
        })
        .eq("user_id", user.id);
      if (verificationError) throw verificationError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-profile", user?.id] });
      toast.success("Profile updated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to update profile: " + (error.message || "Unknown error"));
    }
  });

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
      const { error } = await supabase.from("categories").insert({ name, slug });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories", "full"] });
      toast.success("Category added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories", "full"] });
      toast.success("Category deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: totals } = useQuery({
    queryKey: ["seller-totals", user?.id],
    queryFn: async () => {
      if (!user) return { revenue: 0, count: 0, chartData: [] };
      const { data, error } = await supabase
        .from("orders")
        .select("total_amount, created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: true });
      if (error) return { revenue: 0, count: 0, chartData: [] };
      const totalRevenue = data.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const chartValues = Object.entries(data.reduce((acc: Record<string, number>, o) => {
        const date = new Date(o.created_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {})).map(([date, count]) => ({ date, orders: count }));
      return { revenue: totalRevenue, count: data.length, chartData: chartValues };
    },
    enabled: !!user,
  });

  return {
    products: productsData?.data || [],
    totalProducts: productsData?.count || 0,
    orders: ordersData?.data || [],
    sellerProfile,
    pendingOrdersCount,
    openIssuesCount,
    analytics,
    wallet,
    transactions,
    dbCategories,
    totals,
    editingProduct,
    setEditingProduct,
    productsPage,
    setProductsPage,
    ordersPage,
    setOrdersPage,
    updateProduct,
    updateOrderStatus,
    broadcastOrderMutation,
    updateProfileMutation,
    deleteProductMutation,
    addCategoryMutation,
    deleteCategoryMutation,
    PAGE_SIZE,
  };
}
