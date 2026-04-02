import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking session and profile
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If not logged in, redirect to auth (unless we are already at auth)
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If onboarding is required but not completed, redirect to onboarding
  if (requireOnboarding && profile && !profile.onboarding_completed) {
    // Only redirect if they are not already on the onboarding page
    if (location.pathname !== "/onboarding") {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
