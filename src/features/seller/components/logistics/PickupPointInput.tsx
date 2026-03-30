import React, { useState } from "react";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { MapPin, LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PickupPointInputProps {
    value: string;
    onChange: (value: string) => void;
    onLocationCapture?: (lat: number, lng: number) => void;
    currentCoords?: { lat: number; lng: number } | null;
}

export const PickupPointInput: React.FC<PickupPointInputProps> = ({ 
    value, 
    onChange, 
    onLocationCapture,
    currentCoords 
}) => {
    const [isLocating, setIsLocating] = useState(false);

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                onLocationCapture?.(latitude, longitude);
                setIsLocating(false);
                toast.success("Location pinned!", {
                    description: `${latitude.toFixed(4)}, ${longitude.toFixed(4)} captured`
                });
            },
            (error) => {
                setIsLocating(false);
                toast.error("Could not get location: " + error.message);
            },
            { enableHighAccuracy: true }
        );
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                    Product Pickup Point
                </Label>
                {onLocationCapture && (
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleGetLocation}
                        type="button"
                        disabled={isLocating}
                        className={cn(
                            "h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest gap-1.5 transition-all text-white",
                            currentCoords ? "bg-primary/20 text-primary border border-primary/20" : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
                        )}
                    >
                        {isLocating ? (
                            <Loader2 size={10} className="animate-spin" />
                        ) : (
                            <LocateFixed size={10} strokeWidth={3} />
                        )}
                        {currentCoords ? "Location Pinned" : "Pin My Location"}
                    </Button>
                )}
            </div>
            
            <div className="relative group">
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Specify where the agent should pick up the product"
                    className="rounded-xl border-primary/10 focus:border-primary/30 bg-primary/[0.02] h-12 pr-10 text-sm font-medium"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/20 group-focus-within:text-primary/40 transition-colors">
                    <MapPin size={16} strokeWidth={2.5} />
                </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground font-medium pl-1">
                {currentCoords 
                    ? `📍 GPS coordinates captured (${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)})`
                    : "Tip: Pinning your location helps agents navigate directly to you."}
            </p>
        </div>
    );
};
