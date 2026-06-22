import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketplaceZoneNavProps {
  zones: any[];
  selectedZone: string;
  setSelectedZone: (value: string) => void;
  position: { latitude: number; longitude: number } | null;
  geoLoading: boolean;
  onRefreshGeo: () => void;
}

export function MarketplaceZoneNav({
  zones,
  selectedZone,
  setSelectedZone,
  position,
  geoLoading,
  onRefreshGeo,
}: MarketplaceZoneNavProps) {
  if (zones.length === 0) return null;

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-muted-foreground border-r pr-6 mr-2">
        <MapPin size={16} className="text-primary" />
        Filter By Zone
        {position && (
          <Badge variant="outline" className="h-5 px-2 text-[10px] border-success/30 bg-success/5 text-success animate-in fade-in zoom-in duration-500 ml-1">
            Live
          </Badge>
        )}
      </div>
      <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefreshGeo}
          disabled={geoLoading}
          className="px-6 py-6 rounded-xl bg-white border-border/30 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all shrink-0 gap-2 hover:bg-primary/5 hover:text-primary active:scale-95"
        >
          <MapPin size={14} className={cn(geoLoading && "animate-pulse")} />
          {geoLoading ? "Detecting..." : "Detect Location"}
        </Button>

        <button
          onClick={() => setSelectedZone("")}
          className={cn(
            "px-6 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
            !selectedZone ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105" : "bg-white text-muted-foreground border border-border/30 hover:bg-muted/30"
          )}
        >
          All Zones
        </button>
        {zones.map((z: any) => (
          <button
            key={z.id}
            onClick={() => setSelectedZone(z.id)}
            className={cn(
              "px-6 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0",
              selectedZone === z.id ? "bg-primary text-white shadow-xl shadow-primary/20 scale-105" : "bg-white text-muted-foreground border border-border/30 hover:bg-muted/30"
            )}
          >
            {z.name}
          </button>
        ))}
      </div>
    </div>
  );
}
