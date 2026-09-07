import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  Package,
  Search,
  Truck,
  Bike,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  Layers,
  Sparkles,
  Calendar,
  Banknote,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Filter,
  User,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SendOrder } from "@/features/send/types";
import defaultRiderImg from "@/assets/default_rider.jpg";

type StatusFilter = "all" | "pending" | "active" | "delivered" | "cancelled";

export default function AdminSendPackagesManager() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<SendOrder | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 1. Query all LinkUp SEND packages
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-send-packages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("send_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SendOrder[];
    },
    refetchInterval: 15000, // Background poll every 15s
  });

  // 2. Realtime listener for package updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-send-orders-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "send_orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-send-packages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // 3. Query tracking logs for the selected order in detail modal
  const { data: trackingLogs = [] } = useQuery({
    queryKey: ["admin-send-tracking-logs", selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder?.id) return [];
      const { data, error } = await (supabase as any)
        .from("send_order_tracking_logs")
        .select("*")
        .eq("order_id", selectedOrder.id)
        .order("created_at", { ascending: true });

      if (error) return [];
      return data || [];
    },
    enabled: !!selectedOrder?.id,
  });

  // Mutation to update order status manually by admin
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      if (status === "pickup") updates.picked_up_at = new Date().toISOString();

      const { error } = await (supabase as any)
        .from("send_orders")
        .update(updates)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-send-packages"] });
      if (selectedOrder && selectedOrder.id === vars.orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: vars.status as any } : null));
      }
      toast.success(`Package status updated to ${vars.status}`);
    },
    onError: (err: any) => {
      toast.error("Failed to update status", { description: err.message });
    },
  });

  // Manual refresh trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 600);
    toast.success("Package list updated");
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Helper to calculate rider cut vs system cut for an order
  const getOrderCut = (order: SendOrder) => {
    const fee = Number(order.delivery_fee || 0);
    let riderCut = order.rider_payout_amount && Number(order.rider_payout_amount) > 0
      ? Number(order.rider_payout_amount)
      : Math.round(fee * 0.80);
    if (!order.rider_payout_amount && fee > 0) {
      riderCut = Math.min(fee, Math.max(1000, riderCut));
    }
    const systemCut = Math.max(0, fee - riderCut);
    return { fee, riderCut, systemCut };
  };

  // Metrics Calculation
  const metrics = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(
      (o) => o.status === "finding_rider" || o.status === "pending_payment"
    ).length;
    const active = orders.filter(
      (o) => o.status === "assigned_rider" || o.status === "pickup" || o.status === "on_the_way"
    ).length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered");
    const delivered = deliveredOrders.length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    
    // Gross delivery fees (all non-cancelled or all)
    const validOrders = orders.filter((o) => o.status !== "cancelled");
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0);
    const deliveredVolume = deliveredOrders.reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0);

    // Riders cut & System cut
    const totalRiderCut = validOrders.reduce((sum, o) => sum + getOrderCut(o).riderCut, 0);
    const totalSystemCut = validOrders.reduce((sum, o) => sum + getOrderCut(o).systemCut, 0);

    const deliveredRiderEarnings = deliveredOrders.reduce((sum, o) => sum + getOrderCut(o).riderCut, 0);
    const deliveredSystemEarnings = deliveredOrders.reduce((sum, o) => sum + getOrderCut(o).systemCut, 0);

    return { 
      total, 
      pending, 
      active, 
      delivered, 
      cancelled, 
      totalRevenue, 
      deliveredVolume,
      totalRiderCut, 
      totalSystemCut,
      deliveredRiderEarnings,
      deliveredSystemEarnings
    };
  }, [orders]);

  // Filtered orders based on status tab & search input
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Status Filter
      if (statusFilter === "pending") {
        if (order.status !== "finding_rider" && order.status !== "pending_payment") return false;
      } else if (statusFilter === "active") {
        if (
          order.status !== "assigned_rider" &&
          order.status !== "pickup" &&
          order.status !== "on_the_way"
        )
          return false;
      } else if (statusFilter === "delivered") {
        if (order.status !== "delivered") return false;
      } else if (statusFilter === "cancelled") {
        if (order.status !== "cancelled") return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesSender =
          order.sender_name?.toLowerCase().includes(q) ||
          order.sender_phone?.toLowerCase().includes(q) ||
          order.pickup_address?.toLowerCase().includes(q);
        const matchesRecipient =
          order.dropoff_recipient_name?.toLowerCase().includes(q) ||
          order.dropoff_recipient_phone?.toLowerCase().includes(q) ||
          order.dropoff_address?.toLowerCase().includes(q);
        const matchesRider =
          order.rider_name?.toLowerCase().includes(q) ||
          order.rider_phone?.toLowerCase().includes(q);

        return matchesId || matchesSender || matchesRecipient || matchesRider;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Reset to page 1 whenever filters, search, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "finding_rider":
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 font-extrabold text-[11px] gap-1.5 py-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
            <span>Finding Rider</span>
          </Badge>
        );
      case "pending_payment":
        return (
          <Badge className="bg-orange-50 text-orange-800 border-orange-300 font-extrabold text-[11px] py-0.5">
            Pending Payment
          </Badge>
        );
      case "assigned_rider":
        return (
          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-300 font-extrabold text-[11px] gap-1 py-0.5">
            <Bike size={12} />
            <span>Rider Assigned</span>
          </Badge>
        );
      case "pickup":
        return (
          <Badge className="bg-purple-50 text-purple-800 border-purple-300 font-extrabold text-[11px] gap-1 py-0.5">
            <MapPin size={12} />
            <span>At Pickup</span>
          </Badge>
        );
      case "on_the_way":
        return (
          <Badge className="bg-blue-50 text-blue-800 border-blue-300 font-extrabold text-[11px] gap-1.5 py-0.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
            <span>In Transit</span>
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold text-[11px] gap-1 py-0.5">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>Delivered</span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-50 text-red-800 border-red-300 font-extrabold text-[11px] gap-1 py-0.5">
            <XCircle size={12} className="text-red-600" />
            <span>Cancelled</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px]">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-black/[0.04] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E96F28]/10 text-[#E96F28] flex items-center justify-center font-bold shadow-sm">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span>LinkUp SEND</span>
                <span className="text-muted-foreground font-normal text-lg">· Dispatch Packages</span>
              </h2>
              <p className="text-muted-foreground font-medium text-xs sm:text-sm">
                Live monitoring, history, and status tracking for all customer package deliveries across Nigeria.
              </p>
            </div>
          </div>
        </div>

        {/* Refresh & Live Indicator */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-2xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">
              Live Realtime Sync
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            className="h-9 px-3 rounded-2xl border-black/[0.06] text-xs font-bold gap-1.5 bg-white hover:bg-gray-50"
          >
            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin text-primary")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Financial Split Cards: Riders Total Cut vs System Cut */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gross Volume */}
        <Card className="rounded-3xl border-black/[0.04] bg-white shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Total Delivery Volume
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#E96F28] flex items-center justify-center font-bold">
              <Banknote size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-foreground font-heading">
              ₦{metrics.totalRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">
              Total gross fees paid across all {metrics.total} packages
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-black/[0.03] flex items-center justify-between text-[11px] font-bold text-muted-foreground">
            <span>Delivered Volume:</span>
            <span className="text-foreground font-black">₦{metrics.deliveredVolume.toLocaleString()}</span>
          </div>
        </Card>

        {/* Riders Total Cut */}
        <Card className="rounded-3xl border-emerald-100 bg-emerald-50/40 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                Riders Total Cut (Earned)
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-extrabold px-1.5 py-0">
                80% Guarantee
              </Badge>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Bike size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-emerald-900 font-heading">
              ₦{metrics.totalRiderCut.toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-700/90 font-medium mt-1">
              Allocated earnings to courier dispatch riders
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px] font-bold text-emerald-800">
            <span>Realized (Delivered):</span>
            <span className="text-emerald-950 font-black">₦{metrics.deliveredRiderEarnings.toLocaleString()}</span>
          </div>
        </Card>

        {/* System Cut */}
        <Card className="rounded-3xl border-indigo-100 bg-indigo-50/40 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800">
                System Platform Cut (Net)
              </span>
              <Badge className="bg-indigo-100 text-indigo-800 border-none text-[9px] font-extrabold px-1.5 py-0">
                LinkUp Profit
              </Badge>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-black text-indigo-900 font-heading">
              ₦{metrics.totalSystemCut.toLocaleString()}
            </p>
            <p className="text-[11px] text-indigo-700/90 font-medium mt-1">
              Net platform commission retained by LinkUp
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-indigo-100 flex items-center justify-between text-[11px] font-bold text-indigo-800">
            <span>Realized (Delivered):</span>
            <span className="text-indigo-950 font-black">₦{metrics.deliveredSystemEarnings.toLocaleString()}</span>
          </div>
        </Card>
      </div>

      {/* Operational Status Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Packages */}
        <Card className="rounded-2xl border-black/[0.04] bg-white shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Total Packages
            </span>
            <div className="w-7 h-7 rounded-xl bg-orange-50 text-[#E96F28] flex items-center justify-center">
              <Package size={14} />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground font-heading mt-2">
            {metrics.total.toLocaleString()}
          </p>
          <span className="text-[10px] text-muted-foreground font-bold">All-time dispatch count</span>
        </Card>

        {/* Pending Rider */}
        <Card className="rounded-2xl border-amber-100 bg-amber-50/40 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">
              Pending Finding Rider
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-900 font-heading mt-2">
            {metrics.pending.toLocaleString()}
          </p>
          <span className="text-[10px] text-amber-700 font-bold">Awaiting rider pickup</span>
        </Card>

        {/* Active In Transit */}
        <Card className="rounded-2xl border-blue-100 bg-blue-50/40 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-800">
              Active In Transit
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Bike size={14} />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-900 font-heading mt-2">
            {metrics.active.toLocaleString()}
          </p>
          <span className="text-[10px] text-blue-700 font-bold">On the way with riders</span>
        </Card>

        {/* Delivered */}
        <Card className="rounded-2xl border-emerald-100 bg-emerald-50/40 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              Delivered
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-900 font-heading mt-2">
            {metrics.delivered.toLocaleString()}
          </p>
          <span className="text-[10px] text-emerald-700 font-bold">Completed successfully</span>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-black/[0.04] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <Button
              variant={statusFilter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="rounded-xl text-xs font-bold h-9 shrink-0 gap-1.5"
            >
              <span>All Packages</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {metrics.total}
              </Badge>
            </Button>

            <Button
              variant={statusFilter === "pending" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("pending")}
              className="rounded-xl text-xs font-bold h-9 shrink-0 gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Pending</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {metrics.pending}
              </Badge>
            </Button>

            <Button
              variant={statusFilter === "active" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("active")}
              className="rounded-xl text-xs font-bold h-9 shrink-0 gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Active</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {metrics.active}
              </Badge>
            </Button>

            <Button
              variant={statusFilter === "delivered" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("delivered")}
              className="rounded-xl text-xs font-bold h-9 shrink-0 gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Delivered</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {metrics.delivered}
              </Badge>
            </Button>

            <Button
              variant={statusFilter === "cancelled" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter("cancelled")}
              className="rounded-xl text-xs font-bold h-9 shrink-0 gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Cancelled</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {metrics.cancelled}
              </Badge>
            </Button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by ID, sender, recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-2xl text-xs bg-gray-50/70 border-black/[0.05] focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Packages List / Cards */}
      {isLoading ? (
        <div className="p-16 text-center text-muted-foreground font-black uppercase tracking-widest bg-white rounded-3xl border border-black/[0.04] animate-pulse">
          Loading Packages...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-black/[0.04] space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E96F28] flex items-center justify-center mx-auto">
            <Package size={28} />
          </div>
          <h3 className="text-base font-bold text-foreground">No Packages Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? `No packages match the search "${searchQuery}".`
              : `No packages found in the "${statusFilter}" category.`}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="rounded-xl text-xs"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top Pagination & Count Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground font-bold px-1 bg-white p-3 rounded-2xl border border-black/[0.04]">
            <div className="flex items-center gap-2">
              <span>
                Showing {filteredOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} –{" "}
                {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} packages
              </span>
              {filteredOrders.length !== orders.length && (
                <span className="text-[11px] font-normal text-muted-foreground/80">
                  (filtered from {orders.length} total)
                </span>
              )}
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Per Page:</span>
              <div className="inline-flex rounded-xl bg-gray-100 p-0.5 border border-black/[0.04]">
                {[10, 20, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                      pageSize === size
                        ? "bg-white text-foreground shadow-sm font-black"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Compact Click-to-Open Package Cards */}
          <div className="grid grid-cols-1 gap-3">
            {paginatedOrders.map((order) => {
              const packageDetails =
                typeof order.package_details === "string"
                  ? JSON.parse(order.package_details)
                  : order.package_details || {};

              const { fee, riderCut, systemCut } = getOrderCut(order);

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="group cursor-pointer bg-white rounded-2xl p-4 sm:p-4.5 border border-black/[0.05] hover:border-[#E96F28]/50 hover:shadow-md transition-all duration-200 space-y-3 relative"
                  title="Click to view full package details"
                >
                  {/* Top Row: ID, Placed Date, Status Badge, Gross Fee & Split Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-black/[0.04]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100/80 text-[#E96F28] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Package size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs sm:text-sm text-foreground truncate">
                            {order.id}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(order.id, "Order ID");
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                            title="Copy ID"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <Clock size={11} />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
                      {getStatusBadge(order.status)}

                      <div className="text-right pl-2 border-l border-black/[0.05]">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-sm sm:text-base font-black text-foreground font-heading">
                            ₦{fee.toLocaleString()}
                          </span>
                          <span
                            className={cn(
                              "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                              order.payment_status === "paid"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            {order.payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold mt-0.5 justify-end">
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                            Rider: ₦{riderCut.toLocaleString()}
                          </span>
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/50">
                            System: ₦{systemCut.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Route, Assigned Rider, Specs & Click Cue */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    {/* Route Overview */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0 text-muted-foreground text-[11px] font-medium">
                        <MapPin size={12} className="text-[#E96F28] shrink-0" />
                        <span
                          className="truncate max-w-[130px] sm:max-w-[180px] md:max-w-[220px]"
                          title={`Pickup: ${order.pickup_address || order.sender_name}`}
                        >
                          {order.pickup_address || order.sender_name || "Pickup"}
                        </span>
                        <ArrowRight size={12} className="text-muted-foreground/60 shrink-0 mx-0.5" />
                        <span
                          className="truncate max-w-[130px] sm:max-w-[180px] md:max-w-[220px] text-foreground font-semibold"
                          title={`Drop-off: ${order.dropoff_address || order.dropoff_recipient_name}`}
                        >
                          {order.dropoff_address || order.dropoff_recipient_name || "Drop-off"}
                        </span>
                      </div>
                    </div>

                    {/* Rider & Quick Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      {/* Assigned Rider indicator */}
                      {order.rider_name ? (
                        <div className="flex items-center gap-1.5 bg-gray-50/80 px-2 py-1 rounded-xl border border-black/[0.03]">
                          <Avatar className="w-5 h-5 rounded-full border border-primary/20 shrink-0">
                            <AvatarImage src={order.rider_avatar || defaultRiderImg} alt={order.rider_name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                              {order.rider_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-foreground text-[11px] truncate max-w-[110px]">
                            {order.rider_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>No Rider</span>
                        </span>
                      )}

                      {/* Package contents/weight tag */}
                      {packageDetails.contents && (
                        <Badge variant="outline" className="text-[10px] font-medium bg-gray-50/80 border-black/[0.04] truncate max-w-[110px] hidden md:inline-flex">
                          📦 {packageDetails.contents}
                        </Badge>
                      )}

                      {/* Quick Track Link */}
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 px-2 rounded-lg text-[11px] font-bold gap-1 text-muted-foreground hover:text-primary hover:bg-orange-50/50"
                      >
                        <a href={`/send/track/${order.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={11} className="text-primary" />
                          <span className="hidden sm:inline">Track</span>
                        </a>
                      </Button>

                      {/* Click to open badge cue */}
                      <div className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/5 group-hover:bg-primary group-hover:text-white px-2.5 py-1 rounded-xl transition-all">
                        <span>Details</span>
                        <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination Bar */}
          {totalPages > 1 && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-black/[0.04] shadow-sm">
              <div className="text-xs text-muted-foreground font-bold">
                Page <span className="text-foreground font-black">{currentPage}</span> of{" "}
                <span className="text-foreground font-black">{totalPages}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3 rounded-xl text-xs font-bold gap-1 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </Button>

                {/* Smart Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const hasGap = prevPage && p - prevPage > 1;
                      return (
                        <div key={p} className="flex items-center gap-1">
                          {hasGap && (
                            <span className="px-1 text-xs text-muted-foreground font-black">…</span>
                          )}
                          <Button
                            variant={currentPage === p ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              "w-8 h-8 p-0 rounded-xl text-xs font-bold transition-all",
                              currentPage === p
                                ? "bg-primary text-white hover:bg-primary/95 shadow-sm shadow-primary/20 border-primary"
                                : "bg-white text-muted-foreground hover:text-foreground hover:bg-gray-50 border-black/[0.08]"
                            )}
                          >
                            {p}
                          </Button>
                        </div>
                      );
                    })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-3 rounded-xl text-xs font-bold gap-1 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= DETAILED PACKAGE POP-UP MODAL ================= */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-white border border-black/[0.08] shadow-2xl space-y-4">
            <DialogHeader className="pb-3 border-b border-black/[0.05]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-100 text-[#E96F28] flex items-center justify-center">
                    <Package size={22} />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                      <span>Package Details</span>
                      <span className="font-mono text-sm font-normal text-muted-foreground">
                        ({selectedOrder.id})
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground font-medium">
                      Full order specifications, timeline tracking, and dispatch controls.
                    </DialogDescription>
                  </div>
                </div>
                {getStatusBadge(selectedOrder.status)}
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              {/* Route Card */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                  Pickup & Drop-off Route
                </p>

                {/* Sender */}
                <div className="flex items-start gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-white mt-1 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{selectedOrder.sender_name}</span>
                      <a href={`tel:${selectedOrder.sender_phone}`} className="text-primary font-semibold">
                        ({selectedOrder.sender_phone})
                      </a>
                    </div>
                    <p className="text-muted-foreground mt-0.5">{selectedOrder.pickup_address}</p>
                    {selectedOrder.pickup_directions && (
                      <p className="text-[11px] text-amber-700 mt-1 italic">
                        Note: "{selectedOrder.pickup_directions}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Recipient */}
                <div className="flex items-start gap-2.5 pt-2 border-t border-black/[0.04]">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {selectedOrder.dropoff_recipient_name}
                      </span>
                      <a
                        href={`tel:${selectedOrder.dropoff_recipient_phone}`}
                        className="text-emerald-700 font-semibold"
                      >
                        ({selectedOrder.dropoff_recipient_phone})
                      </a>
                    </div>
                    <p className="text-muted-foreground mt-0.5">{selectedOrder.dropoff_address}</p>
                    {selectedOrder.dropoff_directions && (
                      <p className="text-[11px] text-amber-700 mt-1 italic">
                        Note: "{selectedOrder.dropoff_directions}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Package Details & Financials */}
              {(() => {
                const selectedCut = selectedOrder ? getOrderCut(selectedOrder) : { fee: 0, riderCut: 0, systemCut: 0 };
                return (
                  <div className="space-y-3">
                    {/* Financial Cut Breakdown Card */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                            Financial Cut Breakdown
                          </p>
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-extrabold capitalize",
                            selectedOrder.payment_status === "paid" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                          )}>
                            {selectedOrder.payment_status === "paid" ? "Paid ✅" : "Pending Payment ⏳"}
                          </Badge>
                        </div>
                        {selectedOrder.payment_ref && (
                          <span className="font-mono text-[10px] text-muted-foreground truncate">
                            Ref: {selectedOrder.payment_ref}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-3 rounded-xl border border-black/[0.04] shadow-sm">
                          <span className="text-[10px] font-black uppercase text-muted-foreground block">
                            Customer Paid
                          </span>
                          <span className="text-base font-black text-foreground font-heading block mt-0.5">
                            ₦{selectedCut.fee.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-muted-foreground block font-medium mt-0.5">Gross Fee</span>
                        </div>

                        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/80">
                          <span className="text-[10px] font-black uppercase text-emerald-800 block">
                            Rider Cut
                          </span>
                          <span className="text-base font-black text-emerald-900 font-heading block mt-0.5">
                            ₦{selectedCut.riderCut.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-extrabold text-emerald-700 block uppercase mt-0.5">
                            {selectedOrder.rider_payout_status === "released"
                              ? "Released to Wallet ✅"
                              : selectedOrder.rider_payout_status === "held"
                              ? "Held in Escrow ⏳"
                              : selectedOrder.status === "delivered"
                              ? "Delivered"
                              : "Pending Delivery"}
                          </span>
                        </div>

                        <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
                          <span className="text-[10px] font-black uppercase text-indigo-800 block">
                            System Cut
                          </span>
                          <span className="text-base font-black text-indigo-900 font-heading block mt-0.5">
                            ₦{selectedCut.systemCut.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-extrabold text-indigo-700 block uppercase mt-0.5">
                            LinkUp Margin
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Package Specs */}
                    <div className="p-3.5 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-1.5">
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Package Content</p>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground">
                          {(selectedOrder.package_details as any)?.contents || "Standard Parcel"}
                        </p>
                        {(selectedOrder.package_details as any)?.is_fragile && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            Fragile Handling
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Declared Weight: {(selectedOrder.package_details as any)?.weight_kg || 1} kg
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Assigned Rider Box */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Assigned Courier Rider</p>
                {selectedOrder.rider_id ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 rounded-full border border-primary/20">
                        <AvatarImage
                          src={selectedOrder.rider_avatar || defaultRiderImg}
                          alt={selectedOrder.rider_name || "Rider"}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {(selectedOrder.rider_name || "R").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-foreground">{selectedOrder.rider_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {selectedOrder.rider_phone || "No phone"} · {selectedOrder.rider_vehicle || "Motorcycle"}
                        </p>
                      </div>
                    </div>
                    {selectedOrder.rider_phone && (
                      <Button asChild variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1">
                        <a href={`tel:${selectedOrder.rider_phone}`}>
                          <Phone size={12} className="text-primary" />
                          <span>Call Rider</span>
                        </a>
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No rider assigned yet. System is searching for nearby couriers.</p>
                )}
              </div>

              {/* Tracking Logs Timeline */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                  Tracking Event History
                </p>
                {trackingLogs.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No tracking events recorded yet.</p>
                ) : (
                  <div className="space-y-2 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {trackingLogs.map((log: any) => (
                      <div key={log.id} className="relative space-y-0.5">
                        <span className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-white" />
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground capitalize">
                            {log.notes || log.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin Override Controls */}
              <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200/60 space-y-2">
                <p className="text-[10px] font-black uppercase text-[#E96F28] tracking-wider">
                  Admin Dispatch Controls
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedOrder.status !== "delivered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatusMutation.isPending}
                      onClick={() =>
                        updateStatusMutation.mutate({ orderId: selectedOrder.id, status: "delivered" })
                      }
                      className="h-8 text-xs font-bold rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      <CheckCircle2 size={13} className="mr-1 text-emerald-600" />
                      Force Mark Delivered
                    </Button>
                  )}

                  {selectedOrder.status !== "cancelled" && selectedOrder.status !== "delivered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => {
                        if (confirm("Are you sure you want to cancel this package delivery?")) {
                          updateStatusMutation.mutate({ orderId: selectedOrder.id, status: "cancelled" });
                        }
                      }}
                      className="h-8 text-xs font-bold rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <XCircle size={13} className="mr-1" />
                      Cancel Delivery
                    </Button>
                  )}

                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs font-bold text-primary ml-auto"
                  >
                    <a href={`/send/track/${selectedOrder.id}`} target="_blank" rel="noopener noreferrer">
                      Open Public Tracking <ExternalLink size={12} className="ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-black/[0.05]">
              <Button
                variant="outline"
                onClick={() => setSelectedOrder(null)}
                className="h-10 rounded-2xl font-bold text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
