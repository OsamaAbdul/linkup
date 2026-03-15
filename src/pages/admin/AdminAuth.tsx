import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminAuth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const navigate = useNavigate();
    const location = useLocation() as any;

    // getting users roles, user, loading and refreshProfile

    const { user, roles, loading, refreshProfile } = useAuth();

    console.log("user, roles and loading state:", { user, roles, loading });
    const isAdmin = roles.includes("admin");

    // redirecting the user t
    const from = location.state?.from?.pathname || "/admin";

    useEffect(() => {
        if (!loading && user && isAdmin) {
            navigate("/admin", { replace: true });
        }
    }, [user, isAdmin, loading, navigate]);

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);

        try {
            const { data: { user }, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (user) {
                // Fetch roles to verify admin status immediately
                const { data: rolesData, error: rolesError } = await (supabase as any)
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", user.id)
                    .eq("role", "admin")
                    .single();

                if (rolesError || !rolesData) {
                    await supabase.auth.signOut();
                    throw new Error("Access denied. Admin privileges required.");
                }

                toast.success("Admin access granted.");

                navigate(from, { replace: true });
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to authenticate as admin.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

            <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 shadow-2xl relative z-10">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2 border border-primary/20">
                        <ShieldCheck className="text-primary w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-white font-serif">Linkup Terminal</CardTitle>
                    <CardDescription className="text-slate-400">Restricted Access • Authorized Personnel Only</CardDescription>
                </CardHeader>
                <form onSubmit={handleAdminLogin}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-300">Administrative Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@linkup.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" text-slate-300>Security Key</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-slate-800 border-slate-700 text-white focus:ring-primary"
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="pt-4">
                        <Button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 group relative overflow-hidden"
                            disabled={isLoggingIn}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "INITIATE SESSION"}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <div className="fixed bottom-6 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-mono">
                Encrypted Endpoint Revision 4.0.2 // Linkup Logistics Corp.
            </div>
        </div>
    );
}
