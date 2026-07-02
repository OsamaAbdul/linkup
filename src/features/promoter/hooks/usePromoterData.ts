import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "sonner";

export function usePromoterData() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get or create promoter code
  const { data: promoterCode, isLoading: codeLoading } = useQuery({
    queryKey: ["promoter-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("promoter_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[PromoterDebug] Error fetching code:", error);
      }

      if (data) return data.code;

      const code = "PX" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: insertError } = await supabase.from("promoter_codes").insert({ user_id: user.id, code });

      if (insertError) {
        console.error("[PromoterDebug] Error inserting code:", insertError);
      }

      return code;
    },
    enabled: !!user,
  });

  // Commissions
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ["commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("order_settlements")
        .select(`
          id,
          promoter_amount,
          status,
          created_at,
          order_id,
          orders!inner(promoter_id)
        `)
        .eq("orders.promoter_id", user.id)
        .gt("promoter_amount", 0)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[PromoterDebug] Error fetching order_settlements:", error);
      }

      return (data || []).map((d: any) => ({
        ...d,
        amount: d.promoter_amount
      }));
    },
    enabled: !!user,
  });

  // Wallet and Balance
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["promoter-wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase
        .from("wallets" as any)
        .select("balance, escrow_balance")
        .eq("user_id", user.id)
        .maybeSingle() as any);

      console.log("[PromoterDebug] Wallet Balance State:", {
        available: data?.balance,
        escrow: data?.escrow_balance
      });
      return data;
    },
    enabled: !!user,
  });

  // Referrals Table (Debug/Audit)
  const { data: referrals = [] } = useQuery({
    queryKey: ["promoter-referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("referrals")
        .select("id, status, created_at, order_id, orders(buyer_id), promoter_campaigns(product_id)")
        .eq("promoter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      console.log("[PromoterDebug] Referrals Table Data:", data);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Payout Requests
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["promoter-withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase
        .from("payout_requests" as any)
        .select("id, amount, status, created_at, admin_notes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20) as any);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Real-time Sync
  useEffect(() => {
    if (!user) return;

    // Listen for payout status changes
    const payoutChannel = supabase
      .channel('payout-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["promoter-withdrawals"] });
          queryClient.invalidateQueries({ queryKey: ["promoter-wallet"] });
        }
      )
      .subscribe();

    // Listen for balance changes
    const walletChannel = supabase
      .channel('wallet-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["promoter-wallet"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(payoutChannel);
      supabase.removeChannel(walletChannel);
    };
  }, [user, queryClient]);

  // Marketplace Products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["promoter-marketplace"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("products" as any)
        .select("id, title, price, images, description, inventory")
        .gt("inventory", 0)
        .order("created_at", { ascending: false })
        .limit(20) as any);
      return data ?? [];
    },
  });

  // Withdrawal Mutation
  const withdrawalMutation = useMutation({
    mutationFn: async (payload: { amount: number, bankName: string, accountNumber: string, accountName: string }) => {
      const { data, error } = await (supabase.rpc as any)("request_withdrawal", {
        p_user_id: user?.id,
        p_amount: payload.amount,
        p_bank_name: payload.bankName,
        p_account_number: payload.accountNumber,
        p_account_name: payload.accountName
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success("Withdrawal request submitted!");
        queryClient.invalidateQueries({ queryKey: ["promoter-wallet"] });
        queryClient.invalidateQueries({ queryKey: ["promoter-withdrawals"] });
      } else {
        toast.error(data.error || "Failed to submit withdrawal");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred");
    }
  });

  return {
    promoterCode,
    codeLoading,
    commissions,
    commissionsLoading,
    wallet,
    walletLoading,
    referrals,
    withdrawals,
    withdrawalsLoading,
    products,
    productsLoading,
    withdrawalMutation
  };
}
