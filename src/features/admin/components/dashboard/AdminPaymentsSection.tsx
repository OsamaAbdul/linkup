import { useState } from "react";
import { PaymentReconciliationTab } from "@/features/seller/components/PaymentReconciliationTab";
import { AdminPayoutManager } from "./AdminPayoutManager";
import { Button } from "@/shared/components/ui/button";
import { CreditCard, Landmark, Play, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function ForceReleaseButton() {
  const [loading, setLoading] = useState(false);

  const handleForceRelease = async () => {
    if (!confirm("Are you sure you want to PAY all sellers now? This will send all held money immediately without waiting for the 48-hour period.")) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("force_release_all_funds");
      
      if (error) throw error;
      
      const result = data as any;
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Failed to release funds");
      }
    } catch (error: any) {
      console.error("Force Release Error:", error);
      toast.error(error.message || "Failed to trigger force release");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 h-10 gap-2 font-bold"
      onClick={handleForceRelease}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <AlertTriangle size={14} />
      )}
      Pay All Sellers Now
    </Button>
  );
}

export default function AdminPaymentsSection() {
  const [activeTab, setActiveTab] = useState<"orders" | "payouts">("orders");

  return (
    <div className="space-y-10">
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
          Money Sent to Sellers
        </Button>
      </div>

      <div className="flex justify-end">
        <ForceReleaseButton />
      </div>

      {activeTab === "orders" ? (
        <PaymentReconciliationTab isAdmin />
      ) : (
        <AdminPayoutManager />
      )}
    </div>
  );
}
