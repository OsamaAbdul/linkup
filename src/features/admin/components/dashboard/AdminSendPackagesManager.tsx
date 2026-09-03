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

  // Metrics Calculation
  const metrics = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(
      (o) => o.status === "finding_rider" || o.status === "pending_payment"
    ).length;
    const active = orders.filter(
      (o) => o.status === "assigned_rider" || o.status === "pickup" || o.status === "on_the_way"
    ).length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.delivery_fee || 0), 0);

    return { total, pending, active, delivered, cancelled, totalRevenue };
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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

        {/* Total Delivery Volume (Revenue) */}
        <Card className="rounded-2xl border-purple-100 bg-purple-50/40 shadow-sm p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-800">
              Total Volume
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Banknote size={14} />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-900 font-heading mt-2">
            ₦{metrics.totalRevenue.toLocaleString()}
          </p>
          <span className="text-[10px] text-purple-700 font-bold">Total delivery value</span>
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
          <div className="flex items-center justify-between text-xs text-muted-foreground font-bold px-2">
            <span>
              Showing {filteredOrders.length} of {orders.length} packages
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredOrders.map((order) => {
              const packageDetails =
                typeof order.package_details === "string"
                  ? JSON.parse(order.package_details)
                  : order.package_details || {};

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.04] hover:border-[#E96F28]/30 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  {/* Top Row: Order ID, Status, Placed Date & Delivery Fee */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/[0.03]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 text-[#E96F28] flex items-center justify-center shrink-0">
                        <Package size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-foreground">
                            {order.id}
                          </span>
                          <button
                            onClick={() => handleCopy(order.id, "Order ID")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy ID"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-semibold mt-0.5">
                          <Clock size={12} />
                          <span>Placed: {formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {getStatusBadge(order.status)}
                      <div className="text-right pl-2 border-l border-black/[0.05]">
                        <span className="text-sm font-black text-foreground font-heading block">
                          ₦{Number(order.delivery_fee || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">
                          {order.payment_status === "paid" ? "Paid ✅" : "Unpaid ⏳"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: Route (Sender -> Recipient) & Package Details */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                    {/* Route Details */}
                    <div className="md:col-span-7 space-y-2.5 bg-gray-50/60 p-4 rounded-2xl border border-black/[0.02]">
                      {/* Pickup Point */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-[#E96F28] bg-white mt-1 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">
                              Pickup
                            </span>
                            <span className="font-bold text-foreground truncate">
                              {order.sender_name}
                            </span>
                            {order.sender_phone && (
                              <a
                                href={`tel:${order.sender_phone}`}
                                className="text-primary hover:underline font-semibold text-[11px] flex items-center gap-0.5"
                              >
                                <Phone size={10} />
                                <span>{order.sender_phone}</span>
                              </a>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-0.5 line-clamp-1">
                            {order.pickup_address}
                          </p>
                        </div>
                      </div>

                      {/* Drop-off Point */}
                      <div className="flex items-start gap-2.5 pt-2 border-t border-black/[0.04]">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-emerald-800">
                              Drop-off
                            </span>
                            <span className="font-bold text-foreground truncate">
                              {order.dropoff_recipient_name}
                            </span>
                            {order.dropoff_recipient_phone && (
                              <a
                                href={`tel:${order.dropoff_recipient_phone}`}
                                className="text-emerald-700 hover:underline font-semibold text-[11px] flex items-center gap-0.5"
                              >
                                <Phone size={10} />
                                <span>{order.dropoff_recipient_phone}</span>
                              </a>
                            )}
                          </div>
                          <p className="text-muted-foreground mt-0.5 line-clamp-1">
                            {order.dropoff_address}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Rider & Package Specs */}
                    <div className="md:col-span-5 flex flex-col justify-between gap-3 bg-gray-50/60 p-4 rounded-2xl border border-black/[0.02]">
                      {/* Assigned Rider */}
                      <div>
                        <span className="text-[10px] font-black uppercase text-muted-foreground block mb-1">
                          Assigned Rider
                        </span>
                        {order.rider_id ? (
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-9 h-9 rounded-full border border-primary/20 shrink-0">
                              <AvatarImage
                                src={order.rider_avatar || defaultRiderImg}
                                alt={order.rider_name || "Rider"}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {(order.rider_name || "R").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground text-xs truncate">
                                {order.rider_name || "Dispatch Rider"}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                {order.rider_phone && (
                                  <a
                                    href={`tel:${order.rider_phone}`}
                                    className="text-primary hover:underline"
                                  >
                                    {order.rider_phone}
                                  </a>
                                )}
                                <span>· {order.rider_vehicle || "Motorcycle"}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs py-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Awaiting rider pickup</span>
                          </div>
                        )}
                      </div>

                      {/* Package details preview */}
                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-black/[0.04]">
                        {packageDetails.weight_kg && (
                          <Badge variant="outline" className="text-[10px] font-bold bg-white">
                            ⚖️ {packageDetails.weight_kg <= 2 ? "Small (<2kg)" : `${packageDetails.weight_kg}kg`}
                          </Badge>
                        )}
                        {packageDetails.contents && (
                          <Badge variant="outline" className="text-[10px] font-bold bg-white truncate max-w-[140px]">
                            📦 {packageDetails.contents}
                          </Badge>
                        )}
                        {packageDetails.is_fragile && (
                          <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0">
                            Fragile ⚠️
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-muted-foreground font-semibold">
                      {order.delivered_at && (
                        <span className="text-emerald-700 font-bold">
                          Delivered: {formatDate(order.delivered_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Live Tracking Link */}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-black/[0.08] hover:border-primary text-foreground"
                      >
                        <a href={`/send/track/${order.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={13} className="text-primary" />
                          <span>Track Live</span>
                        </a>
                      </Button>

                      {/* Pop-up Details Modal Button */}
                      <Button
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                        className="h-9 px-3.5 rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/95 text-white shadow-sm shadow-primary/20"
                      >
                        <Eye size={14} />
                        <span>View Details</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

              {/* Package Details & Financials Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Package Specs */}
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Package Content</p>
                  <p className="font-bold text-foreground">
                    {(selectedOrder.package_details as any)?.contents || "Standard Parcel"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Weight: {(selectedOrder.package_details as any)?.weight_kg || 1} kg
                  </p>
                  {(selectedOrder.package_details as any)?.is_fragile && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                      Fragile Handling
                    </Badge>
                  )}
                </div>

                {/* Financials */}
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-black/[0.04] space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Delivery Charge</p>
                  <p className="text-base font-black text-foreground font-heading">
                    ₦{Number(selectedOrder.delivery_fee || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Status: <span className="font-bold text-foreground capitalize">{selectedOrder.payment_status}</span>
                  </p>
                  {selectedOrder.payment_ref && (
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      Ref: {selectedOrder.payment_ref}
                    </p>
                  )}
                </div>
              </div>

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
