import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export function AppLayout({ children, hideBottomNav = false }: { children: ReactNode, hideBottomNav?: boolean }) {
  const { user, profile, roles, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) {
      const isAdmin = roles.includes("admin");
      const isLogistics = roles.includes("logistics");
      const isSeller = roles.includes("seller");
      const path = window.location.pathname;

      if (isAdmin && !path.startsWith("/admin")) {
        navigate("/admin");
      } else if (isLogistics && path !== "/logistics-dashboard") {
        navigate("/logistics-dashboard");
      } else if (isSeller && path !== "/dashboard" && path !== "/onboarding" && path !== "/seller-verification") {
        navigate("/dashboard");
      }
    }
  }, [user, roles, loading, navigate]);

  const isSeller = roles.includes("seller");

  return (
    <div className="min-h-screen bg-surface">
      <div className="md:flex max-w-[1700px] mx-auto p-4 gap-4">
        {!isSeller && <Sidebar />}
        <main className={cn(
          "flex-1 min-w-0 min-h-[calc(100vh-2rem)] rounded-2xl border shadow-sm overflow-hidden",
          !hideBottomNav ? "pb-20 md:pb-0" : "",
          isSeller ? "bg-surface border-none shadow-none" : "bg-background"
        )}>
          {!isSeller && <Header />}
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
      {!isSeller && !hideBottomNav && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}
