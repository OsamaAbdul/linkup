import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ShipmentCardV2 } from "./ShipmentCardV2";
import { MissionDetailsModalV2 } from "./MissionDetailsModalV2";
import { Search, Filter, Loader2, PackageX, TrendingUp } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

export function ShipmentFeedV2() {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [selectedShipment, setSelectedShipment] = useState<any>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const statusFilters = [
        { label: "All", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Delivered", value: "delivered" },
    ];

    const { data: shipments, isLoading } = useQuery({
        queryKey: ["logistics-shipments-v2", user?.id, filterStatus],
        queryFn: async () => {
            if (!user) return [];

            // 1. Fetch My Active Assignments
            let myAssignmentsQuery = (supabase as any)
                .from("shipments")
                .select("*")
                .eq("rider_id", user.id);

            if (filterStatus !== "all") {
                if (filterStatus === "active") {
                    myAssignmentsQuery = myAssignmentsQuery.in("status", ["accepted", "started", "arrived", "picked_up"]);
                } else if (filterStatus === "pending") {
                    myAssignmentsQuery = myAssignmentsQuery.eq("status", "accepted"); // Once accepted, they are pending start
                } else {
                    myAssignmentsQuery = myAssignmentsQuery.eq("status", filterStatus);
                }
            }

            const { data: myData } = await myAssignmentsQuery;

            // 2. Fetch Unassigned Broadcast Missions (Only if filtering for all or pending)
            let broadcastData: any[] = [];
            if (filterStatus === "all" || filterStatus === "pending") {
                // Get rider's zone from profile (passed via details or refetched)
                const { data: profile } = await (supabase as any)
                    .from("profiles")
                    .select("city_id, zone_id")
                    .eq("id", user.id)
                    .single();

                let broadcastQuery = (supabase as any)
                    .from("shipments")
                    .select("*")
                    .is("rider_id", null)
                    .eq("status", "pending");

                if (profile?.city_id) {
                    broadcastQuery = broadcastQuery.eq("city_id", profile.city_id);
                }

                const { data: bData } = await broadcastQuery;
                broadcastData = bData || [];
            }

            // Combine and sort
            const combined = [...(myData || []), ...broadcastData];
            return combined.sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        },
        enabled: !!user,
    });

    const filteredShipments = shipments?.filter((s: any) => 
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.pickup_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.delivery_address?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const { data: walletData } = useQuery({
        queryKey: ["rider-wallet-simple", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("wallets")
                .select("balance")
                .eq("user_id", user?.id)
                .maybeSingle();
            return data;
        },
        enabled: !!user,
    });

    return (
        <div className="space-y-6">
            {/* Search & Filter Header */}
            <div className="space-y-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-600 transition-colors" size={18} />
                    <Input 
                        placeholder="Search Order Ref. or Address..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-14 pl-12 rounded-2xl border-black/[0.04] bg-white shadow-sm focus:ring-blue-600 focus:border-blue-600 transition-all font-bold tracking-tight text-sm"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setFilterStatus(filter.value)}
                            className={cn(
                                "whitespace-nowrap px-6 py-2.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border",
                                filterStatus === filter.value
                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20"
                                    : "bg-white border-black/[0.04] text-muted-foreground hover:border-blue-200"
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-2xl bg-white border border-black/[0.04] h-10 w-10">
                        <Filter size={18} />
                    </Button>
                </div>
            </div>

            {/* Quick Stats Banner (Mobile) */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
                <div className="bg-blue-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-600/20">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Total Payout</p>
                    <p className="text-xl font-black tracking-tight">₦ {(walletData?.balance || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-black/[0.04] shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Active Deliveries</p>
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-black tracking-tight">{(filteredShipments?.filter((s:any) => s.status !== 'delivered' && s.status !== 'completed').length) || 0}</span>
                        <TrendingUp className="text-emerald-500" size={16} />
                    </div>
                </div>
            </div>

            {/* Shipment List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="animate-spin mb-4" size={32} />
                        <span className="font-black uppercase text-[10px] tracking-widest">Hydrating Payouts...</span>
                    </div>
                ) : filteredShipments?.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-black/[0.04]">
                        <PackageX size={48} strokeWidth={1} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                        <h3 className="text-lg font-black tracking-tight mb-1">No Deliveries Found</h3>
                        <p className="text-sm text-muted-foreground font-medium">Try adjusting your filters or search term.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                        {filteredShipments?.map((s: any) => (
                            <ShipmentCardV2 
                                key={s.id} 
                                shipment={s} 
                                onClick={() => {
                                    setSelectedShipment(s);
                                    setIsDetailsOpen(true);
                                }} 
                            />
                        ))}
                    </div>
                )}
            </div>

            <MissionDetailsModalV2 
                open={isDetailsOpen} 
                onOpenChange={setIsDetailsOpen} 
                shipment={selectedShipment} 
            />
        </div>
    );
}
