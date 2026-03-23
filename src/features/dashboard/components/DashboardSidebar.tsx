import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/context/AuthContext";
import { RoleSwitcher } from "@/shared/components/layout/RoleSwitcher";
import {
    LayoutDashboard, Plus, Package, ShoppingBag,
    Wallet, BarChart3, TrendingUp, AlertCircle,
    LogOut, Menu, CreditCard
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router-dom";

export type Tab = "products" | "list-product" | "orders" | "wallet" | "analytics" | "categories" | "issues" | "payments";

interface DashboardSidebarProps {
    activeTab: Tab;
    setTab: (tab: Tab) => void;
    pendingOrdersCount?: number;
    openIssuesCount?: number;
}


export const tabs = [
    { id: "products" as Tab, label: "Inventory", icon: Package },
    { id: "list-product" as Tab, label: "List Product", icon: Plus },
    { id: "orders" as Tab, label: "Orders", icon: ShoppingBag },
    { id: "issues" as Tab, label: "Issues", icon: AlertCircle },
    { id: "wallet" as Tab, label: "Revenue", icon: Wallet },
    { id: "analytics" as Tab, label: "Insights", icon: BarChart3 },
    { id: "categories" as Tab, label: "Registry", icon: TrendingUp },
    { id: "payments" as Tab, label: "Payments", icon: CreditCard },
];

export function DashboardSidebar({ activeTab, setTab, pendingOrdersCount = 0, openIssuesCount = 0 }: DashboardSidebarProps) {
    const { signOut } = useAuth();
    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="w-64 border-r bg-white/80 backdrop-blur-xl h-screen p-6 hidden md:block sticky top-0 z-30 overflow-y-auto no-scrollbar">
                <div className="mb-10 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <LayoutDashboard size={20} />
                        </div>
                        <h2 className="font-black text-xl tracking-tight">Seller Central</h2>
                    </div>
                </div>

                <div className="mb-6">
                    <RoleSwitcher />
                </div>

                <nav className="space-y-2">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={cn(
                                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 group",
                                activeTab === id
                                    ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]"
                                    : "text-muted-foreground hover:bg-black/[0.03]"
                            )}
                        >
                            <div className="flex items-center gap-3 relative">
                                <Icon size={18} strokeWidth={activeTab === id ? 3 : 2} />
                                {label}
                                {id === "orders" && pendingOrdersCount > 0 && (
                                    <span className="absolute -top-1 -left-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                )}
                                {id === "issues" && openIssuesCount && openIssuesCount > 0 && (
                                    <span className="absolute -top-1 -left-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                    </span>
                                )}
                            </div>
                            {activeTab === id && <Plus size={14} strokeWidth={4} className="animate-in fade-in zoom-in" />}

                        </button>
                    ))}
                </nav>
                <div className="mt-auto pt-6 space-y-4">
                    <button
                        onClick={signOut}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all duration-300"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>

                    <div className="p-4 rounded-xl bg-muted/30 border border-black/5">
                        <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-1">System Status</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <p className="text-[10px] font-bold text-foreground">Secure & Online</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Nav (Top Bar with Hamburger) */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/5 h-16 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
                        <LayoutDashboard size={16} />
                    </div>
                    <h2 className="font-black text-lg tracking-tight">Seller Central</h2>
                </div>

                <div className="flex items-center gap-2">
                    <RoleSwitcher />
                </div>

                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                            <Menu size={24} />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-6 flex flex-col no-scrollbar overflow-y-auto">
                        <SheetHeader className="text-left mb-8">
                            <SheetTitle className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
                                    <LayoutDashboard size={16} />
                                </div>
                                <span className="font-black tracking-tight">Menu</span>
                            </SheetTitle>
                        </SheetHeader>

                        <nav className="space-y-2 flex-1">
                            {tabs.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setTab(id)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300",
                                        activeTab === id
                                            ? "bg-primary text-white shadow-xl shadow-primary/20"
                                            : "text-muted-foreground hover:bg-black/[0.03]"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} strokeWidth={activeTab === id ? 3 : 2} />
                                        {label}
                                    </div>
                                    {activeTab === id && <Plus size={14} strokeWidth={4} />}
                                </button>
                            ))}
                        </nav>

                        <div className="mt-auto pt-6 space-y-4">
                            <button
                                onClick={signOut}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all duration-300"
                            >
                                <LogOut size={18} />
                                Logout
                            </button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* Mobile Bottom Nav (Keeping for quick access) */}
            <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 flex items-center justify-around bg-white/90 backdrop-blur-2xl border border-black/5 h-16 rounded-xl shadow-up-2xl p-2 max-w-md mx-auto">
                {tabs.slice(0, 4).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 h-full rounded-xl transition-all",
                            activeTab === id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground"
                        )}
                    >
                        <div className="relative">
                            <Icon size={20} strokeWidth={activeTab === id ? 3 : 2} />
                            {id === "orders" && pendingOrdersCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest leading-none">{label}</span>
                    </button>
                ))}
            </div>
        </>
    );
}

