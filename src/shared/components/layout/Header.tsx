import { Bell, MapPin, User, LogOut, Package, CreditCard, Search, ShoppingCart, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/features/marketplace/context/CartContext";
import { RoleSwitcher } from "./RoleSwitcher";
import { EditProfileModal } from "@/features/user/components/EditProfileModal";
import { UserCog } from "lucide-react";
import Logo from "@/assets/logo.png";
import { useState, useEffect } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/lib/utils";

function NotificationsList({ user }: { user: any }) {
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["recent-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("id, message, read, created_at, type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>;
  if (notifications.length === 0) return <div className="p-4 text-center text-sm text-muted-foreground">No recent notifications.</div>;

  return (
    <div className="flex flex-col">
      {notifications.map((n: any) => (
        <div key={n.id} className={cn("p-3 border-b border-white/5 text-sm transition-colors hover:bg-white/5 cursor-pointer", n.read ? "bg-transparent opacity-80" : "bg-primary/5 border-l-2 border-l-primary")}>
          <p className="line-clamp-2 leading-tight">{n.message}</p>
          <p className="text-[10px] text-muted-foreground mt-1 opacity-70 font-medium uppercase tracking-wider">{new Date(n.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { totalCount } = useCart();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel(`global-notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        // Invalidate queries to update bell and dropdown immediately
        queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["recent-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        
        // Show in-app toast for real-time feedback
        if (payload.new && payload.new.message) {
            import("sonner").then(({ toast }) => {
                toast("New Notification", {
                   description: payload.new.message,
                   action: {
                      label: "View",
                      onClick: () => window.location.href = "/notifications"
                   }
                });
            });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return (
    <header className="sticky top-0 z-50 glass border-b-[0.5px] border-white/10">
      <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 md:px-10 max-w-[1700px] mx-auto">
        <div className="flex items-center gap-3 sm:gap-6 md:gap-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 overflow-hidden rounded-xl border border-black/[0.03] shadow-sm transform group-hover:scale-105 transition-all duration-300">
              <img src={Logo} alt="Linkup Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg md:text-xl font-heading font-black tracking-tighter text-foreground leading-none">
                Linkup
              </span>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60 leading-none mt-0.5">Global</span>
            </div>
          </Link>

          {user && <RoleSwitcher />}


        </div>

        {/* Action Section */}
        <div className="flex items-center gap-2 md:gap-6">
          <div className="flex items-center gap-1 md:gap-3">
            {/* Messages - Desktop Only */}


            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="relative cursor-pointer">
                  <Button variant="ghost" size="icon" className="rounded-full md:rounded-xl hover:bg-primary/5">
                    <Bell size={20} className="text-foreground/80 md:text-foreground/70" />
                  </Button>
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-lg border-2 border-background">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 glass border-white/10 rounded-xl p-0 mt-4 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-background/50">
                  <span className="font-heading font-bold text-base">Notifications</span>
                  {unreadCount > 0 && (
                     <Badge variant="default" className="text-[10px] px-2 py-0 h-5 bg-primary text-white font-black">{unreadCount} New</Badge>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <NotificationsList user={user} />
                </div>
                <div className="p-2 border-t border-white/10 bg-background/50">
                  <Link to="/notifications" className="block text-center text-xs font-bold text-primary hover:text-primary/80 py-2">
                    View All Notifications
                  </Link>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cart - Desktop & Mobile */}
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="relative group rounded-xl hover:bg-primary/5">
                <ShoppingCart size={20} className="text-foreground/70 group-hover:text-primary transition-colors" />
                {totalCount > 0 && (
                  <span className="absolute top-1 right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-background animate-in zoom-in duration-300">
                    {totalCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>

          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 md:pl-6 md:border-l md:border-border/50 cursor-pointer group">
                    <div className="relative">
                      <Avatar className="h-9 w-9 md:h-10 md:w-10 border-2 border-white/20 transition-all group-hover:border-primary/50 shadow-sm">
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {(profile?.display_name ?? "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 md:h-3.5 w-3 md:w-3.5 bg-success rounded-full border-2 border-background shadow-sm" />
                    </div>
                    <div className="hidden md:block text-sm">
                      <p className="font-heading font-bold leading-tight group-hover:text-primary transition-colors">
                        {profile?.display_name ?? "User"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                        <div className="h-1 w-1 bg-primary rounded-full" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Premium</p>
                      </div>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 glass border-white/10 rounded-xl p-2 mt-4 shadow-2xl">
                  <DropdownMenuLabel className="font-heading font-bold text-lg px-2 pt-2">Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5 my-2" />
                  <Link to="/profile">
                    <DropdownMenuItem className="cursor-pointer rounded-xl py-3 px-3 focus:bg-primary/5 focus:text-primary">
                      <User className="mr-3 h-4 w-4" />
                      <span className="font-semibold">My Registry Page</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem 
                    onClick={() => setIsEditModalOpen(true)}
                    className="cursor-pointer rounded-xl py-3 px-3 focus:bg-primary/5 focus:text-primary"
                  >
                    <UserCog className="mr-3 h-4 w-4" />
                    <span className="font-semibold">Quick Edit Profile</span>
                  </DropdownMenuItem>
                  <Link to="/orders">
                    <DropdownMenuItem className="cursor-pointer rounded-xl py-3 px-3 focus:bg-primary/5 focus:text-primary">
                      <Package className="mr-3 h-4 w-4" />
                      <span className="font-semibold">My Orders</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator className="bg-white/5 my-2" />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-white focus:bg-destructive cursor-pointer rounded-xl py-3 px-3">
                    <LogOut className="mr-3 h-4 w-4" />
                    <span className="font-semibold">Logout Account</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <EditProfileModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} />
            </>
          ) : (
            <Link to="/auth" className="md:pl-4 md:border-l md:border-border/50">
              <Button size="sm" className="rounded-xl px-6 md:px-7 md:h-11 font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}


