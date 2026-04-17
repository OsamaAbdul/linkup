import { ReactNode } from "react";
import {
    LayoutDashboard,
    ShoppingBag,
    Wallet,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import logo from '@/assets/logo.png'
import { RoleSwitcher } from "@/shared/components/layout/RoleSwitcher";
import { Switch } from "@/shared/components/ui/switch";

interface LogisticsSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    isOpen?: boolean;
    setIsOpen?: (open: boolean) => void;
    kycStatus?: string;
    isOnline: boolean;
    onOnlineToggle: (checked: boolean) => void;
}

export function LogisticsSidebar({
    activeTab,
    setActiveTab,
    isCollapsed,
    setIsCollapsed,
    isOpen,
    setIsOpen,
    kycStatus = "none",
    isOnline,
    onOnlineToggle
}: LogisticsSidebarProps) {
    const { signOut } = useAuth();

    const tabs = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "orders", label: "Deliveries", icon: ShoppingBag },
        { id: "earnings", label: "Earnings", icon: Wallet },
        { id: "verification", label: "ID Verification", icon: ShieldCheck },
        { id: "settings", label: "Settings", icon: Settings },
    ];


    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        if (setIsOpen) setIsOpen(false); // Close mobile menu on click
    };

    return (
        <AnimatePresence>
            {(isOpen || !isOpen) && ( // Workaround for framer-motion visibility logic
                <motion.aside
                    initial={false}
                    animate={{
                        width: isCollapsed ? 80 : 280,
                        x: isOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? -280 : 0)
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 40, mass: 1 }}
                    className={cn(
                        "fixed left-0 top-0 h-screen bg-white border-r border-black/[0.05] z-50 flex flex-col",
                        "lg:flex",
                        isOpen ? "flex shadow-2xl" : "hidden lg:flex"
                    )}
                >
                    {/* Collapse Toggle (Desktop only) */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="absolute -right-3 top-10 w-6 h-6 rounded-full bg-white border border-black/[0.1] flex items-center justify-center hover:bg-gray-50 transition-colors z-[60] shadow-sm hidden lg:flex"
                    >
                        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                    </button>

                    {/* Logo & Close Section */}
                    <div className="p-4 lg:p-6 pb-2 mt-4 lg:mt-0 flex items-center justify-between">
                        <div className="flex items-center gap-2 lg:gap-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-white shrink-0">
                                <img src={logo} alt="logo" className="w-16 h-16 lg:w-20 lg:h-20" />
                            </div>
                            {(!isCollapsed || isOpen) && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-black text-lg lg:text-xl tracking-tight"
                                >
                                    LINKUP<span className="text-blue-600"> AGENTS</span>
                                </motion.span>
                            )}
                        </div>
                        {isOpen && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen?.(false)}
                                className="lg:hidden rounded-xl w-8 h-8"
                            >
                                <X size={18} />
                            </Button>
                        )}
                    </div>

                    {/* Mobile Only: Role Switcher & Status Toggle */}
                    {isOpen && (
                        <div className="px-4 py-3 lg:hidden bg-blue-50/30 border-y border-blue-100/50 space-y-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest pl-1">Switch Role</label>
                                <RoleSwitcher />
                            </div>
                            <div className="flex items-center justify-between bg-white/50 p-2.5 rounded-xl border border-blue-200/50">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider">Availability</span>
                                    <span className={cn(
                                        "text-[11px] font-black uppercase",
                                        isOnline ? "text-green-600" : "text-gray-400"
                                    )}>
                                        {isOnline ? "Online" : "Offline"}
                                    </span>
                                </div>
                                <Switch
                                    checked={isOnline}
                                    onCheckedChange={onOnlineToggle}
                                    className="data-[state=checked]:bg-green-600 scale-[0.8]"
                                />
                            </div>
                        </div>
                    )}



                    {/* Navigation Section */}
                    <nav className="flex-1 px-3 lg:px-4 mt-4 lg:mt-8 space-y-1 overflow-y-auto no-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group/nav",
                                    activeTab === tab.id
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                        : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
                                )}
                            >
                                <tab.icon
                                    size={20}
                                    strokeWidth={activeTab === tab.id ? 2.5 : 2}
                                    className={cn(
                                        "shrink-0 transition-transform group-hover/nav:scale-110",
                                        activeTab === tab.id ? "text-white" : "text-muted-foreground group-hover/nav:text-blue-600"
                                    )}
                                />
                                {(!isCollapsed || isOpen) && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="font-bold text-[13px] tracking-tight"
                                    >
                                        {tab.label}
                                    </motion.span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Bottom Section */}
                    <div className="p-4 mt-auto border-t border-black/[0.05] space-y-2">
                        <Button
                            variant="ghost"
                            onClick={signOut}
                            className={cn(
                                "w-full justify-start gap-3 rounded-xl h-12 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all font-bold",
                                isCollapsed && !isOpen && "px-0 justify-center"
                            )}
                        >
                            <LogOut size={20} className="shrink-0" />
                            {(!isCollapsed || isOpen) && <span>Sign Out</span>}
                        </Button>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}

