import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSellerRealtime(user: any) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const ordersChannel = supabase
      .channel('seller-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${user.id}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["seller-orders-v3"] });
          queryClient.invalidateQueries({ queryKey: ["pending-orders-count"] });
          queryClient.invalidateQueries({ queryKey: ["seller-analytics"] });

          if (payload.eventType === 'INSERT') {
            try {
              const audio = new Audio('/sounds/notification.mp3');
              audio.play().catch(err => {
                console.warn("Notification sound blocked: User must interact with page first.", err);
              });
              toast.success("New Order Received!", {
                description: "You have a new incoming order to process.",
                duration: 10000,
              });
            } catch (error) {
              console.error("Error playing notification sound:", error);
            }
          }
        })
      .subscribe();

    const issuesChannel = supabase
      .channel('seller-issues-badge-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `seller_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ["open-issues-count"] }); })
      .subscribe();

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
}
