import React, { useState } from "react";
import {
    LayoutDashboard,
    ShoppingBag,
    Wallet,
    ShieldCheck,
    Settings,
    Bell,
    Menu,
    X,
    User,
    LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "Deliveries", icon: ShoppingBag },
    { id: "earnings", label: "Earnings", icon: Wallet },
    { id: "verification", label: "ID Verification", icon: ShieldCheck },
    { id: "settings", label: "Settings", icon: Settings },
];

export function LogisticsLayoutV2({ children, activeTab, onTabChange, balance = 0, escrow_balance = 0 }: {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    balance?: number;
    escrow_balance?: number;
}) {
    const { profile, signOut } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col lg:flex-row font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-black/[0.04] h-screen sticky top-0 p-6 z-50">
                <div className="flex items-center gap-3 mb-12 px-2">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                        <span className="font-black text-xl">L</span>
                    </div>
                    <span className="font-black text-xl tracking-tight uppercase">Linkup<span className="text-blue-600"> AGENT</span></span>
                </div>

                <nav className="flex-1 space-y-1.5">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                                activeTab === item.id
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
                            )}
                        >
                            <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                            <span className="font-bold text-[13px] tracking-tight">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-6 border-t border-black/[0.04]">
                    <Button
                        variant="ghost"
                        onClick={signOut}
                        className="w-full justify-start gap-4 h-12 rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-600 font-bold transition-all"
                    >
                        <LogOut size={20} />
                        <span>Logout Account</span>
                    </Button>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden h-18 bg-white/80 backdrop-blur-xl border-b border-black/[0.04] sticky top-0 z-[60] px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                        <span className="font-black text-lg">L</span>
                    </div>
                    <span className="font-black text-lg tracking-tight uppercase">Linkup</span>
                </div>

                <div className="flex items-center gap-3">
                    <button className="relative p-2 text-muted-foreground transition-colors hover:text-foreground">
                        <Bell size={22} strokeWidth={2.2} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white" />
                    </button>
                    <Avatar className="h-9 w-9 border border-black/[0.04] shadow-sm">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-blue-50 text-blue-600 font-black text-xs uppercase">
                            {profile?.display_name?.charAt(0) || "U"}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </header>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[70] lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen">
                {/* Desktop Top Bar */}
                <header className="hidden lg:flex h-20 bg-white/50 backdrop-blur-md border-b border-black/[0.04] items-center justify-between px-10 sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-black tracking-tight capitalize">{activeTab}</h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 mr-4 bg-gray-50/50 px-4 py-2 rounded-2xl border border-black/[0.03]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Available</span>
                            <span className="text-sm font-black text-foreground">₦ {balance.toLocaleString()}</span>
                        </div>

                        {escrow_balance > 0 && (
                            <div className="flex items-center gap-2 mr-4 bg-amber-50/50 px-4 py-2 rounded-2xl border border-amber-100/50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 mr-2">Held for safety</span>
                                <span className="text-sm font-black text-amber-700">₦ {escrow_balance.toLocaleString()}</span>
                            </div>
                        )}

                        <button className="relative p-2.5 bg-white border border-black/[0.05] rounded-xl text-muted-foreground hover:text-blue-600 hover:border-blue-100 hover:shadow-sm transition-all">
                            <Bell size={18} strokeWidth={2.5} />
                            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-600 rounded-full border-2 border-white" />
                        </button>

                        <div className="flex items-center gap-3 group cursor-pointer pl-6 border-l border-black/[0.04]">
                            <div className="text-right">
                                <p className="text-sm font-black leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight">{profile?.display_name || "Agent"}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">Verified Logistics</p>
                            </div>
                            <Avatar className="h-10 w-10 border border-black/[0.04] shadow-md group-hover:scale-105 transition-transform duration-300">
                                <AvatarImage src={profile?.avatar_url || ""} />
                                <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">U</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                <div className="p-4 lg:p-10 pb-32 lg:pb-10 max-w-7xl mx-auto w-full">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {children}
                    </motion.div>
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-xl border-t border-black/[0.04] px-4 flex items-center justify-around z-[60] pb-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all relative",
                            activeTab === item.id ? "text-blue-600" : "text-muted-foreground"
                        )}
                    >
                        <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">{item.label}</span>
                        {activeTab === item.id && (
                            <motion.div
                                layoutId="mobile-nav-pill"
                                className="absolute -top-1 w-8 h-1 bg-blue-600 rounded-full"
                            />
                        )}
                    </button>
                ))}
            </nav>
        </div>
    );
}
