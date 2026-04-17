import React from "react";
import { 
    MapPin, 
    ArrowUpRight, 
    Clock, 
    Package, 
    ChevronRight,
    Star,
    Navigation2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";

interface ShipmentCardProps {
    shipment: any;
    onClick: () => void;
}

export function ShipmentCardV2({ shipment, onClick }: ShipmentCardProps) {
    const status = shipment?.status?.toLowerCase() || 'pending';
    
    const getStatusStyles = (s: string) => {
        switch (s) {
            case 'pending': return "bg-amber-100 text-amber-700 border-amber-200/50";
            case 'accepted': return "bg-blue-100 text-blue-700 border-blue-200/50";
            case 'started': return "bg-indigo-100 text-indigo-700 border-indigo-200/50";
            case 'arrived': return "bg-purple-100 text-purple-700 border-purple-200/50";
            case 'delivered': return "bg-emerald-100 text-emerald-700 border-emerald-200/50";
            case 'completed': return "bg-gray-100 text-gray-700 border-gray-200/50";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <button 
            onClick={onClick}
            className="w-full text-left bg-white rounded-3xl p-5 border border-black/[0.04] shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-300 group active:scale-[0.98]"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                        getStatusStyles(status)
                    )}>
                        <Package size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Order Ref.</p>
                        <p className="text-sm font-black text-foreground tracking-tight uppercase">#{shipment.id?.slice(-6)}</p>
                    </div>
                </div>
                
                <Badge className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-none",
                    getStatusStyles(status)
                )}>
                    {status}
                </Badge>
            </div>

            <div className="space-y-4 mb-5">
                <div className="flex items-start gap-3">
                    <div className="mt-1 flex flex-col items-center gap-1 group-hover:scale-110 transition-transform">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 bg-white" />
                        <div className="w-0.5 h-6 bg-gray-100 rounded-full" />
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Pickup</p>
                            <p className="text-[13px] font-bold text-foreground line-clamp-1">{shipment.pickup_address || "Retrieving address..."}</p>
                        </div>
                        <div className="leading-tight">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Drop-off</p>
                            <p className="text-[13px] font-bold text-foreground line-clamp-1">{shipment.delivery_address || "Retrieving destination..."}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-black/[0.03]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <Navigation2 size={14} className="text-blue-500 fill-blue-500" />
                        <span className="text-sm font-black text-foreground tracking-tight">{shipment.distance_km || "0.0"} <span className="text-[10px] text-muted-foreground uppercase">km</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-muted-foreground" />
                        <span className="text-sm font-black text-foreground tracking-tight">15 <span className="text-[10px] text-muted-foreground uppercase">min</span></span>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span className="text-[11px] font-black uppercase tracking-widest">Details</span>
                    <ChevronRight size={16} strokeWidth={3} />
                </div>
            </div>
        </button>
    );
}
