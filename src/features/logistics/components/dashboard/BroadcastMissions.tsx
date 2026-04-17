import React from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { 
    Radio, 
    MapPin, 
    Navigation, 
    Eye, 
    Zap, 
    Clock, 
    AlertTriangle 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getPickupAddress, getDeliveryAddress, getBuyerContact, calculateDistance } from "../../utils/logistics-utils";

interface BroadcastMissionsProps {
    missions: any[];
    isKycVerified: boolean;
    kycStatus: string;
    profile: any;
    onVerificationClick?: () => void;
    onClaimMission: (id: string) => void;
    onViewDetails: (mission: any) => void;
    isClaiming: boolean;
}

export function BroadcastMissions({
    missions,
    isKycVerified,
    kycStatus,
    profile,
    onVerificationClick,
    onClaimMission,
    onViewDetails,
    isClaiming
}: BroadcastMissionsProps) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E96F28]/10 flex items-center justify-center text-[#E96F28]">
                    <Radio size={16} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tight">Missions Pool</h2>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Available to all partners in your zone</p>
                </div>
                {missions.length > 0 && (
                    <span className="ml-auto px-3 py-1 rounded-full bg-[#E96F28] text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                        {missions.length} Live
                    </span>
                )}
            </div>

            {/* KYC Warnings */}
            {!isKycVerified && kycStatus !== "pending" && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col md:flex-row items-center gap-6 text-center md:text-left shadow-sm mb-8"
                >
                    <div className="w-16 h-16 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 border border-amber-500/10">
                        <AlertTriangle size={32} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-black text-amber-900 uppercase tracking-widest leading-none">Official ID Needed</p>
                        <p className="text-xs font-medium text-amber-700 leading-relaxed max-w-lg">
                            Please verify your identity in the Verify Profile tab before you can accept new missions.
                        </p>
                    </div>
                    <Button
                        onClick={onVerificationClick}
                        className="rounded-xl h-12 px-8 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-600/20 active:scale-95 transition-all w-full md:w-auto"
                    >
                        Verify Identity
                    </Button>
                </motion.div>
            )}

            <AnimatePresence mode="popLayout">
                {!profile?.zone_id && !profile?.zone ? (
                    <motion.div
                        key="no-zone"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-10 text-center border-2 border-dashed border-amber-500/20 rounded-xl bg-amber-50/30 text-amber-900 text-sm font-medium"
                    >
                        <MapPin size={32} strokeWidth={1} className="mx-auto mb-3 text-amber-500/40" />
                        <p className="font-black uppercase tracking-widest text-[10px] mb-1">Zone Not Configured</p>
                        <p className="opacity-80">Please set your operational zone in Settings to start receiving missions.</p>
                    </motion.div>
                ) : missions.length === 0 ? (
                    <motion.div
                        key="no-missions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-10 text-center border-2 border-dashed border-black/5 rounded-xl text-muted-foreground text-sm font-medium"
                    >
                        <Radio size={32} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
                        <p className="font-bold">Looking for missions in {profile?.zone?.split(" (")[0] || "your area"}...</p>
                        <p className="text-[10px] opacity-60">Refreshing automatically to find you more work.</p>
                    </motion.div>
                ) : (
                    <div className="grid gap-4">
                        {missions.map((mission: any) => {
                            const buyer = getBuyerContact(mission);
                            const pickupAddr = getPickupAddress(mission);
                            const deliveryAddr = getDeliveryAddress(mission);
                            
                            // Calculate Distance
                            const dist = calculateDistance(
                                mission.pickup_latitude, mission.pickup_longitude,
                                mission.buyer_latitude, mission.buyer_longitude
                            );

                            const isOutOfZone = profile?.zone && mission.zone && 
                                               profile.zone.trim().toLowerCase() !== mission.zone.trim().toLowerCase();

                            return (
                                <motion.div
                                    key={mission.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    className={cn(
                                        "rounded-xl border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all duration-300",
                                        isOutOfZone 
                                            ? "border-orange-500/30 bg-gradient-to-r from-orange-500/5 to-transparent shadow-orange-500/5" 
                                            : "border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent shadow-orange-500/5"
                                    )}
                                >
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-[#E96F28] font-black text-[11px] font-mono shrink-0">
                                            #{mission.order_id?.slice(-6).toUpperCase()}
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={cn(
                                                    "font-black text-[9px] uppercase tracking-wider border-none",
                                                    isOutOfZone ? "bg-orange-100 text-orange-700" : "bg-orange-100 text-orange-700"
                                                )}>
                                                    <Radio size={8} className="mr-1" /> {isOutOfZone ? "Global Mission" : "Local Mission"}
                                                </Badge>
                                                {isOutOfZone && (
                                                    <Badge className="bg-orange-500 text-white font-black text-[9px] uppercase tracking-wider border-none animate-pulse">
                                                        Bonus Active
                                                    </Badge>
                                                )}
                                                {dist > 0 && (
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase border-black/5 bg-white/50">
                                                        {dist.toFixed(1)} KM
                                                    </Badge>
                                                )}
                                                <Badge className="bg-green-600 text-white font-black text-[9px] uppercase tracking-wider border-none px-3 shadow-sm shadow-green-600/10">
                                                    ₦{(mission.delivery_fee_amount || mission.delivery_fee || 0).toLocaleString()} Cut
                                                </Badge>
                                                <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">
                                                    {mission.zone?.split(" (")[0]}
                                                </span>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="shrink-0 mt-1">
                                                    <MapPin size={12} className="text-orange-500" />
                                                </div>
                                                <p className="text-sm font-black text-foreground line-clamp-1">
                                                    Pickup: {pickupAddr}
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="shrink-0 mt-1">
                                                    <Navigation size={12} className="text-[#E96F28]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-foreground line-clamp-1">
                                                        {deliveryAddr}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-[#E96F28] mt-0.5">
                                                        {buyer.name} • {buyer.phone}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-xl h-11 px-4 hover:bg-orange-50 hover:text-orange-600 font-bold hidden sm:flex"
                                            onClick={() => onViewDetails(mission)}
                                        >
                                            <Eye size={16} className="mr-2" /> Details
                                        </Button>
                                        <Button
                                            className={cn(
                                                "rounded-xl h-12 px-8 font-black text-[10px] uppercase tracking-widest gap-2 active:scale-95 transition-all shrink-0 shadow-lg",
                                                isKycVerified ? "bg-[#E96F28] hover:bg-orange-700 text-white shadow-orange-600/20" : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                                            )}
                                            onClick={() => isKycVerified && onClaimMission(mission.id)}
                                            disabled={isClaiming || (kycStatus === "pending" && !isKycVerified)}
                                        >
                                            {isKycVerified ? (
                                                <>
                                                    <Zap size={14} strokeWidth={3} />
                                                    Accept Mission
                                                </>
                                            ) : (
                                                <>
                                                    <Clock size={14} strokeWidth={3} />
                                                    {kycStatus === "pending" ? "Reviewing Profile" : "ID Needed"}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </AnimatePresence>
        </section>
    );
}
