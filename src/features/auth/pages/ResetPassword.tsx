import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { toast } from "sonner";
import { m } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import { AuthSidebar } from "@/features/auth/components/AuthSidebar";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Password updated successfully!");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "pl-10 h-12 bg-secondary/50 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-xl text-foreground placeholder:text-muted-foreground/60";

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background">
      <div className="flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">Create New Password</h1>
            <p className="text-muted-foreground text-sm">Please enter your new password below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="password" title="Password" className="text-sm font-medium text-foreground/80 ml-0.5">
                New Password
              </Label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`${fieldClass} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" title="Confirm Password" className="text-sm font-medium text-foreground/80 ml-0.5">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`${fieldClass} pr-11`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-[15px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
              disabled={loading}
            >
              {loading ? "Updating..." : "Reset Password"}
            </Button>
          </form>
        </m.div>
      </div>
      <AuthSidebar />
    </div>
  );
}
