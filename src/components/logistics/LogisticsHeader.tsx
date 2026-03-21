import { Button } from "@/components/ui/button";
import { LayoutDashboard, ShoppingBag, Wallet, Settings, Bell, LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface LogisticsHeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    balance: number;
    isOnline: boolean;
    isMobileMenuOpen?: boolean;
    onMenuToggle?: () => void;
    kycStatus?: string;
}

export function LogisticsHeader({ 
    activeTab, 
    setActiveTab, 
    balance, 
    isOnline,
    isMobileMenuOpen,
    onMenuToggle,
    kycStatus
}: LogisticsHeaderProps) {
    const { user, signOut } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        try {
            await signOut();
            toast.success("Signed out successfully");
            navigate("/auth");
        } catch (error: any) {
            toast.error("Error signing out", { description: error.message });
        }
    };

    const toggleOnlineStatus = async (checked: boolean) => {
        try {
            const { error } = await (supabase as any)
                .from("profiles")
                .update({ is_online: checked })
                .eq("user_id", user?.id);

            if (error) throw error;

            await queryClient.invalidateQueries({ queryKey: ["logistics-details", user?.id] });

            toast.success(checked ? "You are now ONLINE" : "You are now OFFLINE", {
                description: checked ? "Sellers can now assign you orders." : "You won't receive new assignment alerts.",
            });
        } catch (error: any) {
            toast.error("Failed to update status", {
                description: error.message,
            });
        }
    };

    return (
        <header className="bg-white border-b border-black/[0.05] sticky top-0 z-[40]">
            <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="lg:hidden rounded-xl bg-gray-50 hover:bg-gray-100"
                        onClick={onMenuToggle}
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </Button>
                    
                    <div className="w-10 h-10 rounded-xl bg-blue-600 lg:hidden flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-600/20">
                        <span className="font-black text-xl">L</span>
                    </div>
                    <span className="font-black text-xl tracking-tight hidden md:block uppercase tracking-[-0.04em]">
                        {activeTab === "verification" ? "Verification" : "Linkup"}
                        <span className="text-blue-600">.</span>
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-black/[0.05] shadow-sm transition-all hover:border-black/[0.1] group/stats">
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest group-hover/stats:text-blue-600 transition-colors">Network Status</span>
                            <span className={cn(
                                "text-[11px] font-black uppercase tracking-tight",
                                isOnline ? "text-green-600" : "text-gray-400"
                            )}>
                                {isOnline ? "Active" : "Standby"}
                            </span>
                        </div>
                        <Switch
                            checked={isOnline}
                            onCheckedChange={toggleOnlineStatus}
                            className="data-[state=checked]:bg-green-600"
                        />
                    </div>

                    {kycStatus === 'verified' && (
                        <div className="hidden lg:flex items-center gap-2 bg-blue-50/50 px-3 py-1.5 rounded-xl border border-blue-500/10">
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                <ShieldCheck size={12} strokeWidth={3} />
                            </div>
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Verified</span>
                        </div>
                    )}

                    <div className="bg-[#F0F2F5]/50 px-4 py-2.5 rounded-xl flex flex-col items-end border border-transparent hover:border-black/5 transition-all">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Balance</span>
                        <span className="text-sm font-black text-foreground">‚¦ {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="rounded-xl relative bg-gray-50/50 hover:bg-gray-100 transition-all border border-transparent hover:border-black/5">
                            <Bell size={18} className="text-foreground" />
                            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full border-2 border-white" />
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}


