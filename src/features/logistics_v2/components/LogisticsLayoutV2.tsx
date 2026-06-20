import React, { useState, useEffect } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NotificationDropdown } from "@/features/logistics/components/NotificationDropdown";
import { Switch } from "@/shared/components/ui/switch";
import { toast } from "sonner";

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { id: "dashboard", label: "My Home", icon: LayoutDashboard },
    { id: "orders", label: "Accept Missions", icon: ShoppingBag },
    { id: "earnings", label: "Wallet & Earnings", icon: Wallet },
    { id: "verification", label: "Verify ID", icon: ShieldCheck },
    { id: "settings", label: "My Profile", icon: Settings },
];

export function LogisticsLayoutV2({ children, activeTab, onTabChange, balance = 0, escrow_balance = 0, isOnline = false, onOnlineToggle, kycStatus = "none" }: {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    balance?: number;
    escrow_balance?: number;
    isOnline?: boolean;
    onOnlineToggle?: (online: boolean) => void;
    kycStatus?: string;
}) {
    const { user, profile, signOut } = useAuth();
    const queryClient = useQueryClient();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
            .channel("layout-notifications")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
                    queryClient.invalidateQueries({ queryKey: ["notifications-recent"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col lg:flex-row font-sans selection:bg-orange-100 selection:text-orange-900">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-black/[0.04] h-screen sticky top-0 p-6 z-50">
                <div className="flex items-center gap-3 mb-12 px-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#E96F28] flex items-center justify-center text-white shadow-xl shadow-orange-600/20">
                        <span className="font-black text-xl">L</span>
                    </div>
                    <span className="font-black text-xl tracking-tight uppercase">Linkup<span className="text-[#E96F28]"> PARTNER</span></span>
                </div>

                <nav className="flex-1 space-y-1.5">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                                activeTab === item.id
                                    ? "bg-[#E96F28] text-white shadow-lg shadow-orange-600/20"
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
                        <span>Logout</span>
                    </Button>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="lg:hidden h-18 bg-white/80 backdrop-blur-xl border-b border-black/[0.04] sticky top-0 z-[60] px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E96F28] flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
                        <span className="font-black text-lg">L</span>
                    </div>
                    <span className="font-black text-lg tracking-tight uppercase">Linkup</span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Availability toggle (Mobile) */}
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-500",
                        isOnline 
                            ? "bg-emerald-50 border-emerald-100/50 text-emerald-700" 
                            : "bg-gray-50 border-gray-200 text-gray-500"
                    )}>
                        <span className="text-[9px] font-black uppercase tracking-widest">{isOnline ? "Online" : "Offline"}</span>
                        <Switch 
                            checked={isOnline} 
                            onCheckedChange={onOnlineToggle}
                            className="scale-75 data-[state=checked]:bg-emerald-500"
                        />
                    </div>

                    <button 
                        onClick={signOut}
                        className="p-2 text-red-500 transition-colors hover:text-red-600 active:scale-95"
                        title="Logout"
                    >
                        <LogOut size={22} strokeWidth={2.2} />
                    </button>

                    <NotificationDropdown>
                        <button className="relative p-2 text-muted-foreground transition-colors hover:text-foreground">
                            <Bell size={22} strokeWidth={2.2} />
                            {unreadCount > 0 && (
                                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E96F28] text-[8px] font-bold text-white shadow-lg border-2 border-white animate-in zoom-in duration-300">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>
                    </NotificationDropdown>
                    <Avatar className="h-9 w-9 border border-black/[0.04] shadow-sm ml-1">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-black text-xs uppercase">
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
                        {/* Availability Toggle (Desktop) */}
                        <div className={cn(
                            "flex items-center gap-3 px-5 py-2.5 rounded-[20px] border transition-all duration-500 shadow-sm",
                            isOnline 
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                : "bg-gray-50/50 border-black/[0.03] text-gray-500"
                        )}>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Availability</span>
                                <span className={cn("text-[8px] font-bold uppercase mt-1", isOnline ? "text-emerald-500" : "text-gray-400")}>
                                    {isOnline ? "Receiving Missions" : "Off Duty"}
                                </span>
                            </div>
                            <Switch 
                                checked={isOnline} 
                                onCheckedChange={onOnlineToggle}
                                className="data-[state=checked]:bg-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 mr-4 bg-gray-50/50 px-4 py-2 rounded-2xl border border-black/[0.03]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Available</span>
                            <span className="text-sm font-black text-foreground">₦ {balance.toLocaleString()}</span>
                        </div>

                        {escrow_balance > 0 && (
                            <div className="flex items-center gap-2 mr-4 bg-amber-50/50 px-4 py-2 rounded-2xl border border-amber-100/50">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 mr-2">Security Hold</span>
                                <span className="text-sm font-black text-amber-700">₦ {escrow_balance.toLocaleString()}</span>
                            </div>
                        )}

                        <button 
                            onClick={signOut}
                            className="p-2.5 bg-white border border-black/[0.05] rounded-xl text-red-500 hover:text-red-600 hover:border-red-100 hover:shadow-sm transition-all"
                            title="Logout"
                        >
                            <LogOut size={18} strokeWidth={2.5} />
                        </button>

                        <NotificationDropdown>
                            <button className="relative p-2.5 bg-white border border-black/[0.05] rounded-xl text-muted-foreground hover:text-[#E96F28] hover:border-orange-100 hover:shadow-sm transition-all group">
                                <Bell size={18} strokeWidth={2.5} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E96F28] text-[8px] font-bold text-white shadow-lg border-2 border-white animate-in zoom-in duration-300">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                        </NotificationDropdown>

                        <div className="flex items-center gap-3 group cursor-pointer pl-6 border-l border-black/[0.04]">
                            <div className="text-right">
                                <p className="text-sm font-black leading-tight group-hover:text-[#E96F28] transition-colors uppercase tracking-tight">{profile?.display_name || "Partner"}</p>
                                {(kycStatus === 'verified' || kycStatus === 'approved') ? (
                                    <p className="text-[10px] font-bold text-[#E96F28] uppercase tracking-widest leading-none mt-1">Verified Partner</p>
                                ) : (
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">Unverified Partner</p>
                                )}
                            </div>
                            <Avatar className="h-10 w-10 border border-black/[0.04] shadow-md group-hover:scale-105 transition-transform duration-300">
                                <AvatarImage src={profile?.avatar_url || ""} />
                                <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-bold">U</AvatarFallback>
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
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-white/95 backdrop-blur-xl border-t border-black/[0.04] px-1 flex items-center justify-between z-[60] pb-safe">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "flex flex-col flex-1 items-center justify-center gap-1.5 h-full rounded-2xl transition-all relative overflow-hidden",
                            activeTab === item.id ? "text-[#E96F28]" : "text-muted-foreground"
                        )}
                    >
                        <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} className="shrink-0" />
                        <span className="text-[8px] font-black uppercase tracking-wider leading-none w-full text-center truncate px-0.5">{item.label}</span>
                        {activeTab === item.id && (
                            <motion.div
                                layoutId="mobile-nav-pill"
                                className="absolute top-0 w-8 h-1 bg-[#E96F28] rounded-b-full"
                            />
                        )}
                    </button>
                ))}
            </nav>
        </div>
    );
}
