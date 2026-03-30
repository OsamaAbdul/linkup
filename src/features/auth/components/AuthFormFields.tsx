import React, { useState } from "react";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

interface AuthFormFieldsProps {
  isLogin: boolean;
  isForgotPassword?: boolean;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
}

export const AuthFormFields = ({
  isLogin,
  isForgotPassword = false,
  email,
  setEmail,
  password,
  setPassword,
  displayName,
  setDisplayName,
}: AuthFormFieldsProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const fieldClass =
    "pl-10 h-12 bg-secondary/50 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-xl text-foreground placeholder:text-muted-foreground/60";

  return (
    <m.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence mode="wait">
        {!isLogin && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            key="name-field"
            className="space-y-1.5"
          >
            <Label htmlFor="displayName" className="text-sm font-medium text-foreground/80 ml-0.5">
              Full Name
            </Label>
            <div className="relative">
              <User size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="displayName"
                type="text"
                placeholder="Your full name"
                className={fieldClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-foreground/80 ml-0.5">
          Email
        </Label>
        <div className="relative">
          <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isForgotPassword && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            key="password-field"
            className="space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80 ml-0.5">
                Password
              </Label>
            </div>
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
            {!isLogin && (
              <p className="text-[11px] text-muted-foreground/60 ml-0.5">
                Must be at least 6 characters
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
};
