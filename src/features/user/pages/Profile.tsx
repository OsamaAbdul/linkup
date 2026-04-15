import { useState, useEffect } from "react";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Phone, MapPin, Home, Info, Loader2, Save } from "lucide-react";

import { useCities, useZones } from "@/shared/hooks/use-marketplace-metadata";

export default function Profile() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    display_name: "",
    phone: "",
    bio: "",
    address: "",
    city_id: "",
    zone_id: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        address: profile.address || "",
        city_id: profile.city_id || "",
        zone_id: profile.zone_id || "",
      });
    }
  }, [profile]);

  const { data: cities = [] } = useCities();

  const { data: zones = [] } = useZones(formData.city_id);

  const updateProfile = useMutation({
    mutationFn: async (updatedData: typeof formData) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          display_name: updatedData.display_name,
          phone: updatedData.phone,
          bio: updatedData.bio,
          address: updatedData.address,
          city_id: updatedData.city_id,
          zone_id: updatedData.zone_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      toast.error("Error updating profile: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.display_name.trim()) {
      toast.error("Display name is required");
      return;
    }
    updateProfile.mutate(formData);
  };

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
        <header>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-1 font-medium">Manage your personal information and preferences.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-none shadow-sm ring-1 ring-black/5 bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 pb-6 border-b border-black/[0.03]">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <User size={20} className="text-primary" />
                Personal Details
              </CardTitle>
              <CardDescription className="text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-70">Tell us a bit about yourself</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Display Name</Label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Enter your name"
                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+234..."
                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">About You</Label>
                <div className="relative">
                  <Info size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                  <Textarea 
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Brief bio about yourself..."
                    className="pl-10 min-h-[100px] rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 resize-none pt-2.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-black/5 bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/30 pb-6 border-b border-black/[0.03]">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                Address Details
              </CardTitle>
              <CardDescription className="text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-70">Where should we deliver your orders?</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">City</Label>
                  <Select 
                    value={formData.city_id} 
                    onValueChange={(v) => setFormData({ ...formData, city_id: v, zone_id: "" })}
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none">
                      <SelectValue placeholder="Select City" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {cities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id} className="rounded-xl">{city.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Delivery Zone</Label>
                  <Select 
                    value={formData.zone_id} 
                    onValueChange={(v) => setFormData({ ...formData, zone_id: v })}
                    disabled={!formData.city_id}
                  >
                    <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none">
                      <SelectValue placeholder="Select Zone" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {zones.map((zone: any) => (
                        <SelectItem key={zone.id} value={zone.id} className="rounded-xl">{zone.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Street Address</Label>
                <div className="relative">
                  <Home size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Your primary address"
                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full h-14 rounded-3xl font-black text-xs uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all gap-3 overflow-hidden group"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={18} className="group-hover:scale-110 transition-transform" />
                Save Profile
              </>
            )}
          </Button>

          <Card className="border-none bg-muted/20 rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 bg-white/50 rounded-xl flex items-center justify-center text-muted-foreground">
                <User size={18} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Account ID</p>
                <p className="text-xs font-mono text-foreground/60">{user?.id}</p>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
