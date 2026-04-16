import React from "react";
import { Card } from "@/shared/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Truck, MapPin, Navigation, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPickupAddress, getDeliveryAddress, getBuyerContact } from "../../utils/logistics-utils";

interface ActiveTransitsProps {
    shipments: any[];
    onViewDetails: (shipment: any) => void;
    onNavigate: (shipment: any, mode: 'pickup' | 'delivery') => void;
}

export function ActiveTransits({ shipments, onViewDetails, onNavigate }: ActiveTransitsProps) {

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Truck size={16} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tight">Active Transits</h2>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Real-time mission tracking</p>
                </div>
            </div>

            <Card className="border-none shadow-xl shadow-black/[0.02] rounded-xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pl-8">Order ID</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Pickup</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Delivery</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Status</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Cut</TableHead>
                            <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 text-right pr-8">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shipments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium">
                                    No active transits. Claim a mission above to get started!
                                </TableCell>
                            </TableRow>
                        ) : shipments.map((s: any) => {
                            const buyer = getBuyerContact(s);
                            const pickupAddr = getPickupAddress(s);
                            const deliveryAddr = getDeliveryAddress(s);

                            return (
                                <TableRow key={s.id} className="border-black/[0.03] group transition-colors">
                                    <TableCell className="font-bold text-xs pl-8">#{s.order_id?.slice(-8)}</TableCell>
                                    <TableCell className="max-w-[250px] min-w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                                                <MapPin size={12} strokeWidth={2.5} />
                                            </div>
                                            <p className="text-xs font-bold line-clamp-2 leading-tight">
                                                {pickupAddr}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                                <Navigation size={12} strokeWidth={2.5} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black line-clamp-2 leading-tight">
                                                    {deliveryAddr}
                                                </p>
                                                <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-tighter">
                                                    {buyer.name} • {buyer.phone}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none",
                                            s.status === "accepted" ? "bg-indigo-100 text-indigo-700" :
                                                s.status === "out_for_pickup" ? "bg-amber-100 text-amber-700" :
                                                    s.status === "arrived_at_seller" ? "bg-orange-100 text-orange-700" :
                                                        s.status === "picked_up" ? "bg-purple-100 text-purple-700" :
                                                            s.status === "out_for_delivery" ? "bg-blue-100 text-blue-700" :
                                                                s.status === "arrived_at_destination" ? "bg-cyan-100 text-cyan-700" :
                                                                    s.status === "delivered" ? "bg-green-100 text-green-700" :
                                                                        "bg-amber-100 text-amber-700"
                                        )}>
                                            {s.status.replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-green-600">₦{(s.delivery_fee_amount || s.delivery_fee || 0).toLocaleString()}</span>
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">Guaranteed</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="flex items-center justify-end gap-2">
                                            {["accepted", "out_for_pickup", "arrived_at_seller"].includes(s.status) && (
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl h-9 bg-orange-500 hover:bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest gap-2"
                                                    onClick={() => onNavigate(s, 'pickup')}
                                                >
                                                    <MapPin size={12} strokeWidth={3} /> Pickup
                                                </Button>
                                            )}
                                            {["picked_up", "out_for_delivery", "arrived_at_destination"].includes(s.status) && (
                                                <Button
                                                    size="sm"
                                                    className="rounded-xl h-9 bg-blue-500 hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest gap-2"
                                                    onClick={() => onNavigate(s, 'delivery')}
                                                >
                                                    <Navigation size={12} strokeWidth={3} /> Deliver
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-xl h-9 hover:bg-blue-50 hover:text-blue-600 font-bold"
                                                onClick={() => onViewDetails(s)}
                                            >
                                                <Eye size={16} className="mr-1" /> Details
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
        </section>
    );
}
