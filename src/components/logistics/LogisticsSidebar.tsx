import { useState, useRef } from "react";
import { 
    LayoutDashboard, 
    ShoppingBag, 
    Wallet, 
    Settings, 
    LogOut, 
    ChevronLeft, 
    ChevronRight,
    Camera,
    Loader2,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

interface LogisticsSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    isOpen?: boolean;
    setIsOpen?: (open: boolean) => void;
}

export function LogisticsSidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, isOpen, setIsOpen }: LogisticsSidebarProps) {
    const { user, profile, refreshProfile, signOut } = useAuth();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const tabs = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "orders", label: "Orders", icon: ShoppingBag },
        { id: "earnings", label: "Earnings", icon: Wallet },
        { id: "settings", label: "Settings", icon: Settings },
    ];

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
            // Force a small delay to ensure storage propagates if needed
            setTimeout(refreshProfile, 1000);
            
            toast.success("Profile picture updated successfully");
        } catch (error: any) {
            toast.error("Error uploading avatar", { description: error.message });
        } finally {
            setUploading(false);
        }
    };

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
                    className={cn(
                        "fixed left-0 top-0 h-screen bg-white border-r border-black/[0.05] z-50 flex flex-col transition-all duration-300 ease-in-out",
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

                    {/* Logo Section */}
                    <div className="p-6 pb-2 mt-4 lg:mt-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-600/20">
                                <span className="font-black text-xl">L</span>
                            </div>
                            {(!isCollapsed || isOpen) && (
                                <motion.span 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="font-black text-xl tracking-tight"
                                >
                                    LINKUP<span className="text-blue-600">.AGENTS</span>
                                </motion.span>
                            )}
                        </div>
                    </div>

                    {/* Profile Section */}
                    <div className={cn(
                        "p-6 flex flex-col items-center gap-4 transition-all duration-300",
                        isCollapsed && !isOpen ? "mt-4" : "mt-8"
                    )}>
                        <div className="relative group/avatar">
                            <Avatar className={cn(
                                "transition-all duration-300 border-2 border-white shadow-xl ring-1 ring-black/[0.05]",
                                isCollapsed && !isOpen ? "w-10 h-10" : "w-24 h-24"
                            )}>
                                <AvatarImage src={profile?.avatar_url || ""} className="object-cover" key={profile?.avatar_url} />
                                <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-xl">
                                    {profile?.display_name?.charAt(0) || user?.email?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className={cn(
                                    "absolute bottom-0 right-0 p-1.5 rounded-full bg-blue-600 text-white shadow-lg border-2 border-white transition-all transform scale-100 lg:scale-0 lg:group-hover/avatar:scale-100",
                                    uploading && "scale-100 bg-gray-400 rotate-animation"
                                )}
                            >
                                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {(!isCollapsed || isOpen) && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center space-y-1"
                            >
                                <div className="flex items-center justify-center gap-1.5">
                                    <h3 className="font-black text-foreground tracking-tight line-clamp-1">{profile?.display_name || "Logistics Agent"}</h3>
                                    <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/10" />
                                </div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Verified Partner</p>
                            </motion.div>
                        )}
                    </div>

                    {/* Navigation Section */}
                    <nav className="flex-1 px-4 mt-8 space-y-1.5 overflow-y-auto no-scrollbar">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group/nav",
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
                                "w-full justify-start gap-3 rounded-2xl h-12 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all font-bold",
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
