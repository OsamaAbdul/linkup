import { Bell, MapPin, User, LogOut, Package, CreditCard, Search, ShoppingCart, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { totalCount } = useCart();

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

  return (
    <header className="sticky top-0 z-50 glass border-b-[0.5px] border-white/10">
      <div className="flex items-center justify-between h-16 px-4 md:px-10 max-w-[1700px] mx-auto">
        {/* Logo Section */}
        <div className="flex items-center gap-4 md:gap-12">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-primary/20 p-1.5 md:p-2 rounded-xl md:rounded-2xl group-hover:rotate-12 transition-all duration-300">
              <MapPin size={22} className="text-primary md:hidden" />
              <MapPin size={28} className="text-primary hidden md:block" />
            </div>
            <span className="text-xl md:text-2xl font-heading font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
              LinkUp
            </span>
          </Link>

          {/* Search - Desktop Only */}
          <div className="hidden md:block w-[400px]">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Search for anything..."
                className="pl-11 bg-muted/30 border-none rounded-2xl h-11 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="flex items-center gap-2 md:gap-6">
          <div className="flex items-center gap-1 md:gap-3">
            {/* Messages - Desktop Only */}
            <Button variant="ghost" size="icon" className="hidden md:flex relative group rounded-xl hover:bg-primary/5">
              <MessageSquare size={20} className="text-foreground/70 group-hover:text-primary transition-colors" />
            </Button>

            {/* Notifications */}
            <Link to="/notifications" className="relative">
              <Button variant="ghost" size="icon" className="rounded-full md:rounded-xl hover:bg-primary/5">
                <Bell size={20} className="text-foreground/80 md:text-foreground/70" />
              </Button>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-lg border-2 border-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Cart - Desktop Only (Mobile has BottomNav or dedicated link) */}
            <Link to="/cart" className="hidden md:block">
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
              <DropdownMenuContent align="end" className="w-64 glass border-white/10 rounded-2xl p-2 mt-4 shadow-2xl">
                <DropdownMenuLabel className="font-heading font-bold text-lg px-2 pt-2">Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5 my-2" />
                <Link to="/profile">
                  <DropdownMenuItem className="cursor-pointer rounded-xl py-3 px-3 focus:bg-primary/5 focus:text-primary">
                    <User className="mr-3 h-4 w-4" />
                    <span className="font-semibold">Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/orders">
                  <DropdownMenuItem className="cursor-pointer rounded-xl py-3 px-3 focus:bg-primary/5 focus:text-primary">
                    <Package className="mr-3 h-4 w-4" />
                    <span className="font-semibold">My Orders</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/wallet">
                  <DropdownMenuItem className="cursor-pointer rounded-xl py-3 px-3 focus:bg-primary/5 focus:text-primary">
                    <CreditCard className="mr-3 h-4 w-4" />
                    <span className="font-semibold">Wallet Transactions</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-white/5 my-2" />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-white focus:bg-destructive cursor-pointer rounded-xl py-3 px-3">
                  <LogOut className="mr-3 h-4 w-4" />
                  <span className="font-semibold">Logout Account</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

