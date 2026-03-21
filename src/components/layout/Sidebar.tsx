import { Link, useLocation, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as lucideIcons from "lucide-react";
import {
    LayoutDashboard, Store, ShoppingBag, ShoppingCart, Heart, MessageSquare, HelpCircle,
    Grid, Activity, Smartphone, Shirt, Home as HomeIcon, MoreHorizontal,
    Headphones, Watch, TrendingUp, Footprints, LogOut, CheckCircle2, Truck, ShieldCheck, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Logo from "@/assets/logo.png";

export function SidebarContent() {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, signOut } = useAuth();
    const isOrdersPage = location.pathname === "/orders";

    const { data: categories = [] } = useQuery({
        queryKey: ["sidebar-categories"],
        queryFn: async () => {
            const { data } = await (supabase as any).from("categories").select("name, icon").order("name");
            return (data as any[]) ?? [];
        },
    });

    const mainNav = [
        { icon: HomeIcon, label: "Marketplace", path: "/" },
        { icon: ShoppingBag, label: "My Orders", path: "/orders" },
        { icon: ShoppingCart, label: "Cart", path: "/cart" },
        { icon: Heart, label: "Wishlist", path: "/wishlist" },
        { icon: HelpCircle, label: "Support", path: "/support" },
    ];

    const { data: userRoles = [] } = useQuery({
        queryKey: ["sidebar-roles", user?.id],
        queryFn: async () => {
            if (!user) return [] as string[];
            const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
            return (data?.map((r) => r.role) ?? []) as string[];
        },
        enabled: !!user,
    });

    const orderFilters = [
        { value: "all", label: "All Orders", icon: ShoppingBag },
        { value: "to-ship", label: "To Ship", icon: ShoppingBag },
        { value: "to-receive", label: "To Receive", icon: Truck },
        { value: "completed", label: "Completed", icon: CheckCircle2 },
        { value: "cancelled", label: "Cancelled", icon: X },
    ];


    // Optimized NavItem to avoid 'component' tag which might not be supported in some React versions/configs
    const SidebarLink = ({ item, isActive, onClick }: { item: any, isActive: boolean, onClick?: () => void }) => {
        const content = (
            <>
                <item.icon
                    size={18}
                    className={cn(
                        "transition-transform group-hover:scale-105",
                        isActive && "text-primary",
                        item.color
                    )}
                />
                <span className="truncate">{item.label}</span>
                {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-primary flex-shrink-0" />}
            </>
        );

        const className = cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group text-sm font-medium w-full text-left",
            isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
        );

        if (item.path) {
            return (
                <Link to={item.path} className={className}>
                    {content}
                </Link>
            );
        }

        return (
            <button onClick={onClick} className={className}>
                {content}
            </button>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center gap-2.5 px-5 py-4">
                <img src={Logo} alt="Linkup" className="h-12 w-12 rounded-full object-cover" />
                <div>
                    <h1 className="text-lg font-black text-foreground leading-none tracking-tight">Linkup</h1>
                    <span className="text-[9px] text-muted-foreground tracking-[0.2em] font-black uppercase opacity-60">Global</span>
                </div>
            </div>

            <ScrollArea className="flex-1 px-4">
                <div className="space-y-6 pb-6">
                    <nav className="space-y-1">
                        {mainNav.map((item, idx) => (
                            <div key={item.path}>
                                <SidebarLink
                                    item={item}
                                    isActive={location.pathname === item.path && !searchParams.has("tab")}
                                />
                                {idx === 0 && userRoles.includes("seller") && (
                                    <SidebarLink
                                        item={{ icon: LayoutDashboard, label: "Seller Dashboard", path: "/dashboard" }}
                                        isActive={location.pathname === "/dashboard"}
                                    />
                                )}
                                {idx === 0 && userRoles.includes("logistics") && (
                                    <SidebarLink
                                        item={{ icon: Truck, label: "Logistics Fleet", path: "/logistics" }}
                                        isActive={location.pathname === "/logistics"}
                                    />
                                )}
                            </div>
                        ))}
                    </nav>

                    {isOrdersPage && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                            <h3 className="px-4 text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">Order Status</h3>
                            <nav className="space-y-1">
                                {orderFilters.map((filter) => (
                                    <SidebarLink
                                        key={filter.value}
                                        item={filter}
                                        isActive={searchParams.get("tab") === filter.value || (filter.value === "all" && !searchParams.has("tab"))}
                                        onClick={() => setSearchParams({ tab: filter.value })}
                                    />
                                ))}
                            </nav>
                        </div>
                    )}

                    {!isOrdersPage && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                            <h3 className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Categories</h3>
                            <nav className="space-y-1">
                                <SidebarLink
                                    item={{ icon: Grid, label: "All Products", path: "/" }}
                                    isActive={location.pathname === "/" && !searchParams.has("category")}
                                />
                                {categories.map((cat: any) => {
                                    const IconComponent = (lucideIcons as any)[cat.icon] || Grid;
                                    return (
                                        <SidebarLink
                                            key={cat.name}
                                            item={{
                                                icon: IconComponent,
                                                label: cat.name,
                                                path: `/?category=${encodeURIComponent(cat.name)}`
                                            }}
                                            isActive={searchParams.get("category") === cat.name}
                                        />
                                    );
                                })}
                            </nav>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="p-4 border-t mt-auto">
                {user ? (
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-3"
                        onClick={signOut}
                    >
                        <LogOut size={18} />
                        <span className="font-medium">Log Out</span>
                    </Button>
                ) : (
                    <Link to="/auth">
                        <Button className="w-full" size="sm">
                            <LogOut size={18} className="mr-2 rotate-180" />
                            Sign In
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
}

export function Sidebar() {
    return (
        <aside className="hidden md:flex flex-col w-64 h-[calc(100vh-2rem)] sticky top-4 bg-white rounded-xl border border-black/[0.03] shadow-sm z-50 overflow-hidden">
            <SidebarContent />
        </aside>
    );
}
