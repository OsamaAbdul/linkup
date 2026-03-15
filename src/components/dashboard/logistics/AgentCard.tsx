import React from "react";
import { motion } from "framer-motion";
import { Check, MapPin, Smartphone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface LogisticsAgent {
    id: string;
    display_name: string | null;
    full_name?: string;
    avatar_url: string | null;
    phone_number?: string;
    home_address?: string;
    vehicle_type?: string;
    latitude?: number;
    longitude?: number;
    distance?: number;
    isVerified: boolean;
    zone?: string;
}

interface AgentCardProps {
    agent: LogisticsAgent;
    index: number;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
    agent,
    index,
    isSelected,
    onSelect,
}) => {
    return (
        <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(agent.id)}
            className={cn(
                "relative w-full text-left p-6 rounded-[2.5rem] transition-all duration-500 border-2 group bg-white",
                isSelected
                    ? "bg-primary/[0.04] border-primary shadow-[0_20px_48px_-12px_rgba(var(--primary),0.2)]"
                    : "border-black/[0.03] hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
            )}
        >
            <div className="flex items-start gap-6">
                <div className="relative shrink-0">
                    <Avatar className="h-16 w-16 rounded-3xl border-2 border-white shadow-md group-hover:scale-105 transition-transform duration-500">
                        <AvatarImage src={agent.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">
                            {agent.display_name?.[0] || "?"}
                        </AvatarFallback>
                    </Avatar>
                    {agent.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md border-2 border-primary/5">
                            <div className="bg-primary rounded-full p-0.5">
                                <Check className="text-white" size={10} strokeWidth={4} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-bold text-lg text-foreground tracking-tight truncate leading-none pt-1">
                            {agent.full_name || agent.display_name || "Anonymous Agent"}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {agent.distance !== undefined && agent.distance < 999999 && (
                                <div className="bg-green-100 text-green-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <MapPin size={10} fill="currentColor" fillOpacity={0.2} /> Fast
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-[10px] font-black text-primary uppercase tracking-wider bg-primary/5 px-3 py-1 rounded-full">
                            {agent.vehicle_type || "Courier"}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                            {agent.zone?.split(" (")[0] || "Active"}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {agent.phone_number && (
                            <div className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <Smartphone size={14} className="text-primary/40" />
                                {agent.phone_number}
                            </div>
                        )}
                        {agent.home_address && (
                            <div className="flex items-start gap-2 text-[11px] font-medium text-muted-foreground/80 leading-snug">
                                <MapPin size={14} className="text-primary/30 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{agent.home_address}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 self-center",
                        isSelected
                            ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20"
                            : "bg-muted/40 text-muted-foreground/20 group-hover:bg-primary/5 group-hover:text-primary/40 group-hover:scale-105"
                    )}
                >
                    <Check size={24} strokeWidth={3} />
                </div>
            </div>
        </motion.button>
    );
};
