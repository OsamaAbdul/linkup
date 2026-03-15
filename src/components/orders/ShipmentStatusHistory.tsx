import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Truck, Package, MapPin, ShieldCheck, Radio, AlertCircle } from "lucide-react";

interface ShipmentStatusHistoryProps {
  shipmentId: string;
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Order Placed", icon: Clock, color: "text-amber-500" },
  broadcast: { label: "Finding Courier", icon: Radio, color: "text-blue-400" },
  accepted: { label: "Courier Assigned", icon: CheckCircle2, color: "text-blue-500" },
  out_for_pickup: { label: "Heading to Seller", icon: Truck, color: "text-blue-600" },
  arrived_at_seller: { label: "Arrived at Seller", icon: MapPin, color: "text-indigo-500" },
  picked_up: { label: "Package Picked Up", icon: Package, color: "text-indigo-600" },
  out_for_delivery: { label: "On the Way to You", icon: Truck, color: "text-primary" },
  arrived_at_destination: { label: "Arrived at Your Location", icon: MapPin, color: "text-green-500" },
  delivered: { label: "Delivered", icon: ShieldCheck, color: "text-green-600" },
  completed: { label: "Order Finalized", icon: CheckCircle2, color: "text-green-700" },
  cancelled: { label: "Cancelled", icon: AlertCircle, color: "text-destructive" },
};

export function ShipmentStatusHistory({ shipmentId }: ShipmentStatusHistoryProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["shipment-history", shipmentId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("shipment_status_history")
        .select("id, status, changed_at")
        .eq("shipment_id", shipmentId)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; status: string; changed_at: string }[];
    },
    enabled: !!shipmentId,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="py-6 flex justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic text-center py-4">No status history yet.</p>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Status Timeline</p>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border" />

        <div className="space-y-0">
          {history.map((entry, idx) => {
            const meta = STATUS_META[entry.status] || { label: entry.status, icon: Clock, color: "text-muted-foreground" };
            const Icon = meta.icon;
            const isLast = idx === history.length - 1;

            return (
              <div key={entry.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                {/* Dot */}
                <div className={cn(
                  "absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 transition-all",
                  isLast
                    ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20"
                    : "bg-background border-border"
                )}>
                  <Icon size={12} strokeWidth={3} className={isLast ? "" : meta.color} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 ml-2">
                  <p className={cn(
                    "text-sm font-bold tracking-tight",
                    isLast ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {meta.label}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground/60 mt-0.5">
                    {format(new Date(entry.changed_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
