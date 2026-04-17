import { AppLayout } from "@/shared/components/layout/AppLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loader2 } from "lucide-react";
import { ProfileForm } from "../components/ProfileForm";

export default function Profile() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase italic">My Registry</h1>
            <p className="text-muted-foreground mt-1 font-semibold text-sm uppercase opacity-60">Manage your Linkup Identity</p>
          </div>
        </header>

        <ProfileForm />
      </div>
    </AppLayout>
  );
}
