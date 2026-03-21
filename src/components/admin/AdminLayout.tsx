import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
    LayoutDashboard, Users, ShoppingBag, AlertTriangle,
    History, LogOut, ShieldCheck, Bell, Menu, FileCheck, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import Logo from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminLayoutProps {
    children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const { data: openIssuesCount } = useQuery({
        queryKey: ["admin-sidebar-issues-count"],
        queryFn: async () => {
            const { count, error } = await (supabase as any)
                .from("issues")
                .select("*", { count: 'exact', head: true })
                .eq("status", "open");
            if (error) throw error;
            return count || 0;
        }
    });

    const navItems = [
        { icon: LayoutDashboard, label: "Overview", path: "/admin" },
        { icon: ShoppingBag, label: "Orders", path: "/admin/orders" },
        { icon: Users, label: "Users", path: "/admin/users" },
        { icon: FileCheck, label: "KYC Verifications", path: "/admin/kyc" },
        { icon: AlertTriangle, label: "Issues", path: "/admin/issues" },
        { icon: CreditCard, label: "Payments", path: "/admin/payments" },
        { icon: History, label: "System History", path: "/admin/history" },
    ];

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white">
            <div className="p-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-foreground tracking-tight leading-none">ADMIN</h1>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Command Center</span>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1 px-4">
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group text-sm font-bold",
                                    isActive
                                        ? "bg-primary text-white shadow-xl shadow-primary/20"
                                        : "text-muted-foreground hover:bg-gray-50 hover:text-foreground"
                                )}
                            >
                                <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                                {item.label}
                                {item.label === "Issues" && openIssuesCount > 0 && (
                                    <Badge className="ml-auto bg-white/20 text-white border-none text-[10px] rounded-full h-5 min-w-5 flex items-center justify-center font-black">
                                        {openIssuesCount}
                                    </Badge>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </ScrollArea>

            <div className="p-6 border-t mt-auto">
                <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all font-bold"
                    onClick={async () => {
                        await signOut();
                        navigate("/admin-auth");
                    }}
                >
                    <LogOut size={18} />
                    Log Out
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F4F7FE] flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-gray-200 sticky top-0 h-screen">
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-4 flex-1">
                        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden rounded-xl">
                                    <Menu size={24} />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 w-72 border-none">
                                <SidebarContent />
                            </SheetContent>
                        </Sheet>


                        {/* Mobile Brand Label */}
                        <div className="lg:hidden">
                            <span className="text-xs font-black tracking-widest text-primary uppercase">Console</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="rounded-xl bg-gray-100/50 relative">
                            <Bell size={20} />
                            {openIssuesCount > 0 && (
                                <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
                                    {openIssuesCount}
                                </span>
                            )}
                        </Button>
                        <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-primary border border-gray-200 overflow-hidden">
                            <img src={Logo} alt="Admin" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

