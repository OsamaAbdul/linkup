import { AppLayout } from "@/shared/components/layout/AppLayout";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loader2, ArrowLeft } from "lucide-react";
import { ProfileForm } from "../components/ProfileForm";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";

export default function Profile() {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 shrink-0 border-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground uppercase italic">My Registry</h1>
              <p className="text-muted-foreground mt-1 font-semibold text-sm uppercase opacity-60">Manage your Linkup Identity</p>
            </div>
          </div>
        </header>

        <ProfileForm />
      </div>
    </AppLayout>
  );
}
