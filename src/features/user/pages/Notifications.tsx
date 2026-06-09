import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { Bell } from "lucide-react";

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("id, message, read, created_at, type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  useEffect(() => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length > 0) markRead.mutate();
  }, [notifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Notifications</h1>
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell size={32} className="mx-auto mb-2 opacity-50" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className={cn("p-3 rounded-lg border text-sm", n.read ? "bg-card" : "bg-primary/5 border-primary/20")}>
                <p>{n.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
