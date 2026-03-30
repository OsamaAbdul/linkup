import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Profile Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>User ID:</strong> {user?.id}</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
