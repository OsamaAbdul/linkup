import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/shared/components/ui/card";
import { ShieldCheck, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/context/AuthContext";
import { QRCodeSVG } from "qrcode.react";

type AuthStep = 'PASSWORD' | 'ENROLL_MFA' | 'VERIFY_MFA';

export default function AdminAuth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [authStep, setAuthStep] = useState<AuthStep>('PASSWORD');
    const [factorId, setFactorId] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation() as any;
    const { user, roles, loading } = useAuth();
    
    const isAdmin = roles.includes("admin");
    const from = location.state?.from?.pathname || "/admin";

    // Handle standard login and MFA check
    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoggingIn(true);

        try {
            const { data: { user, session }, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (user) {
                // Verify admin status immediately via database
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

                // Check MFA Status
                const { data: mfaFactors, error: mfaError } = await supabase.auth.mfa.listFactors();
                if (mfaError) throw mfaError;

                const totpFactors = mfaFactors.totp || [];
                const verifiedFactors = totpFactors.filter(f => (f.status as string) === 'verified');
                const unverifiedFactors = totpFactors.filter(f => (f.status as string) === 'unverified');

                if (verifiedFactors.length === 0) {
                    // Clean up any abandoned unverified enrollments before creating a new one
                    for (const uf of unverifiedFactors) {
                        await supabase.auth.mfa.unenroll({ factorId: uf.id });
                    }

                    // Start MFA Enrollment
                    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
                        factorType: 'totp',
                        issuer: 'Linkup Marketplace',
                        friendlyName: `Admin Authenticator - ${new Date().getTime()}`
                    });

                    if (enrollError) throw enrollError;
                    
                    setFactorId(enrollData.id);
                    // Use the URI instead of the raw SVG string so qrcode.react can generate a clean code
                    setQrCodeUrl(enrollData.totp.uri);
                    setAuthStep('ENROLL_MFA');
                    toast.info("Please set up your Authenticator app.");
                } else {
                    // Start MFA Verification
                    const activeFactor = verifiedFactors[0]; // Usually just one factor
                    const { error: challengeError } = await supabase.auth.mfa.challenge({ factorId: activeFactor.id });
                    if (challengeError) throw challengeError;

                    setFactorId(activeFactor.id);
                    setAuthStep('VERIFY_MFA');
                }
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to authenticate as admin.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    // Handle TOTP Code Verification (For both Enrollment and Standard Login)
    const handleVerifyMfa = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!factorId) return;
        setIsLoggingIn(true);

        try {
            const challenge = await supabase.auth.mfa.challenge({ factorId });
            if (challenge.error) throw challenge.error;

            const verifyResult = await supabase.auth.mfa.verify({
                factorId,
                challengeId: challenge.data.id,
                code: mfaCode,
            });

            if (verifyResult.error) throw verifyResult.error;

            toast.success("Admin access granted.");
            navigate(from, { replace: true });
            
        } catch (error: any) {
            toast.error(error.message || "Invalid authentication code.");
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
                        {authStep === 'PASSWORD' ? <ShieldCheck className="text-primary w-6 h-6" /> : <QrCode className="text-primary w-6 h-6" />}
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-white font-serif">Linkup Terminal</CardTitle>
                    <CardDescription className="text-slate-400">
                        {authStep === 'PASSWORD' ? "Restricted Access • Authorized Personnel Only" : "Two-Factor Authentication Required"}
                    </CardDescription>
                </CardHeader>
                
                {authStep === 'PASSWORD' && (
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
                )}

                {(authStep === 'ENROLL_MFA' || authStep === 'VERIFY_MFA') && (
                    <form onSubmit={handleVerifyMfa}>
                        <CardContent className="space-y-6 flex flex-col items-center">
                            {authStep === 'ENROLL_MFA' && qrCodeUrl && (
                                <div className="space-y-4 text-center w-full">
                                    <p className="text-sm text-slate-400">Scan this code with Google Authenticator or Authy to set up MFA.</p>
                                    <div className="bg-white p-4 rounded-xl inline-block">
                                        <QRCodeSVG value={qrCodeUrl} size={200} level="M" includeMargin={true} />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 w-full">
                                <Label htmlFor="mfaCode" className="text-slate-300">Enter 6-Digit Authenticator Code</Label>
                                <Input
                                    id="mfaCode"
                                    type="text"
                                    placeholder="000000"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                                    maxLength={6}
                                    required
                                    className="bg-slate-800 border-slate-700 text-white text-center tracking-widest text-lg font-mono focus:ring-primary"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="pt-4 flex-col gap-3">
                            <Button
                                type="submit"
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 group relative overflow-hidden"
                                disabled={isLoggingIn || mfaCode.length !== 6}
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "VERIFY CODE"}
                                </span>
                            </Button>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                className="w-full text-slate-400 hover:text-white"
                                onClick={() => {
                                    setAuthStep('PASSWORD');
                                    supabase.auth.signOut();
                                }}
                            >
                                Cancel & Return
                            </Button>
                        </CardFooter>
                    </form>
                )}
            </Card>

            <div className="fixed bottom-6 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-mono">
                Encrypted Endpoint Revision 4.0.2 // Linkup Logistics Corp. // MFA Enforced
            </div>
        </div>
    );
}
