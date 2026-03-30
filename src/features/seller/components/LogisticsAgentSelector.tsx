import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Truck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

// Modular Components
import { PickupPointInput } from "./logistics/PickupPointInput";
import { ZoneSelector } from "./logistics/ZoneSelector";
import { AgentList } from "./logistics/AgentList";
import { LogisticsAgent } from "./logistics/AgentCard";

// Dynamic zones fetched from DB based on city

interface LogisticsAgentSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (agentId: string, pickupAddress: string) => void;
    isAssigning: boolean;
    destinationCoords?: { lat: number; lng: number };
    defaultZone?: string;
    defaultPickupAddress?: string;
}

export function LogisticsAgentSelector({
    open,
    onOpenChange,
    onSelect,
    isAssigning,
    destinationCoords,
    defaultZone,
    defaultPickupAddress,
}: LogisticsAgentSelectorProps) {
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [selectedZone, setSelectedZone] = useState<string>(
        defaultZone || "All Zones"
    );
    const [selectedZoneId, setSelectedZoneId] = useState<string>("");
    const [pickupPoint, setPickupPoint] = useState<string>("");

    // Fetch zones from DB
    const { data: zones = [] } = useQuery({
        queryKey: ["delivery-zones-agent-selector"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).from("delivery_zones").select("*").eq("is_active", true).order("name");
            if (error) throw error;
            return (data as any[]) || [];
        },
        enabled: open
    });

    const zoneOptions = ["All Zones", ...zones.map(z => z.name)];

    useEffect(() => {
        if (open) {
            if (defaultPickupAddress) setPickupPoint(defaultPickupAddress);
            if (defaultZone) setSelectedZone(defaultZone);
        }
    }, [defaultPickupAddress, defaultZone, open]);

    const { data: agents = [], isLoading, refetch } = useQuery({
        queryKey: ["logisticsAgents", selectedZone, destinationCoords, open],
        queryFn: async () => {
            console.log("Fetching logistics agents from network...", {
                destinationCoords,
                selectedZone,
            });

            // 1. Fetch ALL users with 'logistics' role
            const { data: roleData, error: roleError } = await (supabase as any)
                .from("user_roles")
                .select("user_id")
                .eq("role", "logistics");

            if (roleError) {
                console.error("Role Error:", roleError);
                throw roleError;
            }
            const logisticsUserIds = roleData?.map((r) => r.user_id) || [];
            if (logisticsUserIds.length === 0) return [];

            // 2. Filter for only VERIFIED agents
            const { data: verifiedData, error: verifiedError } = await (
                supabase as any
            )
                .from("logistics_verifications")
                .select("user_id, full_name, phone_number, home_address")
                .in("user_id", logisticsUserIds)
                .eq("status", "verified");

            if (verifiedError) {
                console.error("Verified Error:", verifiedError);
                throw verifiedError;
            }
            const verifiedUserIds = verifiedData?.map((v: any) => v.user_id) || [];
            if (verifiedUserIds.length === 0) return [];

            // 3. Fetch profiles and details for verified agents
            let profileQuery = (supabase as any)
                .from("profiles")
                .select("id, display_name, avatar_url, latitude, longitude, zone, zone_id")
                .in("id", verifiedUserIds);

            if (selectedZone !== "All Zones") {
                const zone = zones.find(z => z.name === selectedZone);
                if (zone) {
                    profileQuery = profileQuery.eq("zone_id", zone.id);
                } else {
                    profileQuery = profileQuery.eq("zone", selectedZone);
                }
            }

            const { data: profiles, error: profileError } = await profileQuery;
            if (profileError) {
                console.error("Profile Error:", profileError);
                throw profileError;
            }
            if (!profiles || profiles.length === 0) return [];

            // 4. Fetch additional details (vehicle type etc)
            const { data: detailsList, error: detailsError } = await (supabase as any)
                .from("logistics_details")
                .select("user_id, vehicle_type")
                .in(
                    "user_id",
                    profiles.map((p: any) => p.id)
                );

            if (detailsError) {
                console.error("Details Error:", detailsError);
                throw detailsError;
            }

            // 5. Final Formatting
            let formattedAgents = (profiles as any[]).map((profile) => {
                const verification = verifiedData.find((v: any) => v.user_id === profile.id);
                const details = (detailsList || []).find(
                    (d: any) => d.user_id === profile.id
                );
                return {
                    id: profile.id,
                    display_name: profile.display_name,
                    full_name: verification?.full_name,
                    avatar_url: profile.avatar_url,
                    phone_number: verification?.phone_number,
                    home_address: verification?.home_address,
                    vehicle_type: details?.vehicle_type,
                    latitude: profile.latitude,
                    longitude: profile.longitude,
                    isVerified: true,
                    zone: profile.zone,
                } as LogisticsAgent;
            });

            // Distance sorting
            if (destinationCoords?.lat && destinationCoords?.lng) {
                formattedAgents = formattedAgents
                    .map((agent) => {
                        if (agent.latitude && agent.longitude) {
                            const dist = Math.sqrt(
                                Math.pow(agent.latitude - destinationCoords.lat, 2) +
                                Math.pow(agent.longitude - destinationCoords.lng, 2)
                            );
                            return { ...agent, distance: dist };
                        }
                        return { ...agent, distance: 999999 };
                    })
                    .sort((a, b) => (a.distance || 0) - (b.distance || 0));
            }

            return formattedAgents;
        },
        enabled: open,
    });

    useEffect(() => {
        if (open) {
            refetch();
        }
    }, [open, refetch]);

    const handleConfirm = () => {
        if (selectedAgentId) {
            onSelect(selectedAgentId, pickupPoint);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] h-[85vh] max-h-[85vh] rounded-xl p-0 overflow-hidden border-none shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] bg-background/95 backdrop-blur-3xl flex flex-col">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                <DialogHeader className="p-8 pb-6 shrink-0 relative">
                    <div className="flex items-center gap-5">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-14 h-14 rounded-xl bg-primary shadow-[0_8px_24px_-4px_rgba(var(--primary),0.3)] flex items-center justify-center text-white shrink-0"
                        >
                            <Truck size={28} strokeWidth={2.5} />
                        </motion.div>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
                                Select Rider
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground/80 text-sm font-medium leading-tight">
                                Quality logistics for secure delivery
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 w-full overflow-y-auto px-8 pb-12 space-y-8 pt-2 no-scrollbar">
                        <div className="space-y-6">
                            <PickupPointInput value={pickupPoint} onChange={setPickupPoint} />

                            <ZoneSelector
                                zones={zoneOptions}
                                selectedZone={selectedZone}
                                onZoneSelect={setSelectedZone}
                            />

                            <AgentList
                                isLoading={isLoading}
                                agents={agents}
                                selectedAgentId={selectedAgentId}
                                onSelectAgent={setSelectedAgentId}
                                onResetZone={() => setSelectedZone("All Zones")}
                                showResetZone={selectedZone !== "All Zones"}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-8 pt-6 sm:pt-8 bg-background border-t border-primary/5 shrink-0 flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto rounded-xl h-14 px-8 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-all font-mono"
                    >
                        Decline
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedAgentId || isAssigning}
                        className="w-full sm:w-auto rounded-xl h-14 px-12 text-xs font-black uppercase tracking-[0.2em] shadow-[0_12px_32px_-8px_rgba(var(--primary),0.3)] bg-primary hover:shadow-[0_16px_40px_-10px_rgba(var(--primary),0.4)] active:scale-95 transition-all text-white disabled:opacity-50 disabled:shadow-none font-mono"
                    >
                        {isAssigning ? (
                            <Loader2 className="animate-spin mr-3" size={18} strokeWidth={3} />
                        ) : (
                            <Truck className="mr-3" size={18} strokeWidth={3} />
                        )}
                        Assign Rider
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

