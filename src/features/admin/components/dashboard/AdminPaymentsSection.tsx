import { useState } from "react";
import { PaymentReconciliationTab } from "@/features/seller/components/PaymentReconciliationTab";
import { AdminPayoutManager } from "./AdminPayoutManager";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import { CreditCard, Landmark, Play, AlertTriangle, Loader2, Bike, Sparkles, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

function AutomatedReleaseDropdown() {
  const [loadingSendRider, setLoadingSendRider] = useState(false);
  const [loadingAutoEscrow, setLoadingAutoEscrow] = useState(false);
  const [loadingForce, setLoadingForce] = useState(false);
  const queryClient = useQueryClient();

  const handleSendRiderRelease = async () => {
    try {
      setLoadingSendRider(true);
      const { data, error } = await (supabase as any).rpc("process_send_rider_payout_releases");

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(
          `Send Rider Payouts: ${result.released_count} package(s) released (₦${Number(
            result.total_amount || 0
          ).toLocaleString()}).`
        );
        queryClient.invalidateQueries();
      } else {
        toast.error("Failed to run Send rider payout release");
      }
    } catch (error: any) {
      console.error("Send Rider Release Error:", error);
      toast.error(error.message || "Failed to trigger Send rider release");
    } finally {
      setLoadingSendRider(false);
    }
  };

  const handleAutoRelease = async () => {
    try {
      setLoadingAutoEscrow(true);
      const { data, error } = await (supabase as any).rpc("process_automated_escrow_releases");

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(
          `Escrow check finished: ${result.orders_completed} orders auto-finalized, ${result.settlements_released} settlements credited to wallets.`
        );
        queryClient.invalidateQueries();
      } else {
        toast.error("Failed to run automated escrow release");
      }
    } catch (error: any) {
      console.error("Auto Release Error:", error);
      toast.error(error.message || "Failed to trigger auto-release");
    } finally {
      setLoadingAutoEscrow(false);
    }
  };

  const handleForceRelease = async () => {
    if (
      !confirm(
        "Are you sure you want to PAY all sellers now? This will send all held money immediately without waiting for the escrow holding period."
      )
    ) {
      return;
    }

    try {
      setLoadingForce(true);
      const { data, error } = await (supabase as any).rpc("force_release_all_funds");

      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries();
      } else {
        toast.error("Failed to release funds");
      }
    } catch (error: any) {
      console.error("Force Release Error:", error);
      toast.error(error.message || "Failed to trigger force release");
    } finally {
      setLoadingForce(false);
    }
  };

  const isAnyLoading = loadingSendRider || loadingAutoEscrow || loadingForce;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl h-11 px-4 font-bold text-xs gap-2 bg-white hover:bg-gray-50 border-black/[0.08] shadow-sm"
          disabled={isAnyLoading}
        >
          {isAnyLoading ? (
            <Loader2 size={15} className="animate-spin text-primary" />
          ) : (
            <Sparkles size={15} className="text-primary" />
          )}
          <span>Automated Releases</span>
          <ChevronDown size={14} className="text-muted-foreground ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 p-2 rounded-2xl shadow-xl bg-white border border-black/[0.06] space-y-1"
      >
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1">
          Settlement Automation Triggers
        </DropdownMenuLabel>

        {/* 1. Release Send Rider Payouts */}
        <DropdownMenuItem
          onClick={handleSendRiderRelease}
          disabled={loadingSendRider}
          className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
            {loadingSendRider ? <Loader2 size={14} className="animate-spin" /> : <Bike size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-foreground">Release Send Rider Payouts</p>
            <p className="text-[10px] text-muted-foreground font-medium">
              Run hourly check now to release Send rider earnings held past delay
            </p>
          </div>
        </DropdownMenuItem>

        {/* 2. Run Escrow Release Check */}
        <DropdownMenuItem
          onClick={handleAutoRelease}
          disabled={loadingAutoEscrow}
          className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-blue-50 focus:bg-blue-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
            {loadingAutoEscrow ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-foreground">Run Escrow Release Check</p>
            <p className="text-[10px] text-muted-foreground font-medium">
              Auto-finalize delivered marketplace orders &amp; credit seller escrow
            </p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-black/[0.05]" />

        {/* 3. Force Pay All Sellers Now */}
        <DropdownMenuItem
          onClick={handleForceRelease}
          disabled={loadingForce}
          className="flex items-start gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-amber-50 focus:bg-amber-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            {loadingForce ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-amber-900">Pay All Sellers Now (Override)</p>
            <p className="text-[10px] text-amber-700 font-medium">
              Instantly move all held seller escrow to available balance
            </p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AdminPaymentsSection() {
  const [activeTab, setActiveTab] = useState<"orders" | "payouts">("orders");

  return (
    <div className="space-y-8">
      {/* Top Header: Tabs & Automated Releases Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-black/[0.03] w-fit shadow-xl shadow-black/[0.02]">
          <Button
            variant={activeTab === "orders" ? "default" : "ghost"}
            size="sm"
            className="rounded-xl font-black text-[10px] uppercase tracking-widest px-6 h-10 transition-all"
            onClick={() => setActiveTab("orders")}
          >
            <CreditCard size={14} className="mr-2" />
            Money Received
          </Button>
          <Button
            variant={activeTab === "payouts" ? "default" : "ghost"}
            size="sm"
            className="rounded-xl font-black text-[10px] uppercase tracking-widest px-6 h-10 transition-all"
            onClick={() => setActiveTab("payouts")}
          >
            <Landmark size={14} className="mr-2" />
            Payouts Request
          </Button>
        </div>

        <AutomatedReleaseDropdown />
      </div>

      {activeTab === "orders" ? (
        <PaymentReconciliationTab isAdmin />
      ) : (
        <AdminPayoutManager />
      )}
    </div>
  );
}
