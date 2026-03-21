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
import { LogOut, Store, Settings, ChevronRight } from "lucide-react";

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
      <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-w-2xl mx-auto">
        <Card className="rounded-xl border-black/[0.03] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl border-2 border-primary/5">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/5 text-primary text-xl font-black">
                  {(profile?.display_name ?? "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-foreground truncate">{profile?.display_name ?? "User"}</h2>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">{user.email}</p>
                {profile?.bio && <p className="text-xs mt-1 leading-relaxed opacity-80 line-clamp-2 italic">{profile.bio}</p>}
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
          <div className="space-y-2.5">
            <Button variant="outline" className="w-full justify-start h-11 rounded-xl border-black/5 text-[10px] sm:text-xs font-black uppercase tracking-widest gap-3 hover:bg-primary/5 hover:text-primary transition-all" onClick={startEdit}>
              <Settings size={16} className="text-primary/60" /> Edit Profile Details
            </Button>
            {roles.includes("seller") && (
              <Link to="/dashboard">
                <Button variant="outline" className="w-full justify-start h-11 rounded-xl border-black/5 text-[10px] sm:text-xs font-black uppercase tracking-widest gap-3 hover:bg-primary/5 hover:text-primary transition-all">
                  <Store size={16} className="text-primary/60" /> Seller Dashboard Hub
                </Button>
              </Link>
            )}
            <Button variant="outline" className="w-full justify-start h-11 rounded-xl border-black/5 text-[10px] sm:text-xs font-black uppercase tracking-widest gap-3 text-destructive hover:bg-destructive/5 hover:border-destructive/20 transition-all" onClick={signOut}>
              <LogOut size={16} /> Secure Termination (Sign Out)
            </Button>
          </div>
        )}

        {myProducts.length > 0 && (
          <Card className="rounded-xl border-black/[0.03] bg-white shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-0">
              <CardTitle className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">My Virtual Inventory</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-3">
              <div className="grid grid-cols-1 gap-2">
                {myProducts.map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all border border-black/[0.01] hover:border-black/5 group">
                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0 border border-black/5 shadow-sm group-hover:shadow-md transition-shadow">
                      {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] sm:text-sm font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">{p.title}</p>
                      <p className="text-sm font-black text-primary tracking-tighter">₦{p.price.toLocaleString()}</p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
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
