import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { m } from "framer-motion";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthFormFields } from "@/features/auth/components/AuthFormFields";
import { AuthSidebar } from "@/features/auth/components/AuthSidebar";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        // First check if the email is registered in our profiles table
        const { data: profile, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.trim().toLowerCase())
          .maybeSingle();

        if (checkError) {
          console.error("Profile check error:", checkError);
          throw new Error("Unable to verify email at this time. Please try again later.");
        }

        if (!profile) {
          throw new Error("This email is not registered with us. Please check for typos or sign up instead.");
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for the reset link!");
        setIsForgotPassword(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // ... rest of redirection logic

        // The following fetches are for redirection logic. 
        // We wrap them so that if a request is aborted during navigation, it doesn't toast an error.
        let userRoles: string[] = [];
        let onboardingCompleted = true;

        try {
          const currentUser = (await supabase.auth.getUser()).data.user;
          const [rolesRes, profileRes] = await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", currentUser?.id as string),
            supabase.from("profiles").select("onboarding_completed").eq("id", currentUser?.id).single()
          ]);

          userRoles = (rolesRes.data?.map((r) => r.role) || []) as string[];
          onboardingCompleted = profileRes.data?.onboarding_completed ?? true;
        } catch (fetchErr) {
          console.warn("Post-login data fetch interrupted, proceeding with default navigation", fetchErr);
        }

        toast.success("Welcome back!");

        if (!onboardingCompleted) {
          navigate("/onboarding");
          return;
        }

        if (userRoles.includes("admin")) {
          navigate("/admin");
        } else if (userRoles.includes("logistics")) {
          navigate("/logistics");
        } else if (userRoles.includes("seller")) {
          navigate("/dashboard");
        } else {
          navigate("/");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;

        if (data.session) {
          toast.success("Account created!");
          navigate("/onboarding");
        } else {
          toast.success("Check your email to confirm your account!");
        }
      }
    } catch (err: any) {
      let message = err.message;
      if (message.includes("aborted") || message.includes("signal") || message.includes("timeout")) {
        message = "Connection timed out or was interrupted. Please check your internet and try again.";
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      {/* Form side */}
      <div className="flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          <AuthHeader isLogin={isLogin} />

          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthFormFields
              isLogin={isLogin}
              isForgotPassword={isForgotPassword}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              displayName={displayName}
              setDisplayName={setDisplayName}
            />

            {isLogin && !isForgotPassword && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-[15px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Processing…
                </span>
              ) : isForgotPassword ? (
                "Send Reset Link"
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {!isForgotPassword && (
            <div className="mt-8 space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60"></div>
                </div>
                <span className="relative bg-background px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none">
                  Or continue with
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 rounded-xl font-bold text-[13px] border-border/60 bg-card hover:bg-muted/50 transition-all gap-3 shadow-sm"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign in with Google
              </Button>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-8">
            {isForgotPassword ? (
              <button
                type="button"
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
                onClick={handleBackToLogin}
              >
                Back to sign in
              </button>
            ) : (
              <>
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  className="ml-1 font-semibold text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </>
            )}
          </p>
        </m.div>
      </div>

      {/* Branding side */}
      <AuthSidebar />
    </div>
  );
}
