import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Navigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Store, Settings } from "lucide-react";

export default function Profile() {
  const { user, profile, signOut, refreshProfile, loading } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "" });

  /* Hooks must be called unconditionally */
  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data?.map((r) => r.role) ?? [];
    },
    enabled: !!user,
  });

  const { data: myProducts = [] } = useQuery({
    queryKey: ["my-products", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("products").select("id, title, price, images").eq("seller_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("profiles").update({
        display_name: form.display_name,
        bio: form.bio,
      }).eq("id", user.id);
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      setEditing(false);
      refreshProfile();
    },
  });

  const startEdit = () => {
    setForm({ display_name: profile?.display_name ?? "", bio: profile?.bio ?? "" });
    setEditing(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {(profile?.display_name ?? "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-lg font-bold">{profile?.display_name ?? "User"}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {profile?.bio && <p className="text-sm mt-1">{profile.bio}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {editing ? (
          <Card>
            <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => updateProfile.mutate()}>Save</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={startEdit}>
              <Settings size={18} className="mr-2" /> Edit Profile
            </Button>
            {roles.includes("seller") && (
              <Link to="/dashboard">
                <Button variant="outline" className="w-full justify-start">
                  <Store size={18} className="mr-2" /> Seller Dashboard
                </Button>
              </Link>
            )}
            <Button variant="outline" className="w-full justify-start text-destructive" onClick={signOut}>
              <LogOut size={18} className="mr-2" /> Sign Out
            </Button>
          </div>
        )}

        {myProducts.length > 0 && (
          <Card>
            <CardHeader><CardTitle>My Products</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myProducts.map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                    <div className="w-12 h-12 rounded-md bg-muted overflow-hidden">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-sm text-primary font-bold">₦{p.price.toLocaleString()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
