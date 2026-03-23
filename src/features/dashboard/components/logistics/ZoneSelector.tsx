import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ZoneSelectorProps {
    zones: string[];
    selectedZone: string;
    onZoneSelect: (zone: string) => void;
}

export const ZoneSelector: React.FC<ZoneSelectorProps> = ({
    zones,
    selectedZone,
    onZoneSelect,
}) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                    Operational Zones
                </span>
                <div className="h-[1px] flex-1 mx-4 bg-gradient-to-r from-primary/10 to-transparent" />
            </div>

            <div className="relative group">
                <div
                    className="flex gap-2.5 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 mask-fade-edges"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                    {zones.map((zone) => (
                        <motion.button
                            key={zone}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onZoneSelect(zone)}
                            className={cn(
                                "px-5 py-2.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all border-2 shrink-0",
                                selectedZone === zone
                                    ? "bg-primary text-white border-primary shadow-[0_8px_16px_-4px_rgba(var(--primary),0.25)]"
                                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                            )}
                        >
                            {zone}
                        </motion.button>
                    ))}
                </div>
            </div>
        </div>
    );
};

