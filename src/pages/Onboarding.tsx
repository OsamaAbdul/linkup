import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Store, ShoppingBag, Truck, Megaphone, CheckCircle2, MapPin,
  User, ArrowRight, ArrowLeft, Upload, Calendar, Phone, Home, CreditCard, Users
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ”€”€”€ Step Indicator ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i + 1 <= current ? "bg-primary w-8" : "bg-border w-4"
          }`}
        />
      ))}
    </div>
  );
}

// ”€”€”€ Section Header ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon?: any }) {
  return (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      {Icon && (
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon size={22} className="text-primary" />
        </div>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </m.div>
  );
}

// ”€”€”€ Input Field with Icon ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
function FormField({
  label, icon: Icon, children, className = ""
}: { label: string; icon?: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-sm font-medium text-foreground/80 ml-0.5">{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        )}
        {children}
      </div>
    </div>
  );
}

const inputClass = "h-12 bg-secondary/50 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all rounded-xl text-foreground placeholder:text-muted-foreground/50";
const inputWithIcon = `${inputClass} pl-10`;

// ”€”€”€ Main Component ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
const roles = [
  { id: "buyer", title: "Buyer", icon: ShoppingBag, description: "Explore marketplace, find deals, and purchase items.", gradient: "from-primary/10 to-primary/5", iconBg: "bg-primary/15 text-primary" },
  { id: "seller", title: "Seller", icon: Store, description: "Create your store, list products, and manage orders.", gradient: "from-orange-500/10 to-orange-500/5", iconBg: "bg-orange-500/15 text-orange-600" },
  { id: "promoter", title: "Promoter", icon: Megaphone, description: "Earn commissions by sharing products you love.", gradient: "from-purple-500/10 to-purple-500/5", iconBg: "bg-purple-500/15 text-purple-600" },
  { id: "logistics", title: "Logistics", icon: Truck, description: "Manage deliveries, track shipments, and earn.", gradient: "from-accent/10 to-accent/5", iconBg: "bg-accent/15 text-accent-foreground" },
];

export default function Onboarding() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setStepLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["buyer"]);

  // ”€”€”€ Logistics State ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  const [logisticsData, setLogisticsData] = useState({
    fullName: "", phoneNumber: "", homeAddress: "", dob: "",
    city_id: "", zone_id: "", zone: "", passportFile: null as File | null,
  });
  const [onboardingData, setOnboardingData] = useState({
    username: "", bankName: "", accountNumber: "", accountName: "",
    nextOfKinName: "", nextOfKinPhone: "", nextOfKinRelation: "",
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cities").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["zones", logisticsData.city_id],
    queryFn: async () => {
      if (!logisticsData.city_id) return [];
      const { data, error } = await (supabase as any).from("delivery_zones")
        .select("*").eq("city_id", logisticsData.city_id).eq("is_active", true).order("name");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!logisticsData.city_id,
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    if (profile?.onboarding_completed) {
      navigate("/");
      return;
    }
    if (user?.user_metadata?.display_name) {
      setDisplayName(user.user_metadata.display_name);
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    const abuja = cities.find((c: any) => c.name === "Abuja");
    if (abuja && !logisticsData.city_id) {
      setLogisticsData((prev) => ({ ...prev, city_id: abuja.id }));
    }
  }, [cities, logisticsData.city_id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error("Display name is required"); return; }
    setStepLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ display_name: displayName, bio, updated_at: new Date().toISOString() })
        .eq("id", user!.id);
      if (error) throw error;
      setStep(2);
    } catch (error: any) {
      toast.error("Error updating profile: " + error.message);
    } finally {
      setStepLoading(false);
    }
  };

  const handleLogisticsKYC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logisticsData.passportFile) { toast.error("Passport photograph is required"); return; }
    if (!logisticsData.zone_id) { toast.error("Operational zone is required"); return; }
    setIsSubmitting(true);
    try {
      const ext = logisticsData.passportFile.name.split(".").pop();
      const path = `${user!.id}/passport_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, logisticsData.passportFile);
      if (uploadError) throw uploadError;

      const { error: kycError } = await (supabase as any).from("logistics_kyc").insert({
        user_id: user!.id, full_name: logisticsData.fullName, phone_number: logisticsData.phoneNumber,
        home_address: logisticsData.homeAddress, date_of_birth: logisticsData.dob,
        passport_photo_url: path, city_id: logisticsData.city_id, zone_id: logisticsData.zone_id,
      });
      if (kycError) throw kycError;

      const { error: zoneError } = await (supabase as any).from("profiles")
        .update({ zone: logisticsData.zone, city_id: logisticsData.city_id, zone_id: logisticsData.zone_id })
        .eq("id", user!.id);
      if (zoneError) throw zoneError;

      toast.success("KYC submitted! Final details next.");
      setStep(4);
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogisticsOnboarding = async (skip = false) => {
    setStepLoading(true);
    try {
      if (!skip) {
        const { error } = await (supabase as any).from("logistics_details").insert({
          user_id: user!.id, username: onboardingData.username || undefined,
          bank_name: onboardingData.bankName, account_number: onboardingData.accountNumber,
          account_name: onboardingData.accountName,
          next_of_kin: { name: onboardingData.nextOfKinName, phone: onboardingData.nextOfKinPhone, relationship: onboardingData.nextOfKinRelation },
        });
        if (error) throw error;
      }
      const { error: roleError } = await (supabase as any).rpc("manage_user_roles", {
        p_user_id: user!.id,
        p_roles: selectedRoles
      });
      if (roleError) throw roleError;
      const { error: updateError } = await (supabase as any).from("profiles").update({ onboarding_completed: true }).eq("id", user!.id);
      if (updateError) throw updateError;
      toast.success("Registration complete!");
      await refreshProfile();
      navigate("/");
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setStepLoading(false);
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev => {
      const isSelected = prev.includes(roleId);
      let next = isSelected ? prev.filter(r => r !== roleId) : [...prev, roleId];

      // Exclusivity: Seller vs Promoter
      if (roleId === "seller" && !isSelected) {
        next = next.filter(r => r !== "promoter");
      } else if (roleId === "promoter" && !isSelected) {
        next = next.filter(r => r !== "seller");
      }

      return next;
    });
  };

  const handleRoleSelection = async () => {
    if (selectedRoles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }
    
    if (selectedRoles.includes("logistics")) { 
      setStep(3); 
      return; 
    }

    setStepLoading(true);
    try {
      // Use the new manage_user_roles RPC to set all roles at once
      const { error: roleError } = await (supabase as any).rpc("manage_user_roles", {
        p_user_id: user!.id,
        p_roles: selectedRoles
      });
      if (roleError) throw roleError;
      
      const { error: profileError } = await (supabase as any).from("profiles").update({ onboarding_completed: true }).eq("id", user!.id);
      if (profileError) throw profileError;

      await refreshProfile();
      toast.success("Welcome to Linkup!");
      
      // Determine where to navigate
      if (selectedRoles.includes("seller")) navigate("/dashboard");
      else if (selectedRoles.includes("logistics")) navigate("/logistics-dashboard");
      else navigate("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStepLoading(false);
    }
  };

  const totalSteps = selectedRoles.includes("logistics") ? 4 : 2;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Logo */}
        <m.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <div className="absolute -inset-1.5 rounded-xl bg-primary/10 blur-lg" />
            <div className="relative rounded-xl border border-border/60 bg-card p-1.5 shadow-md">
              <img src="/src/assets/logo.jpeg" alt="Linkup" className="h-12 w-12 rounded-xl object-cover" />
            </div>
          </div>
        </m.div>

        <StepIndicator current={step} total={totalSteps} />

        <AnimatePresence mode="wait">
          {/* ”€”€”€ Step 1: Profile ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€ */}
          {step === 1 && (
            <m.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SectionHeader
                icon={User}
                title="Complete Your Profile"
                subtitle="Let's personalize your Linkup experience"
              />
              <div className="bg-card border border-border/60 rounded-xl p-6 sm:p-8 shadow-sm">
                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  <FormField label="Display Name" icon={User}>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className={inputWithIcon}
                      required
                    />
                  </FormField>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground/80 ml-0.5">Bio (Optional)</Label>
                    <Textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..."
                      className={`${inputClass} min-h-[100px] resize-none`}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl font-semibold text-[15px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all gap-2"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : (
                      <>Continue <ArrowRight size={16} /></>
                    )}
                  </Button>
                </form>
              </div>
            </m.div>
          )}

          {/* ”€”€”€ Step 2: Role Selection ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€ */}
          {step === 2 && (
            <m.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <SectionHeader
                title="Choose Your Path"
                subtitle="How would you like to use Linkup?"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.map((role, i) => {
                  const isSelected = selectedRoles.includes(role.id);
                  const isSellerPicked = selectedRoles.includes("seller");
                  const isPromoterPicked = selectedRoles.includes("promoter");
                  const isDisabled = (role.id === "seller" && isPromoterPicked) || 
                                   (role.id === "promoter" && isSellerPicked);

                  return (
                    <m.div
                      key={role.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      onClick={() => !isDisabled && toggleRole(role.id)}
                      className={`
                        relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-200 group
                        ${isSelected
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-border/40 bg-card hover:border-border hover:shadow-sm"
                        }
                        ${isDisabled ? "opacity-40 cursor-not-allowed grayscale" : ""}
                      `}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${role.iconBg}`}>
                        <role.icon size={20} />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">{role.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{role.description}</p>
                      {isSelected && (
                        <m.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-3 right-3"
                        >
                          <CheckCircle2 size={18} className="text-primary" />
                        </m.div>
                      )}
                    </m.div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-12 rounded-xl border-border/60 px-6"
                >
                  <ArrowLeft size={16} />
                </Button>
                <Button
                  onClick={handleRoleSelection}
                  className="flex-1 h-12 rounded-xl font-semibold text-[15px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all gap-2"
                  disabled={loading || selectedRoles.length === 0}
                >
                  {loading ? "Setting up..." : (
                    <>Get Started <ArrowRight size={16} /></>
                  )}
                </Button>
              </div>
            </m.div>
          )}

          {/* ”€”€”€ Step 3: Logistics KYC ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€ */}
          {step === 3 && (
            <m.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SectionHeader
                icon={Truck}
                title="Verification (KYC)"
                subtitle="We need to verify your identity to get started"
              />
              <div className="bg-card border border-border/60 rounded-xl p-6 sm:p-8 shadow-sm">
                <form onSubmit={handleLogisticsKYC} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Full Name" icon={User}>
                      <Input value={logisticsData.fullName} onChange={(e) => setLogisticsData({ ...logisticsData, fullName: e.target.value })} placeholder="Legal name" className={inputWithIcon} required />
                    </FormField>
                    <FormField label="Phone Number" icon={Phone}>
                      <Input value={logisticsData.phoneNumber} onChange={(e) => setLogisticsData({ ...logisticsData, phoneNumber: e.target.value })} placeholder="+234..." className={inputWithIcon} required />
                    </FormField>
                    <FormField label="Home Address" icon={Home} className="sm:col-span-2">
                      <Input value={logisticsData.homeAddress} onChange={(e) => setLogisticsData({ ...logisticsData, homeAddress: e.target.value })} placeholder="Residential address" className={inputWithIcon} required />
                    </FormField>
                    <FormField label="Date of Birth" icon={Calendar}>
                      <Input type="date" value={logisticsData.dob} onChange={(e) => setLogisticsData({ ...logisticsData, dob: e.target.value })} className={inputWithIcon} required />
                    </FormField>
                    <FormField label="Passport Photo" icon={Upload}>
                      <Input type="file" accept="image/*" onChange={(e) => setLogisticsData({ ...logisticsData, passportFile: e.target.files?.[0] || null })} className={`${inputClass} pl-10 pt-3 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:text-xs file:font-medium`} required />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-foreground/80 ml-0.5">City</Label>
                      <Select value={logisticsData.city_id} onValueChange={(v) => setLogisticsData({ ...logisticsData, city_id: v, zone_id: "", zone: "" })}>
                        <SelectTrigger className={inputClass}><SelectValue placeholder="Select city" /></SelectTrigger>
                        <SelectContent>
                          {cities.map((city: any) => (<SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-sm font-medium text-foreground/80 ml-0.5">Operational Zone</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                        {!logisticsData.city_id && (
                          <div className="col-span-full py-6 text-center border-2 border-dashed border-border/40 rounded-xl text-muted-foreground text-[11px] font-medium">
                            Please select a city first
                          </div>
                        )}
                        {zones.map((zone: any) => {
                          const isSelected = logisticsData.zone_id === zone.id;
                          return (
                            <m.div
                              key={zone.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setLogisticsData({ ...logisticsData, zone_id: zone.id, zone: zone.name })}
                              className={`
                                relative p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 group
                                ${isSelected 
                                  ? "border-primary bg-primary/5 shadow-sm" 
                                  : "border-secondary/50 bg-secondary/30 hover:border-border hover:bg-secondary/50"
                                }
                              `}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className={`text-[9px] font-bold uppercase tracking-wider leading-none mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>Zone</span>
                                <span className={`text-sm font-semibold truncate ${isSelected ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground"}`}>{zone.name}</span>
                              </div>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${isSelected ? "bg-primary text-primary-foreground scale-110" : "bg-black/5 text-transparent"}`}>
                                <CheckCircle2 size={12} strokeWidth={3} />
                              </div>
                            </m.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 ml-0.5">
                    <MapPin size={10} /> Sellers will find you based on your zone
                  </p>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} className="h-12 rounded-xl border-border/60 px-6">
                      <ArrowLeft size={16} />
                    </Button>
                    <Button type="submit" className="flex-1 h-12 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : "Submit Verification"}
                    </Button>
                  </div>
                </form>
              </div>
            </m.div>
          )}

          {/* ”€”€”€ Step 4: Logistics Onboarding ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€ */}
          {step === 4 && (
            <m.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SectionHeader
                icon={CreditCard}
                title="Final Details"
                subtitle="Optional €” you can complete this later"
              />
              <div className="bg-card border border-border/60 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
                <FormField label="Username" icon={User}>
                  <Input value={onboardingData.username} onChange={(e) => setOnboardingData({ ...onboardingData, username: e.target.value })} placeholder="unique_handle" className={inputWithIcon} />
                </FormField>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 border-t border-border/40">
                    <CreditCard size={13} />
                    Bank Information
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input placeholder="Bank Name" value={onboardingData.bankName} onChange={(e) => setOnboardingData({ ...onboardingData, bankName: e.target.value })} className={inputClass} />
                    <Input placeholder="Account Number" value={onboardingData.accountNumber} onChange={(e) => setOnboardingData({ ...onboardingData, accountNumber: e.target.value })} className={inputClass} />
                    <Input placeholder="Account Name" value={onboardingData.accountName} onChange={(e) => setOnboardingData({ ...onboardingData, accountName: e.target.value })} className={`${inputClass} sm:col-span-2`} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 border-t border-border/40">
                    <Users size={13} />
                    Next of Kin
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input placeholder="Full Name" value={onboardingData.nextOfKinName} onChange={(e) => setOnboardingData({ ...onboardingData, nextOfKinName: e.target.value })} className={inputClass} />
                    <Input placeholder="Phone Number" value={onboardingData.nextOfKinPhone} onChange={(e) => setOnboardingData({ ...onboardingData, nextOfKinPhone: e.target.value })} className={inputClass} />
                    <Input placeholder="Relationship" value={onboardingData.nextOfKinRelation} onChange={(e) => setOnboardingData({ ...onboardingData, nextOfKinRelation: e.target.value })} className={`${inputClass} sm:col-span-2`} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleLogisticsOnboarding(true)}
                    className="h-12 rounded-xl border-border/60 font-medium text-muted-foreground"
                  >
                    Skip for now
                  </Button>
                  <Button
                    onClick={() => handleLogisticsOnboarding(false)}
                    className="flex-1 h-12 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all gap-2"
                    disabled={loading}
                  >
                    {loading ? "Finishing..." : (
                      <>Complete Setup <CheckCircle2 size={16} /></>
                    )}
                  </Button>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

