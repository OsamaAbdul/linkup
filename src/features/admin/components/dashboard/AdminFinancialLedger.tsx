import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { CreditCard, Landmark, Bike, TrendingUp, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * AdminFinancialLedger
 * Displays the aggregated financial sums for the entire platform.
 * Data source: get_admin_financial_ledger RPC (Aggregated from shipments.fee_breakdown)
 */
export function AdminFinancialLedger() {
  const { data: ledger, isLoading } = useQuery({
    queryKey: ["admin-financial-ledger"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_financial_ledger");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const items = [
    { 
        label: "Total Received", 
        value: ledger?.total_received, 
        icon: CreditCard, 
        color: "text-slate-900", 
        bg: "bg-slate-100",
        description: "Gross payment intake"
    },
    { 
        label: "Seller Portion", 
        value: ledger?.seller_total, 
        icon: Landmark, 
        color: "text-emerald-600", 
        bg: "bg-emerald-50",
        description: "Merchant product revenue"
    },
    { 
        label: "Logistics Cut", 
        value: ledger?.rider_total, 
        icon: Bike, 
        color: "text-orange-600", 
        bg: "bg-orange-50",
        description: "Delivery fees for riders"
    },
    { 
        label: "Growth Cut", 
        value: ledger?.promoter_total, 
        icon: TrendingUp, 
        color: "text-indigo-600", 
        bg: "bg-indigo-50",
        description: "Promoter commission"
    },
    { 
        label: "LinkUp Revenue", 
        value: ledger?.platform_total, 
        icon: ShieldCheck, 
        color: "text-primary", 
        bg: "bg-primary/10",
        description: "Final platform earnings"
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/80 backdrop-blur-sm group hover:shadow-md transition-all duration-300 border border-black/[0.03]">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center ${item.color} shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                <item.icon size={20} strokeWidth={2.5} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block leading-none">{item.label}</span>
                <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1 block">{item.description}</span>
              </div>
            </div>
            <p className={`text-2xl font-black tracking-tighter ${item.color}`}>
              ₦{(item.value || 0).toLocaleString()}
            </p>
          </div>
          <div className={`h-1 w-full ${item.bg} opacity-50`} />
        </Card>
      ))}
    </div>
  );
}
