import React, { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Radio, Loader2, MapPin, Navigation, Users, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/shared/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PickupPointInput } from "./logistics/PickupPointInput";

// Dynamic zones fetched from DB based on city

interface ZoneBroadcastSelectorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onBroadcast: (zone: string, zoneId: string, pickupAddress: string, pickupTime: string) => void;
    isBroadcasting: boolean;
    defaultZone?: string;
    defaultPickupAddress?: string;
}

export function ZoneBroadcastSelector({
    open,
    onOpenChange,
    onBroadcast,
    isBroadcasting,
    defaultZone,
    defaultPickupAddress,
}: ZoneBroadcastSelectorProps) {
    const { profile } = useAuth();
    const [selectedZone, setSelectedZone] = useState<string>(defaultZone || "");
    const [pickupPoint, setPickupPoint] = useState<string>("");
    const [pickupTime, setPickupTime] = useState<string>("");

    const { data: zones = [] } = useQuery({
        queryKey: ["delivery-zones", (profile as any)?.city_id],
        queryFn: async () => {
            const cityId = (profile as any)?.city_id;
            const query = (supabase as any).from("delivery_zones").select("*").eq("is_active", true);

            if (cityId) {
                query.eq("city_id", cityId);
            } else {
                // Fallback to Abuja if profile doesn't have city_id yet
                const { data: abuja } = await (supabase as any).from("cities").select("id").eq("name", "Abuja").single();
                if (abuja) query.eq("city_id", abuja.id);
            }

            const { data, error } = await query.order("name");
            if (error) throw error;
            return (data as any[]).map(z => ({
                id: z.id,
                name: z.name,
                label: z.name.split(' (')[0],
                area: z.name.split(' (')[1]?.replace(')', '') || z.name,
                color: "bg-primary" // Default color
            })) || [];
        },
        enabled: open
    });

    useEffect(() => {
        if (open) {
            if (defaultPickupAddress) setPickupPoint(defaultPickupAddress);
            if (defaultZone) setSelectedZone(defaultZone);
            // Default to 2 hours from now
            const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
            setPickupTime(twoHoursFromNow.toISOString().slice(0, 16));
        }
    }, [defaultPickupAddress, defaultZone, open]);

    // Count agents in selected zone for confidence display
    const { data: zoneAgentCount = 0 } = useQuery({
        queryKey: ["zone-agent-count", selectedZone],
        queryFn: async () => {
            if (!selectedZone) return 0;
            const { count } = await (supabase as any)
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("zone", selectedZone);
            return count || 0;
        },
        enabled: !!selectedZone,
    });

    const handleConfirm = () => {
        const zoneObj = zones.find(z => z.name === selectedZone);
        if (selectedZone && zoneObj && pickupPoint && pickupTime) {
            onBroadcast(selectedZone, zoneObj.id, pickupPoint, pickupTime);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] rounded-xl p-0 overflow-hidden border-none shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] bg-background/95 backdrop-blur-3xl flex flex-col">
                {/* Top accent */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                <DialogHeader className="p-8 pb-4 shrink-0">
                    <div className="flex items-center gap-5">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-14 h-14 rounded-xl bg-primary shadow-[0_8px_24px_-4px_rgba(var(--primary),0.3)] flex items-center justify-center text-white shrink-0"
                        >
                            <Radio size={28} strokeWidth={2.5} />
                        </motion.div>
                        <div className="min-w-0 space-y-1">
                            <DialogTitle className="text-2xl font-bold tracking-tight">
                                Broadcast to Zone
                            </DialogTitle>
                            <DialogDescription className="text-muted-foreground/80 text-sm font-medium">
                                All agents in the selected zone will receive this mission.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-6 no-scrollbar">
                    <PickupPointInput value={pickupPoint} onChange={setPickupPoint} />

                    {/* Pickup Time */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                            <Clock size={12} strokeWidth={3} /> Pickup Window
                        </p>
                        <div className="relative">
                            <input
                                type="datetime-local"
                                value={pickupTime}
                                onChange={(e) => setPickupTime(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="w-full h-12 px-4 rounded-xl border border-black/10 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium pl-1">When will the package be ready for pickup?</p>
                    </div>

                    {/* Zone Selector */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                            <MapPin size={12} strokeWidth={3} /> Select Delivery Zone
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {zones.map((zone: any) => (
                                <motion.button
                                    key={zone.id}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setSelectedZone(zone.name)}
                                    className={cn(
                                        "relative p-4 rounded-xl border-2 text-left transition-all duration-200",
                                        selectedZone === zone.name
                                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                            : "border-black/5 bg-white hover:border-primary/30"
                                    )}
                                >
                                    <div className={cn("w-2 h-2 rounded-full mb-2", zone.color)} />
                                    <p className="font-black text-sm text-foreground">{zone.label}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium line-clamp-1">{zone.area}</p>
                                    {selectedZone === zone.name && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white"
                                        >
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                <path d="M2 5L4.5 7.5L8 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </motion.div>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Zone Stats Preview */}
                    <AnimatePresence>
                        {selectedZone && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Users size={16} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-foreground">{zoneAgentCount} Available Agents</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">In {selectedZone.split(' (')[0]}</p>
                                    </div>
                                </div>
                                <Badge className="bg-green-100 text-green-700 font-black text-[9px] uppercase tracking-wider border-none">
                                    <Navigation size={8} className="mr-1" /> Live Broadcast
                                </Badge>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="p-8 pt-4 bg-background border-t border-primary/5 shrink-0 flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto rounded-xl h-14 px-8 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted/50"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedZone || !pickupPoint || !pickupTime || isBroadcasting}
                        className="flex-1 rounded-xl h-14 px-12 text-xs font-black uppercase tracking-widest bg-primary shadow-[0_12px_32px_-8px_rgba(var(--primary),0.3)] active:scale-95 transition-all text-white disabled:opacity-50"
                    >
                        {isBroadcasting ? (
                            <Loader2 className="animate-spin mr-3" size={18} strokeWidth={3} />
                        ) : (
                            <Radio className="mr-3" size={18} strokeWidth={3} />
                        )}
                        {isBroadcasting ? "Broadcasting..." : "Broadcast Mission"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

