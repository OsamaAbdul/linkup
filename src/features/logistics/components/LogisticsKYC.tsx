import { Badge } from "@/shared/components/ui/badge";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/shared/components/ui/select";
import {
  User,
  Phone,
  Home,
  Calendar,
  Upload,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import imageCompression from "browser-image-compression";

const FormField = ({ label, icon: Icon, children, className = "" }: any) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest ml-1 flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-primary/40" />}
      {label}
    </Label>
    {children}
  </div>
);

export function LogisticsKYC() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    homeAddress: "",
    dob: "",
    city_id: "",
    zone_id: "",
    zone: "",
    ninNumber: "",
    passportFile: null as File | null,
    idCardFile: null as File | null,
  });

  // Fetch Existing KYC Status
  const { data: kyc, isLoading: isLoadingKyc } = useQuery({
    queryKey: ["rider-kyc-status", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("logistics_kyc")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {

  }, [kyc, user?.id]);

  // Fetch Cities and Zones
  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("cities").select("*").order("name");
      return data || [];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", formData.city_id],
    queryFn: async () => {
      if (!formData.city_id) return [];
      const { data } = await (supabase as any)
        .from("delivery_zones")
        .select("*")
        .eq("city_id", formData.city_id)
        .order("name");
      return data || [];
    },
    enabled: !!formData.city_id,
  });

  // Default to Abuja if available and no city selected
  useEffect(() => {
    if (cities.length > 0 && !formData.city_id) {
      const abuja = cities.find((c: any) => c.name === "Abuja");
      if (abuja) {
        setFormData(prev => ({ ...prev, city_id: abuja.id }));
      }
    }
  }, [cities, formData.city_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.passportFile) { toast.error("Passport photograph is required"); return; }
    if (!formData.idCardFile) { toast.error("NIN/Voter's Card photograph is required"); return; }
    if (!formData.ninNumber) { toast.error("NIN number is required"); return; }
    if (!formData.zone_id) { toast.error("Operational zone is required"); return; }

    setIsSubmitting(true);
    try {
      // 1. Upload Documents
      const uploadFile = async (file: File, prefix: string) => {
        const ext = file.name.split(".").pop();
        const path = `${user!.id}/${prefix}_${Date.now()}.${ext}`;
        
        let fileToUpload = file;
        try {
            fileToUpload = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
        } catch (e) {
            console.error("Compression error:", e);
        }

        const { error } = await supabase.storage.from("kyc-documents").upload(path, fileToUpload);
        if (error) throw error;
        return path;
      };

      const passportPath = await uploadFile(formData.passportFile, "passport");
      const idCardPath = await uploadFile(formData.idCardFile, "id_card");

      // 2. Insert/Update KYC
      const { error: kycError } = await (supabase as any)
        .from("logistics_kyc")
        .upsert({
          user_id: user!.id,
          full_name: formData.fullName,
          phone_number: formData.phoneNumber,
          home_address: formData.homeAddress,
          date_of_birth: formData.dob,
          nin_number: formData.ninNumber,
          passport_photo_url: passportPath,
          id_card_photo_url: idCardPath,
          city_id: formData.city_id,
          zone_id: formData.zone_id,
          zone: formData.zone,
          status: 'pending',
          updated_at: new Date().toISOString()
        });

      if (kycError) throw kycError;

      // 3. Update profile zone info
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({
          zone: formData.zone,
          city_id: formData.city_id,
          zone_id: formData.zone_id,
        })
        .eq("id", user!.id);
      if (profileError) throw profileError;

      toast.success("Verification documents submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["rider-kyc-status"] });
      if (refreshProfile) await refreshProfile();
    } catch (error: any) {
      toast.error("Submission failed: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingKyc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Checking Profile Status...</p>
      </div>
    );
  }

  // If already verified or pending
  if (kyc && (kyc.status === "verified" || kyc.status === "pending")) {
    const isVerified = kyc.status === "verified";
    return (
      <div className="max-w-2xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="rounded-2xl border-none shadow-2xl shadow-black/[0.04] overflow-hidden bg-white">
          <div className={cn(
            "h-40 flex flex-col items-center justify-center relative overflow-hidden",
            isVerified ? "bg-green-500/5 text-green-600" : "bg-[#E96F28]/5 text-[#E96F28]"
          )}>
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            </div>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl mb-4 relative z-10",
                isVerified ? "bg-green-500 text-white shadow-green-500/20" : "bg-[#E96F28] text-white shadow-orange-600/20"
              )}
            >
              {isVerified ? <CheckCircle2 size={40} strokeWidth={2.5} /> : <Clock size={40} strokeWidth={2.5} />}
            </motion.div>
            <div className="relative z-10 text-center">
              <Badge variant="outline" className={cn(
                "rounded-full px-4 py-1 border-none text-[10px] font-black uppercase tracking-[0.2em]",
                isVerified ? "bg-green-500/10 text-green-600" : "bg-[#E96F28]/10 text-[#E96F28]"
              )}>
                {isVerified ? "Profile Confirmed" : "Review in Progress"}
              </Badge>
            </div>
          </div>

          <CardHeader className="text-center p-10 pt-8">
            <CardTitle className="text-4xl font-black tracking-tight uppercase italic mb-2">
              {isVerified ? "Verified Partner" : "Verification in Progress"}
            </CardTitle>
            <CardDescription className="text-base font-medium max-w-sm mx-auto leading-relaxed text-muted-foreground/80">
              {isVerified
                ? "Your identity has been confirmed. You are now authorized to accept and start missions."
                : "We are currently reviewing your documents. This process usually completes within 24-48 hours."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-10 pt-0 flex flex-col items-center gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="p-5 rounded-2xl bg-muted/20 border border-black/[0.02] hover:bg-muted/30 transition-colors">
                <p className="text-[10px] font-black uppercase text-muted-foreground/50 mb-1.5 tracking-[0.2em]">Full Name</p>
                <p className="text-sm font-bold text-foreground">{kyc.full_name}</p>
              </div>
              <div className="p-5 rounded-2xl bg-muted/20 border border-black/[0.02] hover:bg-muted/30 transition-colors">
                <p className="text-[10px] font-black uppercase text-muted-foreground/50 mb-1.5 tracking-[0.2em]">Phone Number</p>
                <p className="text-sm font-bold text-foreground">{kyc.phone_number}</p>
              </div>
              <div className="p-5 rounded-2xl bg-muted/20 border border-black/[0.02] hover:bg-muted/30 transition-colors sm:col-span-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground/50 mb-1.5 tracking-[0.2em]">Identification Number</p>
                <p className="text-sm font-bold text-foreground tracking-widest">{kyc.nin_number || 'ENC_HIDDEN'}</p>
              </div>
            </div>

            {!isVerified && (
              <Button
                variant="ghost"
                className="rounded-xl h-12 px-8 font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["rider-kyc-status"] })}
              >
                Sync with Server
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const inputClass = "h-12 rounded-xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/20 font-medium px-4 transition-all";

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Truck size={20} strokeWidth={3} />
          </div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Partner Verification</p>
        </div>
        <h1 className="text-4xl font-black text-foreground tracking-tight">Identity Check</h1>
        <p className="text-muted-foreground font-medium mt-2">Submit your basic details to start accepting missions.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="rounded-xl border-none shadow-xl shadow-black/[0.02] bg-white p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Legal Full Name" icon={User}>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
                className={inputClass}
                required
              />
            </FormField>

            <FormField label="Phone Number" icon={Phone}>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="+234..."
                className={inputClass}
                required
              />
            </FormField>

            <FormField label="Home Address" icon={Home} className="md:col-span-2">
              <Input
                value={formData.homeAddress}
                onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                placeholder="123 Street Name, Neighborhood"
                className={inputClass}
                required
              />
            </FormField>

            <FormField label="Date of Birth" icon={Calendar}>
              <Input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className={cn(inputClass, "block")}
                required
              />
            </FormField>

            <FormField label="NIN Number" icon={ShieldCheck}>
              <Input
                value={formData.ninNumber}
                onChange={(e) => setFormData({ ...formData, ninNumber: e.target.value })}
                placeholder="11-digit NIN"
                className={inputClass}
                maxLength={11}
                required
              />
            </FormField>

            <FormField label="Passport Photograph" icon={Upload}>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, passportFile: e.target.files?.[0] || null })}
                  className={cn(
                    inputClass,
                    "pt-3 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-[10px] file:font-black file:uppercase file:tracking-widest cursor-pointer"
                  )}
                  required
                />
              </div>
            </FormField>

            <FormField label="NIN / Voter's Card (Photo)" icon={Upload}>
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, idCardFile: e.target.files?.[0] || null })}
                  className={cn(
                    inputClass,
                    "pt-3 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-[10px] file:font-black file:uppercase file:tracking-widest cursor-pointer"
                  )}
                  required
                />
              </div>
            </FormField>

            <FormField label="Primary City">
              <Select
                value={formData.city_id}
                onValueChange={(v) => setFormData({ ...formData, city_id: v, zone_id: "", zone: "" })}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl">
                  {cities.map((city: any) => (
                    <SelectItem key={city.id} value={city.id} className="rounded-xl my-1">{city.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Delivery Area" className="md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {!formData.city_id && (
                  <div className="col-span-full py-8 text-center border-2 border-dashed border-black/5 rounded-xl text-muted-foreground text-xs font-medium">
                    <MapPin size={24} strokeWidth={1} className="mx-auto mb-2 opacity-20" />
                    Please select a primary city first
                  </div>
                )}
                {zones.map((zone: any) => {
                  const isSelected = formData.zone_id === zone.id;
                  return (
                    <motion.div
                      key={zone.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData({ ...formData, zone_id: zone.id, zone: zone.name })}
                      className={cn(
                        "relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 group",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/5"
                          : "border-black/[0.03] bg-muted/20 hover:border-black/10 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest leading-none mb-1",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}>Delivery Area</span>
                        <span className={cn(
                          "text-sm font-bold truncate",
                          isSelected ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground"
                        )}>{zone.name}</span>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all",
                        isSelected ? "bg-primary text-white scale-110" : "bg-black/5 text-transparent"
                      )}>
                        <CheckCircle2 size={14} strokeWidth={3} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </FormField>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-amber-50 border border-amber-200/50 flex gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={18} />
            <p className="text-xs font-medium text-amber-800 leading-relaxed">
              Ensure all information matches your legal documents. Inaccurate data will lead to verification rejection and potential account suspension.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full mt-8 rounded-xl h-14 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-[0.98]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending Information..." : "Submit Profile for Review"}
          </Button>
        </Card>
      </form>
    </div>
  );
}






