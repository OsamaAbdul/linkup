import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { LayoutDashboard, ShoppingBag, Wallet, Settings, Bell, LogOut, Menu, X, ShieldCheck, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/shared/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RoleSwitcher } from "@/shared/components/layout/RoleSwitcher";
import { useState, useRef } from "react";

interface LogisticsHeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    balance: number;
    isOnline: boolean;
    isMobileMenuOpen?: boolean;
    onMenuToggle?: () => void;
    onOnlineToggle: (checked: boolean) => void;
    kycStatus?: string;
}

export function LogisticsHeader({
    activeTab,
    setActiveTab,
    balance,
    isOnline,
    isMobileMenuOpen,
    onMenuToggle,
    onOnlineToggle,
    kycStatus
}: LogisticsHeaderProps) {
    const { user, profile, refreshProfile, signOut } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error("You must select an image to upload.");
            }

            const file = event.target.files[0];
            const fileExt = file.name.split(".").pop();
            const filePath = `${user?.id}/avatar_${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from("avatars")
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from("profiles")
                .update({ avatar_url: publicUrl })
                .eq("user_id", user?.id);

            if (updateError) throw updateError;

            await refreshProfile();
            setTimeout(refreshProfile, 1000);

            toast.success("Profile picture updated successfully");
        } catch (error: any) {
            toast.error("Error uploading avatar", { description: error.message });
        } finally {
            setUploading(false);
        }
    };


    return (
        <header className="bg-white border-b border-black/[0.05] sticky top-0 z-[40]">
            <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden rounded-xl bg-gray-50 hover:bg-gray-100 h-9 w-9"
                        onClick={onMenuToggle}
                    >
                        {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </Button>

                    <div className="w-10 h-10 rounded-xl bg-blue-600 lg:hidden flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-600/20">
                        <span className="font-black text-xl">L</span>
                    </div>
                    <span className="font-black text-xl tracking-tight hidden md:block uppercase tracking-[-0.04em]">
                        {activeTab === "verification" ? "Verification" : "Linkup"}
                        <span className="text-blue-600">.</span>
                    </span>
                    <div className="hidden lg:block ml-2">
                        <RoleSwitcher />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-black/[0.05] shadow-sm transition-all hover:border-black/[0.1] group/stats">
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest group-hover/stats:text-blue-600 transition-colors">Agent Status</span>
                            <span className={cn(
                                "text-[11px] font-black uppercase tracking-tight",
                                isOnline ? "text-green-600" : "text-gray-400"
                            )}>
                                {isOnline ? "Active" : "Offline"}
                            </span>
                        </div>
                        <Switch
                            checked={isOnline}
                            onCheckedChange={onOnlineToggle}
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
                        <span className="text-sm font-black text-foreground">₦ {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end mr-0.5 pointer-events-none">
                            <span className="text-[10px] font-black text-foreground tracking-tight capitalize line-clamp-1 max-w-[60px] sm:max-w-none">
                                {profile?.display_name || "Agent"}
                            </span>
                            {kycStatus === 'verified' && (
                                <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest leading-none">Verified</span>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-xl relative bg-gray-50/50 hover:bg-gray-100 transition-all border border-transparent hover:border-black/5">
                            <Bell size={18} className="text-foreground" />
                            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full border-2 border-white" />
                        </Button>

                        <div className="h-10 w-10 relative group cursor-pointer">
                            <Avatar className="w-10 h-10 rounded-xl border border-black/[0.05] shadow-sm group-hover:scale-105 transition-transform duration-200">
                                <AvatarImage src={profile?.avatar_url || ""} />
                                <AvatarFallback className="bg-blue-600/10 text-blue-600 text-[10px] font-black uppercase">
                                    {profile?.display_name?.charAt(0) || user?.email?.[0]}
                                </AvatarFallback>
                            </Avatar>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                                disabled={uploading}
                                className={cn(
                                    "absolute -bottom-1 -right-1 p-1 rounded-full bg-blue-600 text-white shadow-lg border-2 border-white transition-all transform scale-100 md:scale-0 md:group-hover:scale-100",
                                    uploading && "scale-100 bg-gray-400"
                                )}
                            >
                                {uploading ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}


