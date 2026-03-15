import { Home, Search, ShoppingCart, Grid } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./Sidebar";
import { useCart } from "@/contexts/CartContext";
import { motion as m } from "framer-motion";

export function BottomNav() {
  const location = useLocation();
  const { totalCount } = useCart();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: ShoppingCart, label: "Cart", path: "/cart", count: totalCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t-[0.5px] border-white/10 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {navItems.map(({ icon: Icon, label, path, count }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all duration-300 relative px-3 py-1",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all duration-300",
                active ? "bg-primary/10 scale-110" : ""
              )}>
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              {count !== undefined && count > 0 && (
                <span className="absolute top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white shadow-lg border-2 border-background animate-in zoom-in duration-300">
                  {count > 9 ? "9+" : count}
                </span>
              )}
              <span className="text-[10px] font-heading font-bold uppercase tracking-tighter">{label}</span>

              {active && (
                <m.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-[17px] left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_2px_10px_rgba(79,70,229,0.5)]"
                />
              )}
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center gap-1.5 transition-all duration-300 px-3 py-1 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="p-1.5 rounded-xl transition-all duration-300">
                <Grid size={22} />
              </div>
              <span className="text-[10px] font-heading font-bold uppercase tracking-tighter">Menu</span>
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 glass border-white/10 rounded-r-3xl">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
