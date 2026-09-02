import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user, roles, loading } = useAuth();
    const location = useLocation();
    const [aalVerified, setAalVerified] = useState<boolean | null>(null);

    useEffect(() => {
        const verifyAal = async () => {
            if (user) {
                const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                setAalVerified(data?.currentLevel === 'aal2');
            } else {
                setAalVerified(false);
            }
        };
        verifyAal();
    }, [user]);

    if (loading || roles.length === 0 || aalVerified === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const isAdmin = roles.includes("admin");

    if (!user || !isAdmin || !aalVerified) {
        // Redirect to admin-specific login if not admin or missing MFA
        return <Navigate to="/admin-auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
