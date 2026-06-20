import { useState, useEffect } from "react";
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
import { User, Phone, MapPin, Home, Info, Loader2, Save, Mail, Navigation, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCities, useZones } from "@/shared/hooks/use-marketplace-metadata";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";

interface ProfileFormProps {
  onSuccess?: () => void;
}

export function ProfileForm({ onSuccess }: ProfileFormProps) {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const geo = useGeolocation();

  const [formData, setFormData] = useState({
    display_name: "",
    phone: "",
    bio: "",
    address: "",
    city_id: "",
    zone_id: "",
    email: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const { data: cities = [] } = useCities();
  const { data: zones = [] } = useZones(formData.city_id);

  const { data: kyc } = useQuery({
    queryKey: ["logistics-kyc-profile-fallback", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("logistics_kyc")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || kyc?.full_name || "",
        phone: profile.phone || kyc?.phone_number || "",
        bio: profile.bio || "",
        address: profile.address || kyc?.home_address || "",
        city_id: profile.city_id || kyc?.city_id || "",
        zone_id: profile.zone_id || kyc?.zone_id || "",
        email: profile.email || "",
        latitude: profile.latitude || null,
        longitude: profile.longitude || null,
      });
    }
  }, [profile, kyc]);

  const updateProfile = useMutation({
    mutationFn: async (updatedData: typeof formData) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          display_name: updatedData.display_name || null,
          phone: updatedData.phone || null,
          bio: updatedData.bio || null,
          address: updatedData.address || null,
          city_id: updatedData.city_id || null,
          zone_id: updatedData.zone_id || null,
          email: updatedData.email || null,
          latitude: updatedData.latitude,
          longitude: updatedData.longitude,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully");
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      onSuccess?.();
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
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Completion Guide */}
      <Card className="border-none shadow-xl shadow-primary/5 bg-gradient-to-br from-primary/5 to-transparent rounded-[32px] overflow-hidden group">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                <CheckCircle2 size={20} strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Registry Strength</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Complete your profile for better service</p>
              </div>
            </div>
            <Badge className="bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-full px-3 py-1">
              {Math.round([
                !!formData.display_name,
                !!formData.phone,
                !!formData.bio,
                !!formData.address,
                !!formData.city_id,
                !!formData.zone_id,
                !!formData.email,
                !!formData.latitude
              ].filter(Boolean).length / 8 * 100)}%
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Basic Info", done: !!formData.display_name && !!formData.phone, icon: <User size={12} /> },
              { label: "Bio Details", done: !!formData.bio, icon: <Info size={12} /> },
              { label: "Address Set", done: !!formData.address && !!formData.city_id, icon: <Home size={12} /> },
              { label: "Zone Mapping", done: !!formData.zone_id, icon: <MapPin size={12} /> },
              { label: "Location Pin", done: !!formData.latitude, icon: <Navigation size={12} /> },
              { label: "Email Contact", done: !!formData.email, icon: <Mail size={12} /> },
            ].map((step, i) => (
              <div key={i} className={cn(
                "flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300",
                step.done
                  ? "bg-green-50/50 border-green-100 text-green-700"
                  : "bg-muted/30 border-black/[0.03] text-muted-foreground blur-[0.3px]"
              )}>
                <div className={cn("shrink-0", step.done ? "text-green-600" : "text-muted-foreground")}>
                  {step.done ? <CheckCircle2 size={14} strokeWidth={3} /> : step.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{step.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-none shadow-sm ring-1 ring-black/5 bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/30 pb-6 border-b border-black/[0.03]">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <User size={20} className="text-primary" />
              Personal Details
            </CardTitle>
            <CardDescription className="text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-70">Identity & Contact Info</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Display Name</Label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Enter your name"
                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center justify-between">
                  Email Address
                  {!formData.email && <AlertCircle size={12} className="text-orange-500 animate-pulse" />}
                </Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"

                    className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="081*******"
                  maxLength={11}
                  className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center justify-between">
                About You
                {!formData.bio && <span className="text-[9px] text-orange-600 font-black">MISSING</span>}
              </Label>
              <div className="relative">
                <Info size={16} className="absolute left-3.5 top-3 text-muted-foreground" />
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Brief bio about yourself..."
                  className="pl-10 min-h-[100px] rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 resize-none pt-2.5 font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-black/5 bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/30 pb-6 border-b border-black/[0.03]">
            <CardTitle className="text-lg font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                Delivery Registry
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => geo.refresh()}
                disabled={geo.loading}
                className="rounded-full h-8 text-[9px] font-black uppercase tracking-widest gap-2 bg-white border-primary/20 text-primary hover:bg-primary/5"
              >
                {geo.loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Navigation size={12} strokeWidth={3} />
                )}
                {formData.latitude ? "Update Location" : "Detect Pin"}
              </Button>
            </CardTitle>
            <CardDescription className="text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-70">Optimize your delivery logistics</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {geo.error && (
              <div className="bg-red-50 p-3 rounded-2xl border border-red-100 flex items-center gap-3 text-red-700 mb-2">
                <AlertCircle size={16} />
                <p className="text-[10px] font-black uppercase tracking-tight">{geo.error}</p>
              </div>
            )}

            {geo.position && !geo.loading && formData.latitude !== geo.position.latitude && (
              <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex items-center justify-between gap-3 text-blue-700 mb-2">
                <div className="flex items-center gap-2">
                  <Navigation size={14} className="animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-tight">New location detected!</p>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-[9px] font-black uppercase tracking-widest text-blue-800 underline"
                  onClick={() => setFormData({ ...formData, latitude: geo.position?.latitude ?? null, longitude: geo.position?.longitude ?? null })}
                >
                  Apply Coordinates
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">City</Label>
                <Select
                  value={formData.city_id}
                  onValueChange={(v) => setFormData({ ...formData, city_id: v, zone_id: "" })}
                >
                  <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold">
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
                  <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold">
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
                  className="pl-10 h-12 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 font-bold"
                />
              </div>
            </div>

            {formData.latitude && (
              <div className="p-3 bg-primary/5 rounded-2xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                    <Navigation size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Spatial Tag PINNED</p>
                    <p className="text-[11px] font-bold text-foreground/80">{formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}</p>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
            )}
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
              Save Registry Changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
