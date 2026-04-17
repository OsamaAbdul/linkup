import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/lib/utils";
import { Radio, Truck, CheckCircle, Banknote } from "lucide-react";

interface LogisticsStatsProps {
    shipments: any[];
    broadcastMissionsCount: number;
}

export function LogisticsStats({ shipments, broadcastMissionsCount }: LogisticsStatsProps) {
    const stats = [
        { 
            label: "Open Missions", 
            value: broadcastMissionsCount, 
            icon: Radio, 
            color: "text-blue-600", 
            bg: "bg-blue-50" 
        },
        { 
            label: "On the Road", 
            value: shipments.filter((s: any) => s.status === "picked_up").length, 
            icon: Truck, 
            color: "text-amber-600", 
            bg: "bg-amber-50" 
        },
        { 
            label: "Missions Finished", 
            value: shipments.filter((s: any) => s.status === "delivered" && new Date(s.updated_at).toDateString() === new Date().toDateString()).length, 
            icon: CheckCircle, 
            color: "text-green-600", 
            bg: "bg-green-50" 
        },
        { 
            label: "Estimated Pay", 
            value: `₦${shipments
                .filter((s: any) => s.status !== "delivered" && s.status !== "completed")
                .reduce((acc, s) => acc + (s.delivery_fee_amount || s.delivery_fee || 0), 0)
                .toLocaleString()}`, 
            icon: Banknote, 
            color: "text-indigo-600", 
            bg: "bg-indigo-50" 
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
