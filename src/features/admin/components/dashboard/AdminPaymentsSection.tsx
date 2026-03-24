import { useState } from "react";
import { PaymentReconciliationTab } from "@/features/dashboard/components/PaymentReconciliationTab";
import { AdminPayoutManager } from "./AdminPayoutManager";
import { Button } from "@/shared/components/ui/button";
import { CreditCard, Landmark } from "lucide-react";

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
          Order Payments
        </Button>
        <Button
          variant={activeTab === "payouts" ? "default" : "ghost"}
          size="sm"
          className="rounded-xl font-black text-[10px] uppercase tracking-widest px-6 h-10 transition-all"
          onClick={() => setActiveTab("payouts")}
        >
          <Landmark size={14} className="mr-2" />
          Seller Payouts
        </Button>
      </div>

      {activeTab === "orders" ? (
        <PaymentReconciliationTab isAdmin />
      ) : (
        <AdminPayoutManager />
      )}
    </div>
  );
}
