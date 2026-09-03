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
    LogOut,
    ChevronDown,
    Lock,
    Camera
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
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import { EditProfileModal } from "@/features/user/components/EditProfileModal";
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
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

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
        <div className="min-h-[100dvh] bg-[#F9FAFB] flex flex-col font-sans selection:bg-orange-100 selection:text-orange-900">
            {/* Mobile Header */}
            <header className="lg:hidden h-18 bg-white/80 backdrop-blur-xl border-b border-black/[0.04] sticky top-0 z-[60] px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E96F28] flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
                        <span className="font-black text-lg">L</span>
                    </div>
                    <span className="font-black text-lg tracking-tight uppercase">Linkup</span>
                </div>

                <div className="flex items-center gap-2">
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="outline-none focus:outline-none cursor-pointer">
                                <Avatar className="h-9 w-9 border border-black/[0.04] shadow-sm ml-1">
                                    <AvatarImage src={profile?.avatar_url || ""} />
                                    <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-black text-xs uppercase">
                                        {profile?.display_name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72 p-3 rounded-3xl bg-white border border-black/[0.06] shadow-2xl space-y-2.5 z-50">
                            <div className="p-2.5 rounded-2xl bg-gray-50/80 border border-black/[0.02] flex items-center gap-3">
                                <Avatar className="h-10 w-10 border border-black/[0.06] shadow-sm">
                                    <AvatarImage src={profile?.avatar_url || ""} />
                                    <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-black text-xs">
                                        {(profile?.display_name || "U").charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-foreground truncate uppercase">
                                        {profile?.display_name || "Oga Rider"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">{user?.email || "Rider Partner"}</p>
                                </div>
                            </div>
                            <div className="p-2.5 rounded-2xl bg-gray-50/80 border border-black/[0.03] flex items-center justify-between">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Available Balance</span>
                                    <span className="text-sm font-black text-foreground">₦ {balance.toLocaleString()}</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onTabChange("earnings")}
                                    className="h-7 px-2 rounded-xl text-[10px] font-bold text-[#E96F28]"
                                >
                                    View
                                </Button>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onTabChange("dashboard")} className="rounded-xl font-bold text-xs py-2 gap-2">
                                <LayoutDashboard size={14} className="text-muted-foreground" />
                                <span>Home</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onTabChange("orders")} className="rounded-xl font-bold text-xs py-2 gap-2">
                                <ShoppingBag size={14} className="text-muted-foreground" />
                                <span>Accept Missions</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onTabChange("earnings")} className="rounded-xl font-bold text-xs py-2 gap-2">
                                <Wallet size={14} className="text-muted-foreground" />
                                <span>Earnings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onTabChange("settings")} className="rounded-xl font-bold text-xs py-2 gap-2">
                                <Settings size={14} className="text-muted-foreground" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={signOut} className="rounded-xl font-bold text-xs py-2 gap-2 text-red-600">
                                <LogOut size={14} />
                                <span>Sign Out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-[100dvh]">
                {/* Desktop Top Bar */}
                <header className="hidden lg:flex h-20 bg-white/80 backdrop-blur-md border-b border-black/[0.04] items-center justify-between px-8 sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        {/* Brand Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#E96F28] flex items-center justify-center text-white shadow-xl shadow-orange-600/20">
                                <span className="font-black text-xl">L</span>
                            </div>
                            <span className="font-black text-xl tracking-tight uppercase">Linkup<span className="text-[#E96F28]"> PARTNER</span></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationDropdown>
                            <button className="relative p-2.5 bg-white border border-black/[0.05] rounded-2xl text-muted-foreground hover:text-[#E96F28] hover:border-orange-100 hover:shadow-sm transition-all group">
                                <Bell size={18} strokeWidth={2.5} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E96F28] text-[8px] font-bold text-white shadow-lg border-2 border-white animate-in zoom-in duration-300">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                        </NotificationDropdown>

                        {/* Combined Logistics Header Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-3 p-1.5 pl-3.5 pr-2.5 rounded-2xl bg-white border border-black/[0.05] hover:border-orange-200/80 shadow-sm transition-all group outline-none cursor-pointer">
                                    <div className="text-right">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <span className={cn(
                                                "w-2 h-2 rounded-full",
                                                isOnline ? "bg-emerald-500 ring-2 ring-emerald-200 animate-pulse" : "bg-gray-300"
                                            )} />
                                            <p className="text-xs font-black text-foreground tracking-tight uppercase leading-tight group-hover:text-[#E96F28] transition-colors">
                                                {profile?.display_name || profile?.name || "Oga Rider"}
                                            </p>
                                        </div>
                                        <p className={cn(
                                            "text-[9px] font-bold uppercase tracking-widest leading-none mt-1",
                                            (kycStatus === 'verified' || kycStatus === 'approved')
                                                ? "text-[#E96F28]"
                                                : "text-muted-foreground"
                                        )}>
                                            {(kycStatus === 'verified' || kycStatus === 'approved') ? "Verified Partner" : "Partner"}
                                        </p>
                                    </div>

                                    <Avatar className="h-9 w-9 border border-black/[0.06] shadow-sm group-hover:scale-105 transition-transform">
                                        <AvatarImage src={profile?.avatar_url || ""} />
                                        <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-bold text-xs">
                                            {(profile?.display_name || profile?.name || "U").charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <ChevronDown size={15} className="text-muted-foreground group-hover:text-foreground transition-transform" />
                                </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="end" className="w-80 p-3 rounded-3xl bg-white border border-black/[0.06] shadow-2xl space-y-3 z-50">
                                {/* Rider Card Header */}
                                <div className="p-3 rounded-2xl bg-gray-50/80 border border-black/[0.02] flex items-center gap-3">
                                    <div
                                        className="relative group cursor-pointer"
                                        onClick={() => setIsEditProfileOpen(true)}
                                        title="Click to update profile photo"
                                    >
                                        <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-sm transition-transform group-hover:scale-105">
                                            <AvatarImage src={profile?.avatar_url || ""} />
                                            <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-black text-sm">
                                                {(profile?.display_name || profile?.name || "U").charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Camera size={14} className="text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-foreground tracking-tight truncate uppercase">
                                            {profile?.display_name || profile?.name || "Oga Rider"}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate">{user?.email || "Rider Partner"}</p>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditProfileOpen(true)}
                                            className="text-[10px] font-bold text-[#E96F28] hover:underline flex items-center gap-1 mt-0.5"
                                        >
                                            <Camera size={11} />
                                            <span>Upload profile photo</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Section 1: Availability Switch */}
                                <div className={cn(
                                    "p-3.5 rounded-2xl border transition-all flex items-center justify-between",
                                    isOnline
                                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                                        : "bg-gray-50 border-gray-200 text-gray-700"
                                )}>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest block">Availability</span>
                                        <span className={cn("text-[9px] font-bold block", isOnline ? "text-emerald-700" : "text-muted-foreground")}>
                                            {isOnline ? "Receiving Missions (Online)" : "Off Duty (Offline)"}
                                        </span>
                                    </div>
                                    <Switch
                                        checked={isOnline}
                                        onCheckedChange={onOnlineToggle}
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                </div>

                                {/* Section 2: Wallet Balances */}
                                <div className="space-y-2">
                                    <div className="p-3 rounded-2xl bg-gray-50/80 border border-black/[0.03] flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Available Balance</span>
                                            <span className="text-base font-black text-foreground">₦ {balance.toLocaleString()}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onTabChange("earnings")}
                                            className="h-7 px-2.5 rounded-xl text-[10px] font-bold text-[#E96F28] hover:bg-orange-50"
                                        >
                                            View
                                        </Button>
                                    </div>

                                    {escrow_balance > 0 && (
                                        <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 block">Security Hold</span>
                                                <span className="text-sm font-black text-amber-900">₦ {escrow_balance.toLocaleString()}</span>
                                            </div>
                                            <Lock size={14} className="text-amber-600" />
                                        </div>
                                    )}
                                </div>

                                <DropdownMenuSeparator />

                                {/* Section 3: Navigation Links */}
                                <div className="space-y-0.5">
                                    <DropdownMenuItem
                                        onClick={() => onTabChange("dashboard")}
                                        className="rounded-xl font-bold text-xs cursor-pointer py-2 gap-2.5"
                                    >
                                        <LayoutDashboard size={15} className="text-muted-foreground" />
                                        <span>My Home</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={() => onTabChange("orders")}
                                        className="rounded-xl font-bold text-xs cursor-pointer py-2 gap-2.5"
                                    >
                                        <ShoppingBag size={15} className="text-muted-foreground" />
                                        <span>Accept Missions</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={() => onTabChange("earnings")}
                                        className="rounded-xl font-bold text-xs cursor-pointer py-2 gap-2.5"
                                    >
                                        <Wallet size={15} className="text-muted-foreground" />
                                        <span>Wallet & Earnings</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={() => onTabChange("verification")}
                                        className="rounded-xl font-bold text-xs cursor-pointer py-2 gap-2.5"
                                    >
                                        <ShieldCheck size={15} className="text-muted-foreground" />
                                        <span>ID Verification</span>
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        onClick={() => onTabChange("settings")}
                                        className="rounded-xl font-bold text-xs cursor-pointer py-2 gap-2.5"
                                    >
                                        <Settings size={15} className="text-muted-foreground" />
                                        <span>My Profile Settings</span>
                                    </DropdownMenuItem>
                                </div>

                                <DropdownMenuSeparator />

                                {/* Section 4: Sign Out */}
                                <DropdownMenuItem
                                    onClick={signOut}
                                    className="rounded-xl font-bold text-xs cursor-pointer py-2 gap-2.5 text-red-600 focus:text-red-700 focus:bg-red-50"
                                >
                                    <LogOut size={15} />
                                    <span>Sign Out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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

            {/* Profile & Photo Modal */}
            <EditProfileModal open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen} />
        </div>
    );
}
