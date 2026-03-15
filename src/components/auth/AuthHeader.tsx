import { m } from "framer-motion";

interface AuthHeaderProps {
  isLogin: boolean;
}

export const AuthHeader = ({ isLogin }: AuthHeaderProps) => {
  return (
    <div className="w-full mb-8">
      <m.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center"
      >
        <div className="mb-6 relative">
          <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-xl" />
          <div className="relative rounded-2xl border border-border/60 bg-card p-1.5 shadow-lg shadow-primary/5">
            <img
              src="/src/assets/logo.jpeg"
              alt="Linkup Logo"
              className="h-16 w-16 rounded-xl object-cover"
            />
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isLogin
            ? "Sign in to continue to Linkup"
            : "Join Linkup and start exploring"}
        </p>
      </m.div>
    </div>
  );
};
