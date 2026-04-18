import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  CreditCard, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Search, Eye, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentReconciliationTabProps {
  isAdmin?: boolean;
}

const statusColors: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-blue-100 text-blue-800",
};

export function PaymentReconciliationTab({ isAdmin = false }: PaymentReconciliationTabProps) {
  const { user, getToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["payment-reconciliation", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, total_amount, status, payment_status, payment_ref, payment_method, created_at, buyer_id, seller_id, items, settlement_status")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("seller_id", user!.id);
      }

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!user,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ orderId, paymentRef, totalKobo }: { orderId: string; paymentRef: string; totalKobo: number }) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("verify-paystack", {
        body: { reference: paymentRef, amount_kobo: totalKobo },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) throw new Error(error.message || "Verification call failed");
      if (!data?.verified) throw new Error(data?.error || "Payment not verified");

      // Update order payment_status to paid
      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);

      if (updateError) throw updateError;
      return data;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment-reconciliation"] });
      toast.success("Payment verified and reconciled successfully");
      const order = orders.find((o) => o.id === variables.orderId);
      if (order) {
        await supabase.from("notifications").insert([
          { user_id: order.buyer_id, type: "payment", message: `Payment for order #${order.id.slice(0, 8)} has been verified and marked as paid.` },
          { user_id: order.seller_id, type: "payment", message: `Payment for order #${order.id.slice(0, 8)} has been verified and reconciled.` },
        ]);
      }
      setSelectedOrder(null);
    },
    onError: (err: any) => {
      toast.error("Reconciliation failed: " + err.message);
    },
  });

  const manualReconcileMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ payment_status: newStatus })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment-reconciliation"] });
      toast.success("Payment status updated manually");
      const order = orders.find((o) => o.id === variables.orderId);
      if (order) {
        const statusLabel = variables.newStatus.replace(/_/g, " ");
        await supabase.from("notifications").insert([
          { user_id: order.buyer_id, type: "payment", message: `Payment for order #${order.id.slice(0, 8)} has been manually updated to "${statusLabel}".` },
          { user_id: order.seller_id, type: "payment", message: `Payment for order #${order.id.slice(0, 8)} has been manually reconciled as "${statusLabel}".` },
        ]);
      }
      setSelectedOrder(null);
    },
    onError: (err: any) => toast.error("Update failed: " + err.message),
  });

  const filtered = orders.filter((o) => {
    const matchesSearch =
      !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.payment_ref || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === "all" || o.payment_status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: orders.length,
    paid: orders.filter((o) => o.payment_status === "paid").length,
    pending: orders.filter((o) => o.payment_status === "pending").length,
    failed: orders.filter((o) => o.payment_status === "failed").length,
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground font-bold bg-background rounded-xl">
        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
        Loading payment data...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Financial Operations</p>
        <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Payment Tracking</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: stats.total, icon: CreditCard, color: "text-foreground" },
          { label: "Paid", value: stats.paid, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Pending", value: stats.pending, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl border-none shadow-sm bg-background p-6">
            <div className="flex items-center gap-3 mb-2">
              <s.icon size={18} className={s.color} />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{s.label}</span>
            </div>
            <p className={cn("text-3xl font-black tracking-tighter", s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Order ID or Payment Ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 rounded-xl h-12 border-muted/30 bg-background font-medium"
          />
        </div>
        <div className="flex gap-2">
          {["all", "paid", "pending", "failed"].map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              size="sm"
              className="rounded-xl text-[10px] font-black uppercase tracking-widest"
              onClick={() => setFilterStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <Card className="border-none shadow-sm rounded-xl bg-background overflow-hidden max-w-full">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-muted/20 bg-muted/5">
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[100px]">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[100px]">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[100px]">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[100px]">Method</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[150px]">Payment Ref</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[120px]">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest min-w-[100px]">Payout Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right min-w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-muted-foreground font-bold">
                    No orders match your criteria
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/5 transition-colors group">
                    <td className="px-6 py-5 font-mono text-xs font-bold text-primary">#{o.id.slice(0, 8)}</td>
                    <td className="px-6 py-5 text-xs font-medium text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 font-black text-sm">₦{(o.total_amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-5">
                      <Badge variant="outline" className="rounded-full text-[9px] font-black uppercase tracking-widest border-muted/30 whitespace-nowrap">
                        {o.payment_method || "direct"}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 font-mono text-[11px] text-muted-foreground truncate max-w-[150px]">
                      {o.payment_ref || <span className="italic opacity-50">none</span>}
                    </td>
                    <td className="px-6 py-5">
                      <Badge className={cn(
                        "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm whitespace-nowrap",
                        statusColors[o.payment_status || "pending"] || "bg-muted text-muted-foreground"
                      )}>
                        {(o.payment_status || "pending").replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant="outline" className={cn(
                        "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest whitespace-nowrap",
                        o.settlement_status === 'settled' ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                        o.settlement_status === 'pending' ? "border-amber-200 text-amber-700 bg-amber-50" :
                        "border-muted text-muted-foreground"
                      )}>
                        {o.settlement_status || 'none'}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl group-hover:bg-background group-hover:shadow-sm"
                        onClick={() => setSelectedOrder(o)}
                      >
                        <Eye size={18} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail / Reconcile Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg rounded-xl border-none shadow-2xl overflow-hidden p-0 bg-background">
          <div className="bg-primary/5 p-8 border-b border-muted/20">
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-primary text-primary-foreground border-none font-black text-[9px] uppercase tracking-widest rounded-full py-1">
                  Payment Details
                </Badge>
                <Badge variant="outline" className="border-primary/20 text-primary font-bold text-[10px] rounded-xl px-3 py-1">
                  #{selectedOrder?.id?.slice(0, 8)}
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black text-foreground">
                Payment Details
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground">
                View payment details and manually reconcile if needed.
              </DialogDescription>
            </DialogHeader>
          </div>
          {selectedOrder && (
            <div className="px-8 pb-8 space-y-6 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/5 p-4 rounded-xl border border-muted/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
                  <p className="text-xl font-black text-foreground">₦{(selectedOrder.total_amount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-muted/5 p-4 rounded-xl border border-muted/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Method</p>
                  <p className="text-xl font-black text-foreground capitalize">{selectedOrder.payment_method || "direct"}</p>
                </div>
              </div>

              <div className="bg-muted/5 p-4 rounded-xl border border-muted/20">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Payment Reference</p>
                <p className="font-mono text-sm font-bold text-foreground break-all">
                  {selectedOrder.payment_ref || <span className="italic text-muted-foreground">No reference recorded</span>}
                </p>
              </div>

              <div className="bg-muted/5 p-4 rounded-xl border border-muted/20">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Current Status</p>
                <Badge className={cn(
                  "rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest border-none shadow-sm",
                  statusColors[selectedOrder.payment_status || "pending"] || "bg-muted text-muted-foreground"
                )}>
                  {(selectedOrder.payment_status || "pending").replace(/_/g, " ")}
                </Badge>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t border-muted/20">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Payment Verification Actions</p>

                {/* Re-verify via Paystack */}
                {selectedOrder.payment_ref && selectedOrder.payment_status !== "paid" && (
                  <Button
                    className="w-full rounded-xl h-12 font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                    onClick={() =>
                      verifyMutation.mutate({
                        orderId: selectedOrder.id,
                        paymentRef: selectedOrder.payment_ref,
                        totalKobo: (selectedOrder.total_amount || 0) * 100,
                      })
                    }
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Re-verify with Payment Gateway
                  </Button>
                )}

                {/* Manual status updates */}
                {selectedOrder.payment_status !== "paid" && (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-12 font-black text-xs uppercase tracking-widest gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() =>
                      manualReconcileMutation.mutate({ orderId: selectedOrder.id, newStatus: "paid" })
                    }
                    disabled={manualReconcileMutation.isPending}
                  >
                    <CheckCircle2 size={16} />
                    Mark as Paid (Manual)
                  </Button>
                )}

                {selectedOrder.payment_status !== "failed" && (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl h-12 font-black text-xs uppercase tracking-widest gap-2 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() =>
                      manualReconcileMutation.mutate({ orderId: selectedOrder.id, newStatus: "failed" })
                    }
                    disabled={manualReconcileMutation.isPending}
                  >
                    <XCircle size={16} />
                    Mark as Failed
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

