import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";
import { Radio, Truck, CheckCircle, AlertTriangle } from "lucide-react";

interface LogisticsStatsProps {
    shipments: any[];
    broadcastMissionsCount: number;
}

export function LogisticsStats({ shipments, broadcastMissionsCount }: LogisticsStatsProps) {
    const stats = [
        { 
            label: "Available Missions", 
            value: broadcastMissionsCount, 
            icon: Radio, 
            color: "text-blue-600", 
            bg: "bg-blue-50" 
        },
        { 
            label: "In Transit", 
            value: shipments.filter((s: any) => s.status === "picked_up").length, 
            icon: Truck, 
            color: "text-amber-600", 
            bg: "bg-amber-50" 
        },
        { 
            label: "Delivered Today", 
            value: shipments.filter((s: any) => s.status === "delivered" && new Date(s.updated_at).toDateString() === new Date().toDateString()).length, 
            icon: CheckCircle, 
            color: "text-green-600", 
            bg: "bg-green-50" 
        },
        { 
            label: "Issues", 
            value: 0, 
            icon: AlertTriangle, 
            color: "text-red-600", 
            bg: "bg-red-50" 
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <Card key={i} className="border-none shadow-sm rounded-xl overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.bg, stat.color)}>
                            <stat.icon size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                            <p className="text-2xl font-black text-foreground">{stat.value}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
