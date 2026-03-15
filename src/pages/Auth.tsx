import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { m } from "framer-motion";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFormFields } from "@/components/auth/AuthFormFields";
import { SocialAuth } from "@/components/auth/SocialAuth";
import { AuthSidebar } from "@/components/auth/AuthSidebar";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const currentUser = (await supabase.auth.getUser()).data.user;
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser?.id as string);

        const userRoles = (rolesData?.map((r) => r.role) || []) as string[];

        const { data: profileData } = await (supabase as any)
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", currentUser?.id)
          .single();

        toast.success("Welcome back!");

        if (!profileData?.onboarding_completed) {
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
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(String(error));
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
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              displayName={displayName}
              setDisplayName={setDisplayName}
            />

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
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <SocialAuth onGoogleLogin={handleGoogleLogin} />

          <p className="text-center text-sm text-muted-foreground mt-8">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              className="ml-1 font-semibold text-primary hover:text-primary/80 transition-colors"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </m.div>
      </div>

      {/* Branding side */}
      <AuthSidebar />
    </div>
  );
}
