import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Bell, Check, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export function NotificationDropdown({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications-recent", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user && open,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
      queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-white border-black/[0.05] shadow-2xl rounded-2xl overflow-hidden" align="end">
        <div className="p-4 border-b border-black/[0.03] flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-tight">Recent Alerts</span>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={() => markAllRead.mutate()}
              className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-muted-foreground/30">
                <Bell size={24} />
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No alerts yet</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.02]">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "p-4 transition-colors relative group",
                    n.read ? "bg-white" : "bg-blue-50/30"
                  )}
                >
                  {!n.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                  )}
                  <p className={cn(
                    "text-xs leading-relaxed",
                    n.read ? "text-muted-foreground font-medium" : "text-foreground font-bold"
                  )}>
                    {n.message}
                  </p>
                  <div className="flex items-center gap-2 mt-2 opacity-50">
                    <Clock size={10} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 bg-gray-50/50 border-t border-black/[0.03]">
          <Link to="/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-center h-10 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-white border border-black/[0.03] hover:bg-white hover:border-black/[0.08] transition-all">
              <ExternalLink size={12} />
              View full activity
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
