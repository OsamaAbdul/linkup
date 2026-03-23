import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loader2 } from "lucide-react";

export function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user, roles, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const isAdmin = roles.includes("admin");

    if (!user || !isAdmin) {
        // Redirect to admin-specific login or home
        return <Navigate to="/admin-auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
