import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

export function AppLayout({ children, hideBottomNav = false }: { children: ReactNode, hideBottomNav?: boolean }) {
  const { user, profile, roles, activeRole, loading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!loading && user && activeRole) {
      const path = window.location.pathname;
      const isOnboardingPath = ["/onboarding", "/seller-verification", "/auth"].includes(path);
      
      if (isOnboardingPath) return;

      // Ensure user is on the correct dashboard for their active role
      // This is a soft enforcement to help the user stay in context
      if (activeRole === "seller" && path === "/") {
        navigate("/dashboard");
      } else if (activeRole === "logistics" && path === "/") {
        navigate("/logistics-dashboard");
      } else if (activeRole === "promoter" && path === "/") {
        navigate("/promoter-dashboard");
      } else if (activeRole === "admin" && !path.startsWith("/admin")) {
        navigate("/admin");
      }
    }
  }, [user, activeRole, loading, navigate]);

  const isSellerView = activeRole === "seller";

  return (
    <div className="min-h-screen bg-surface">
      <div className="md:flex max-w-[1700px] mx-auto p-0 sm:p-4 gap-0 sm:gap-4">
        {!isSellerView && <Sidebar />}
        <main className={cn(
          "flex-1 min-w-0 min-h-screen sm:min-h-[calc(100vh-2rem)]",
          isSellerView ? "bg-surface border-none shadow-none" : "bg-background sm:rounded-xl border-x sm:border shadow-sm",
          !hideBottomNav ? "pb-24 sm:pb-0" : ""
        )}>
          {!isSellerView && <Header />}
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
      {!isSellerView && !hideBottomNav && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  );
}

