import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { toast } from "sonner";
import {
  Wallet,
  Percent,
  Banknote,
  Save,
  RotateCcw,
  ShieldCheck,
  Info,
  Map as MapIcon,
  Route,
  Clock,
  Package,
  Sparkles,
  Calculator,
  Layers,
  CheckCircle2,
  ShieldAlert,
  Bike,
  Pencil,
  Sliders,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeeConfig {
  id: string;
  fee_type: string;
  name: string;
  rate: number;
  flat_fee: number;
  priority: number;
  is_active: boolean;
}

const DEFAULT_SEND_FEES = [
  { fee_type: "send_base_fee", name: "Send: Base Delivery Fee", rate: 0, flat_fee: 500, priority: 65 },
  { fee_type: "send_per_km_rate", name: "Send: Per KM Rate", rate: 0, flat_fee: 100, priority: 64 },
  { fee_type: "send_pkg_small_surcharge", name: "Send: Small Package (Under 2kg)", rate: 0, flat_fee: 0, priority: 63 },
  { fee_type: "send_pkg_medium_surcharge", name: "Send: Medium Package (2 - 5kg)", rate: 0, flat_fee: 200, priority: 62 },
  { fee_type: "send_pkg_large_surcharge", name: "Send: Large Package (5 - 10kg)", rate: 0, flat_fee: 500, priority: 61 },
  { fee_type: "send_pkg_xlarge_surcharge", name: "Send: Extra Large Package (10kg+)", rate: 0, flat_fee: 1000, priority: 60 },
  { fee_type: "send_service_fee", name: "Send: Platform Service Fee", rate: 0, flat_fee: 200, priority: 59 },
  { fee_type: "send_fragile_surcharge", name: "Send: Fragile Handling Fee", rate: 0, flat_fee: 300, priority: 58 },
  { fee_type: "send_rider_payout_rate", name: "Send: Rider Earnings Share (%)", rate: 0.80, flat_fee: 0, priority: 57 },
  { fee_type: "send_rider_min_payout", name: "Send: Minimum Rider Guaranteed Payout", rate: 0, flat_fee: 1000, priority: 56 },
];

export default function AdminFeeConfig() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "send" | "marketplace">("send");

  // Pop-up editing modal state
  const [editingFee, setEditingFee] = useState<FeeConfig | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [editFlatFee, setEditFlatFee] = useState<number>(0);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // Simulator state
  const [simDistanceKm, setSimDistanceKm] = useState<number>(6.5);
  const [simWeightKg, setSimWeightKg] = useState<number>(2.5);
  const [simFragile, setSimFragile] = useState<boolean>(false);

  const { data: fees, isLoading } = useQuery({
    queryKey: ["admin-fee-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fee_config")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data as FeeConfig[];
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: async (updatedFee: Partial<FeeConfig> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("fee_config")
        .update(updatedFee)
        .eq("id", updatedFee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-fee-config"] });
      queryClient.invalidateQueries({ queryKey: ["fee-config"] });
      queryClient.invalidateQueries({ queryKey: ["calculate_send_delivery_fee"] });
      setEditingFee(null);
      toast.success("Fee configuration updated successfully");
    },
    onError: (error: any) => {
      toast.error("Failed to update fee", { description: error.message });
    },
  });

  const seedSendFeesMutation = useMutation({
    mutationFn: async () => {
      for (const fee of DEFAULT_SEND_FEES) {
        await (supabase as any)
          .from("fee_config")
          .upsert({ ...fee, is_active: true }, { onConflict: "fee_type" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-fee-config"] });
      toast.success("Default LinkUp SEND pricing & rider earnings initialized in database");
    },
    onError: (err: any) => {
      toast.error("Failed to initialize SEND fees", { description: err.message });
    },
  });

  const openEditModal = (fee: FeeConfig) => {
    setEditingFee(fee);
    setEditRate(fee.rate || 0);
    setEditFlatFee(fee.flat_fee || 0);
    setEditIsActive(fee.is_active);
  };

  const handleSaveModal = () => {
    if (!editingFee) return;
    updateFeeMutation.mutate({
      id: editingFee.id,
      rate: editRate,
      flat_fee: editFlatFee,
      is_active: editIsActive,
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "send_base_fee":
        return <Banknote className="text-orange-600" />;
      case "send_per_km_rate":
        return <Route className="text-blue-600" />;
      case "send_pkg_small_surcharge":
      case "send_pkg_medium_surcharge":
      case "send_pkg_large_surcharge":
      case "send_pkg_xlarge_surcharge":
        return <Package className="text-purple-600" />;
      case "send_service_fee":
        return <ShieldCheck className="text-emerald-600" />;
      case "send_fragile_surcharge":
        return <ShieldAlert className="text-red-500" />;
      case "send_rider_payout_rate":
        return <Bike className="text-emerald-600" />;
      case "send_rider_min_payout":
        return <Wallet className="text-emerald-600" />;
      case "platform":
        return <ShieldCheck className="text-blue-500" />;
      case "platform_rider_cut":
        return <ShieldCheck className="text-indigo-500" />;
      case "rider":
        return <Banknote className="text-green-500" />;
      case "promoter":
        return <Percent className="text-purple-500" />;
      case "rider_out_of_zone":
        return <MapIcon className="text-orange-500" />;
      case "rider_distance":
        return <Route className="text-blue-600" />;
      case "buyer_cross_zone":
        return <MapIcon className="text-red-500" />;
      case "settlement":
        return <Clock className="text-amber-500" />;
      default:
        return <Wallet className="text-gray-500" />;
    }
  };

  const isSendFee = (type: string) => type.startsWith("send_");
  const isRiderPayoutFee = (type: string) => type.startsWith("send_rider_");

  const filteredFees = fees?.filter((fee) => {
    if (activeTab === "send") return isSendFee(fee.fee_type);
    if (activeTab === "marketplace") return !isSendFee(fee.fee_type);
    return true;
  });

  // Calculate live preview from active database values
  const getFeeVal = (type: string, fallback: number) => {
    const found = fees?.find((f) => f.fee_type === type && f.is_active);
    return found ? Number(found.flat_fee) : fallback;
  };

  const getFeeRate = (type: string, fallback: number) => {
    const found = fees?.find((f) => f.fee_type === type && f.is_active);
    return found && found.rate ? Number(found.rate) : fallback;
  };

  const simBaseFee = getFeeVal("send_base_fee", 500);
  const simPerKmRate = getFeeVal("send_per_km_rate", 100);
  const simDistanceFee = Math.round(simDistanceKm * simPerKmRate);
  const simWeightSurcharge =
    simWeightKg <= 2
      ? getFeeVal("send_pkg_small_surcharge", 0)
      : simWeightKg <= 5
      ? getFeeVal("send_pkg_medium_surcharge", 200)
      : simWeightKg <= 10
      ? getFeeVal("send_pkg_large_surcharge", 500)
      : getFeeVal("send_pkg_xlarge_surcharge", 1000);
  const simServiceFee = getFeeVal("send_service_fee", 200);
  const simFragileFee = simFragile ? getFeeVal("send_fragile_surcharge", 300) : 0;
  const simTotalFee = simBaseFee + simDistanceFee + simWeightSurcharge + simServiceFee + simFragileFee;

  // Rider earnings calculations
  const simRiderRate = getFeeRate("send_rider_payout_rate", 0.80);
  const simRiderMinPayout = getFeeVal("send_rider_min_payout", 1000);
  const simRiderEarnings = Math.max(simRiderMinPayout, Math.round(simTotalFee * simRiderRate));
  const simPlatformNet = Math.max(0, simTotalFee - simRiderEarnings);

  const formatFeeValue = (fee: FeeConfig) => {
    if (fee.fee_type === "send_rider_payout_rate" || (fee.fee_type.includes("rate") && !fee.fee_type.includes("per_km"))) {
      return `${Math.round((fee.rate || 0) * 100)}%`;
    }
    if (fee.fee_type === "send_per_km_rate") {
      return `₦${Number(fee.flat_fee || 0).toLocaleString()}/km`;
    }
    return `₦${Number(fee.flat_fee || 0).toLocaleString()}`;
  };

  const getFeeDescription = (fee_type: string) => {
    switch (fee_type) {
      case "send_base_fee":
        return "Base starting price for any package delivery mission";
      case "send_per_km_rate":
        return "Distance fee charged per kilometer travelled";
      case "send_pkg_small_surcharge":
        return "Additional fee for small parcels under 2kg";
      case "send_pkg_medium_surcharge":
        return "Additional surcharge for standard 2kg to 5kg items";
      case "send_pkg_large_surcharge":
        return "Additional surcharge for heavy 5kg to 10kg parcels";
      case "send_pkg_xlarge_surcharge":
        return "Surcharge for oversize/heavy packages over 10kg";
      case "send_service_fee":
        return "Platform operational and customer protection fee";
      case "send_fragile_surcharge":
        return "Special handling fee for glass, cakes, & fragile items";
      case "send_rider_payout_rate":
        return "Percentage share of delivery fee paid directly into rider's wallet upon delivery";
      case "send_rider_min_payout":
        return "Guaranteed minimum take-home floor amount for dispatch riders";
      case "platform":
        return "General platform commission on marketplace sales";
      case "promoter":
        return "Referral and affiliate promoter commission rate";
      default:
        return "Configured system rate applied across deliveries";
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground font-black uppercase tracking-widest animate-pulse">
        Loading Pricing & Fee Configuration...
      </div>
    );
  }

  const hasSendFees = fees?.some((f) => isSendFee(f.fee_type));

  // Partition fees for SEND tab
  const sendCustomerFees = filteredFees?.filter((f) => !isRiderPayoutFee(f.fee_type)) || [];
  const sendRiderFees = filteredFees?.filter((f) => isRiderPayoutFee(f.fee_type)) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-black/[0.04] shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Wallet size={22} />
            </div>
            Pricing & Fee Settings
          </h2>
          <p className="text-muted-foreground font-medium text-xs sm:text-sm ml-1">
            Manage customer delivery rates, rider earnings share, and platform commissions.
          </p>
        </div>

        {/* Action Buttons & Tab Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {!hasSendFees && (
            <Button
              onClick={() => seedSendFeesMutation.mutate()}
              disabled={seedSendFeesMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white rounded-2xl text-xs font-bold gap-1.5"
            >
              <Sparkles size={14} />
              <span>Initialize SEND Pricing</span>
            </Button>
          )}

          <div className="flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-black/[0.03]">
            <Button
              variant={activeTab === "send" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("send")}
              className="rounded-xl text-xs font-bold h-9 gap-1.5"
            >
              <span>📦</span>
              <span>LinkUp SEND</span>
            </Button>
            <Button
              variant={activeTab === "marketplace" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("marketplace")}
              className="rounded-xl text-xs font-bold h-9 gap-1.5"
            >
              <span>🛍️</span>
              <span>Marketplace</span>
            </Button>
            <Button
              variant={activeTab === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("all")}
              className="rounded-xl text-xs font-bold h-9"
            >
              All Fees
            </Button>
          </div>
        </div>
      </div>

      {/* SEND PACKAGE FORMULA & SIMULATOR CARD (Visible on Send & All tabs) */}
      {(activeTab === "send" || activeTab === "all") && (
        <Card className="rounded-3xl border-primary/20 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30 shadow-sm overflow-hidden">
          <CardHeader className="p-6 border-b border-orange-100/80 bg-orange-50/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md">
                  <Calculator size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-foreground">
                    Live Pricing & Rider Earnings Simulator
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-muted-foreground">
                    Calculated on the database. See how customer delivery fees and rider take-home payouts split in real time.
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-primary text-white font-extrabold text-xs px-3 py-1 self-start sm:self-auto">
                Verified on Backend
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Simulator Controls */}
              <div className="lg:col-span-6 space-y-4">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Simulated Trip Parameters
                </p>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Trip Distance (KM)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="100"
                      value={simDistanceKm}
                      onChange={(e) => setSimDistanceKm(parseFloat(e.target.value) || 1)}
                      className="h-10 rounded-xl bg-white border-orange-200 font-bold text-sm"
                    />
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {simDistanceKm} km
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Package Weight (KG)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.1"
                      max="50"
                      value={simWeightKg}
                      onChange={(e) => setSimWeightKg(parseFloat(e.target.value) || 1)}
                      className="h-10 rounded-xl bg-white border-orange-200 font-bold text-sm"
                    />
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                      {simWeightKg <= 2 ? "Under 2kg" : `${simWeightKg} kg`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-orange-100">
                  <div>
                    <Label className="text-xs font-bold text-foreground block">Fragile Item Handling</Label>
                    <p className="text-[11px] text-muted-foreground">Adds fragile handling fee</p>
                  </div>
                  <Switch checked={simFragile} onCheckedChange={setSimFragile} />
                </div>
              </div>

              {/* Result Summary & Split */}
              <div className="lg:col-span-6 p-5 rounded-2xl bg-white border border-orange-100 shadow-sm space-y-2.5 text-xs">
                <p className="text-[11px] font-black uppercase tracking-wider text-primary">
                  Customer Price & Payout Breakdown
                </p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Base Delivery Fee:</span>
                  <span className="font-bold text-foreground">₦{simBaseFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Distance ({simDistanceKm} km × ₦{simPerKmRate}/km):</span>
                  <span className="font-bold text-foreground">₦{simDistanceFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Package Surcharge ({simWeightKg}kg):</span>
                  <span className="font-bold text-foreground">+{simWeightSurcharge > 0 ? `₦${simWeightSurcharge.toLocaleString()}` : '₦0'}</span>
                </div>
                {simFragile && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fragile Surcharge:</span>
                    <span className="font-bold text-foreground">+₦{simFragileFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Service Fee:</span>
                  <span className="font-bold text-foreground">₦{simServiceFee.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="font-bold text-sm text-foreground">Customer Total Delivery Fee:</span>
                  <span className="text-xl font-extrabold text-primary font-heading">
                    ₦{simTotalFee.toLocaleString()}
                  </span>
                </div>

                {/* Rider Earnings & Platform Commission Split */}
                <div className="pt-3 border-t border-orange-100 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-black text-[10px] uppercase tracking-wider">
                      <Bike size={14} />
                      <span>Rider Takes Home</span>
                    </div>
                    <p className="text-lg font-black text-emerald-900 mt-1 font-heading">
                      ₦{simRiderEarnings.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700">
                      {Math.round(simRiderRate * 100)}% of fee (Min ₦{simRiderMinPayout.toLocaleString()})
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-1.5 text-blue-800 font-black text-[10px] uppercase tracking-wider">
                      <ShieldCheck size={14} />
                      <span>Platform Commission</span>
                    </div>
                    <p className="text-lg font-black text-blue-900 mt-1 font-heading">
                      ₦{simPlatformNet.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-blue-700">
                      {Math.round((1 - simRiderRate) * 100)}% platform net
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= SECTION: RIDER EARNINGS & PAYOUT CONFIG (Pop-Up Cards) ================= */}
      {(activeTab === "send" || activeTab === "all") && sendRiderFees.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Bike className="w-5 h-5 text-emerald-600" />
                <span>Rider Earnings & Payout Settings</span>
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Click any card to pop up the editor and adjust rider payout share or minimum guarantee.
              </p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-extrabold text-xs">
              Direct Rider Payout
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sendRiderFees.map((fee) => (
              <div
                key={fee.id}
                onClick={() => openEditModal(fee)}
                className="group relative bg-white p-5 rounded-2xl border border-emerald-100 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getIcon(fee.fee_type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-foreground group-hover:text-emerald-700 transition-colors truncate">
                        {fee.name}
                      </h4>
                      {!fee.is_active && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {getFeeDescription(fee.fee_type)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-700 font-heading block">
                      {formatFeeValue(fee)}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">
                      {fee.fee_type === "send_rider_payout_rate" ? "Share Rate" : "Minimum Floor"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-xl text-muted-foreground group-hover:text-emerald-700 group-hover:bg-emerald-50"
                  >
                    <Pencil size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SECTION: CUSTOMER DELIVERY PRICING / MARKETPLACE FEES ================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-foreground flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              <span>
                {activeTab === "send"
                  ? "Customer Delivery Charges"
                  : activeTab === "marketplace"
                  ? "Marketplace & Platform Rates"
                  : "All Delivery & Platform Fees"}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground font-medium">
              Click on any fee card to view details and edit the rate in a pop-up modal.
            </p>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {activeTab === "send" ? sendCustomerFees.length : filteredFees?.length} Fees Configured
          </span>
        </div>

        {/* Clean, Non-Clustered Pop-Up Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(activeTab === "send" ? sendCustomerFees : filteredFees)?.map((fee) => (
            <div
              key={fee.id}
              onClick={() => openEditModal(fee)}
              className={cn(
                "group relative bg-white p-5 rounded-2xl border border-black/[0.04] hover:border-primary/40 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4",
                !fee.is_active && "opacity-60 bg-gray-50/50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-black/[0.04] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {getIcon(fee.fee_type)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={fee.is_active ? "outline" : "secondary"}
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg",
                      fee.is_active
                        ? "border-emerald-200 text-emerald-700 bg-emerald-50/60"
                        : "text-gray-400 bg-gray-100"
                    )}
                  >
                    {fee.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {fee.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {getFeeDescription(fee.fee_type)}
                </p>
              </div>

              <div className="pt-3 border-t border-black/[0.03] flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">Current Value</span>
                  <span className="text-base font-extrabold text-foreground font-heading">
                    {formatFeeValue(fee)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                  <span>Edit</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= FOCUSED POP-UP EDIT CARD / MODAL ================= */}
      {editingFee && (
        <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border border-black/[0.08] shadow-2xl">
            <DialogHeader className="space-y-2 pb-2 border-b border-black/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  {getIcon(editingFee.fee_type)}
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground tracking-tight">
                    {editingFee.name}
                  </DialogTitle>
                  <p className="text-[11px] font-mono text-muted-foreground uppercase font-bold">
                    Key: {editingFee.fee_type}
                  </p>
                </div>
              </div>
              <DialogDescription className="text-xs text-muted-foreground font-medium pt-1">
                {getFeeDescription(editingFee.fee_type)}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Fee Value Input */}
              <div className="space-y-2">
                <Label className="text-xs font-extrabold text-foreground flex items-center justify-between">
                  <span>
                    {editingFee.fee_type === "send_rider_payout_rate"
                      ? "Rider Share Percentage (%)"
                      : editingFee.fee_type.includes("rate") && !editingFee.fee_type.includes("per_km")
                      ? "Rate Percentage (%)"
                      : editingFee.fee_type === "send_per_km_rate"
                      ? "Rate Per Kilometer (₦/km)"
                      : editingFee.fee_type === "send_rider_min_payout"
                      ? "Minimum Guaranteed Payout (₦)"
                      : "Fee Amount in Naira (₦)"}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {editingFee.fee_type === "send_rider_payout_rate" ? "0 - 100%" : "Enter amount"}
                  </span>
                </Label>

                <div className="relative">
                  {editingFee.fee_type === "send_rider_payout_rate" ||
                  (editingFee.fee_type.includes("rate") && !editingFee.fee_type.includes("per_km")) ? (
                    <>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={Math.round((editRate || 0) * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditRate(isNaN(val) ? 0 : val / 100);
                        }}
                        className="h-12 text-lg font-black pr-10 rounded-2xl border-black/[0.08] focus:ring-primary focus:border-primary"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-sm">
                        %
                      </span>
                    </>
                  ) : (
                    <>
                      <Input
                        type="number"
                        min="0"
                        step="10"
                        value={editFlatFee}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEditFlatFee(isNaN(val) ? 0 : val);
                        }}
                        className="h-12 text-lg font-black pr-14 rounded-2xl border-black/[0.08] focus:ring-primary focus:border-primary"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">
                        {editingFee.fee_type === "send_per_km_rate" ? "₦/km" : "₦"}
                      </span>
                    </>
                  )}
                </div>

                {/* Quick Presets for Percentage or Fees */}
                {editingFee.fee_type === "send_rider_payout_rate" && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground mr-1">Presets:</span>
                    {[70, 75, 80, 85, 90].map((pct) => (
                      <Button
                        key={pct}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditRate(pct / 100)}
                        className={cn(
                          "h-6 px-2 text-[11px] rounded-lg font-bold",
                          Math.round(editRate * 100) === pct
                            ? "bg-primary text-white border-primary"
                            : "hover:bg-primary/10"
                        )}
                      >
                        {pct}%
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active / Inactive Status Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-black/[0.04]">
                <div>
                  <Label className="text-xs font-bold text-foreground block">Active Status</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {editIsActive ? "This fee is currently active and applied." : "Fee is disabled."}
                  </p>
                </div>
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-black/[0.05]">
              <Button
                variant="outline"
                onClick={() => setEditingFee(null)}
                className="h-11 rounded-2xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveModal}
                disabled={updateFeeMutation.isPending}
                className="h-11 rounded-2xl font-bold text-xs gap-1.5 bg-primary hover:bg-primary/95 text-white shadow-md shadow-primary/20"
              >
                <Save size={15} />
                <span>{updateFeeMutation.isPending ? "Saving..." : "Save Changes"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
