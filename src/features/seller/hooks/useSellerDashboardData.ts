import { useState, useEffect } from "react";
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
      const { data, count, error } = await supabase
        .from("orders")
        .select(`
          id, status, created_at, grand_total, 
          order_settlements(
            seller_amount,
            status
          ),
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
            cities (name),
            delivery_zones (name)
          ),
          shipments(
            id, status, tracking_code, zone_id,
            delivery_fee
          )
        `, { count: "exact" })
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .range(ordersPage * PAGE_SIZE, (ordersPage + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error("Seller orders error:", error);
        toast.error("Failed to load orders: " + error.message);
      }
      return { data: (data as any[]) ?? [], count: count ?? 0 };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in garbage collection for 30 minutes
    refetchOnMount: "always", // Always fetch fresh data when component mounts
  });

  const { data: sellerProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["seller-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, user_id, display_name, avatar_url, phone, bio, email, city_id, zone_id, payout_bank_name, payout_account_number, payout_account_name"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: verification } = await supabase
        .from("seller_verifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
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


  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("wallets").select("id, balance, escrow_balance").eq("user_id", user.id).maybeSingle();
      if (!data) {
        const { data: newWallet, error } = await supabase.from("wallets").insert({ user_id: user.id }).select().single();
        if (error) {
          console.error("Wallet insert error:", error);
          return { id: "temp", balance: 0, escrow_balance: 0 };
        }
        return newWallet;
      }
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["seller-transactions", wallet?.id],
    queryFn: async () => {
      if (!wallet || wallet.id === "temp") return [];
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false });
      return data || [];
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
    mutationFn: async ({
      id, zone, zoneId, cityId, pickupAddress, deliveryAddress, pickupTime, lat, lng,
      deliveryFeeAmount, crossZoneFeeAmount, distanceKm
    }: {
      id: string;
      zone: string;
      zoneId?: string;
      cityId?: string;
      pickupAddress: string;
      deliveryAddress: string;
      pickupTime: string;
      lat?: number;
      lng?: number;
      deliveryFeeAmount?: number;
      crossZoneFeeAmount?: number;
      distanceKm?: number;
    }) => {
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "awaiting_agent",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (orderError) throw orderError;

      const { error: shipmentError } = await supabase
        .from("shipments")
        .update({
          seller_id: user.id,
          zone_id: zoneId,
          status: "broadcast",
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          delivery_fee: deliveryFeeAmount || null,
          distance_km: distanceKm || null,
          updated_at: new Date().toISOString()
        })
        .eq('order_id', id);

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
        .select(`
          created_at,
          order_settlements (
            seller_amount
          )
        `)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) return { revenue: 0, count: 0, chartData: [] };
      const totalRevenue = data.reduce((sum, o) => {
        const settlementAmount = o.order_settlements ? (Array.isArray(o.order_settlements) ? o.order_settlements[0]?.seller_amount : (o.order_settlements as any)?.seller_amount) : 0;
        return sum + (Number(settlementAmount) || 0);
      }, 0);
      const chartValues = Object.entries(data.reduce((acc: Record<string, number>, o) => {
        const date = new Date(o.created_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {})).map(([date, count]) => ({ date, orders: count }));
      return { revenue: totalRevenue, count: data.length, chartData: chartValues };
    },
    enabled: !!user,
  });

  // Realtime Subscriptions
  useEffect(() => {
    if (!user) return;

    // Listen for orders changes for this seller
    const orderChannel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${user.id}`
        },
        (payload) => {
          console.log("Seller Dashboard: Received Order Update", payload);
          queryClient.invalidateQueries({ queryKey: ["seller-orders-v3"] });
          queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
          queryClient.invalidateQueries({ queryKey: ["seller-analytics"] });
          queryClient.invalidateQueries({ queryKey: ["seller-totals"] });
        }
      )
      .subscribe((status) => {
        console.log(`Seller Dashboard: Order Channel Status: ${status}`);
      });

    // Listen for shipment changes for this seller's orders
    const shipmentChannel = supabase
      .channel(`seller-shipments-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `seller_id=eq.${user.id}`
        },
        (payload) => {
          console.log("Seller Dashboard: Received Shipment Update", payload);
          queryClient.invalidateQueries({ queryKey: ["seller-orders-v3"] });
        }
      )
      .subscribe((status) => {
        console.log(`Seller Dashboard: Shipment Channel Status: ${status}`);
      });

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(shipmentChannel);
    };
  }, [user, queryClient]);

  // Realtime Subscriptions for Wallet
  useEffect(() => {
    if (!wallet?.id || wallet.id === "temp") return;

    const txChannel = supabase
      .channel(`wallet-tx-${wallet.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `wallet_id=eq.${wallet.id}`
        },
        (payload) => {
          console.log("Seller Dashboard: Received New Wallet Transaction", payload);
          queryClient.invalidateQueries({ queryKey: ["seller-transactions"] });
          queryClient.invalidateQueries({ queryKey: ["wallet"] });

          const newTx = payload.new as any;
          if (newTx) {
            const isCredit = newTx.type === 'settlement' || newTx.type === 'deposit';
            toast(isCredit ? 'Payment Received' : 'Funds Deducted', {
              description: `${isCredit ? '+' : '-'}₦${Number(newTx.amount).toLocaleString()} for ${newTx.reference || newTx.type}`,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`Seller Dashboard: Wallet Tx Channel Status: ${status}`);
      });

    return () => {
      supabase.removeChannel(txChannel);
    };
  }, [wallet?.id, queryClient]);

  return {
    products: productsData?.data || [],
    totalProducts: productsData?.count || 0,
    orders: ordersData?.data || [],
    sellerProfile,
    isProfileLoading,
    pendingOrdersCount,
    openIssuesCount,
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
