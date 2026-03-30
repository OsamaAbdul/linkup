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
          navigate("/logistics-dashboard");
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
