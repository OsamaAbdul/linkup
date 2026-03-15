import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, Shield, BellRing, Smartphone, Award, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

interface LogisticsSettingsProps {
    details: any;
}

export function LogisticsSettings({ details }: LogisticsSettingsProps) {
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        vehicleType: details?.vehicle_type || "",
        phoneNumber: details?.phone_number || "",
        zone: details?.zone || "",
    });

    const [notifs, setNotifs] = useState(details?.notification_settings || {
        new_order: true,
        order_delivered: true,
        issue_reported: true,
        promoter_earnings: true
    });

    const handleSave = async () => {
        setLoading(true);
        try {
            // 1. Update logistics details
            const { error: detailsError } = await (supabase as any)
                .from("logistics_details")
                .update({
                    vehicle_type: formData.vehicleType,
                    notification_settings: notifs
                })
                .eq("user_id", details?.user_id);

            if (detailsError) throw detailsError;

            // 2. Update profiles (for the zone)
            const { error: profileError } = await (supabase as any)
                .from("profiles")
                .update({ zone: formData.zone })
                .eq("id", details?.user_id);

            if (profileError) throw profileError;

            await queryClient.invalidateQueries({ queryKey: ["logistics-details", details?.user_id] });
            toast.success("Settings saved protocol completed");
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Account Settings */}
                <Card className="border-none shadow-xl shadow-black/[0.02] rounded-[2.5rem]">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <User size={20} strokeWidth={2.5} />
                            </div>
                            <CardTitle className="text-xl font-black">Account Protocol</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Zone</Label>
                            <Select
                                value={formData.zone}
                                onValueChange={(v) => setFormData({ ...formData, zone: v })}
                            >
                                <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-none font-bold">
                                    <SelectValue placeholder="Select your zone" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/[0.05] shadow-xl font-bold">
                                    <SelectItem value="Zone 1 (Gwarinpa & Life Camp)">Zone 1 (Gwarinpa & Life Camp)</SelectItem>
                                    <SelectItem value="Zone 2 (Wuse & Utako)">Zone 2 (Wuse & Utako)</SelectItem>
                                    <SelectItem value="Zone 3 (Kubwa Central)">Zone 3 (Kubwa Central)</SelectItem>
                                    <SelectItem value="Zone 4 (Lugbe & Apo)">Zone 4 (Lugbe & Apo)</SelectItem>
                                    <SelectItem value="Zone 5 (Gwagwalada Districts)">Zone 5 (Gwagwalada Districts)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vehicle Type</Label>
                            <Select
                                value={formData.vehicleType}
                                onValueChange={(v) => setFormData({ ...formData, vehicleType: v })}
                            >
                                <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-none font-bold">
                                    <SelectValue placeholder="Select vehicle type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/[0.05] shadow-xl font-bold">
                                    <SelectItem value="Bicycle">Bicycle</SelectItem>
                                    <SelectItem value="Motorcycle">Motorcycle</SelectItem>
                                    <SelectItem value="Car/Sedan">Car/Sedan</SelectItem>
                                    <SelectItem value="Van/Mini-bus">Van/Mini-bus</SelectItem>
                                    <SelectItem value="Truck/Delivery Van">Truck/Delivery Van</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Registry</Label>
                            <div className="relative">
                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <Input
                                    disabled
                                    className="h-12 rounded-xl bg-gray-50 border-none pl-12 font-bold opacity-60"
                                    value={details?.profiles?.phone || "Locked for security"}
                                />
                            </div>
                        </div>
                        <Button onClick={handleSave} className="w-full h-12 rounded-xl font-black uppercase tracking-widest" disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card className="border-none shadow-xl shadow-black/[0.02] rounded-[2.5rem]">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                <BellRing size={20} strokeWidth={2.5} />
                            </div>
                            <CardTitle className="text-xl font-black">Neural Toggles</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground border-b pb-2">Agent Events</p>
                            <ToggleItem
                                label="New Order Assigned"
                                checked={notifs.new_order}
                                onCheckedChange={(v) => setNotifs({ ...notifs, new_order: v })}
                            />
                            <ToggleItem
                                label="Order Delivered"
                                checked={notifs.order_delivered}
                                onCheckedChange={(v) => setNotifs({ ...notifs, order_delivered: v })}
                            />
                            <ToggleItem
                                label="Issue Reported"
                                checked={notifs.issue_reported}
                                onCheckedChange={(v) => setNotifs({ ...notifs, issue_reported: v })}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                                <Award size={14} className="text-purple-600" />
                                <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Promoter Network</p>
                            </div>
                            <ToggleItem
                                label="Promoter Earnings Notification"
                                checked={notifs.promoter_earnings}
                                onCheckedChange={(v) => setNotifs({ ...notifs, promoter_earnings: v })}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function ToggleItem({ label, checked, onCheckedChange }: { label: string, checked: boolean, onCheckedChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">{label}</span>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
}
