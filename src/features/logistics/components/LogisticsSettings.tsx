import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { User, Shield, BellRing, Smartphone, Award, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/AuthContext";

interface LogisticsSettingsProps {
    details: any;
}

export function LogisticsSettings({ details }: LogisticsSettingsProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();

    const { data: zones = [] } = useQuery({
        queryKey: ["delivery-zones"],
        queryFn: async () => {
            const { data, error } = await supabase.from("delivery_zones").select("*").order("name");
            if (error) throw error;
            return data || [];
        }
    });

    const { data: vehicleTypes = [] } = useQuery({
        queryKey: ["vehicle-types"],
        queryFn: async () => {
            const { data, error } = await (supabase as any).from("vehicle_types").select("*").order("name");
            if (error) throw (error || new Error("Table missing"));
            return data || [];
        },
        retry: false
    });

    const fallbackVehicles = [
        "Bicycle",
        "Motorcycle",
        "Car/Sedan",
        "Van/Mini-bus",
        "Truck/Delivery Van"
    ];

    const displayVehicles = vehicleTypes.length > 0 ? vehicleTypes.map((v: any) => v.name) : fallbackVehicles;

    const [formData, setFormData] = useState({
        vehicleType: details?.vehicle_type || "",
        phoneNumber: details?.phone_number || "",
        zone: details?.profiles?.zone || "",
        zoneId: details?.profiles?.zone_id || "",
        cityId: details?.profiles?.city_id || "",
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
            if (!user?.id) throw new Error("User identity not verified");

            // 1. Update logistics details
            const { error: detailsError } = await (supabase as any)
                .from("logistics_details")
                .upsert({
                    user_id: user.id,
                    vehicle_type: formData.vehicleType,
                    notification_settings: notifs,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (detailsError) throw detailsError;

            // 2. Update profiles (for the zone)
            const { error: profileError } = await (supabase as any)
                .from("profiles")
                .update({ 
                    zone: formData.zone,
                    zone_id: formData.zoneId,
                    city_id: formData.cityId
                })
                .eq("id", user.id);

            if (profileError) throw profileError;

            await queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] });
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
                <Card className="border-none shadow-xl shadow-black/[0.02] rounded-xl">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <User size={20} strokeWidth={2.5} />
                            </div>
                            <CardTitle className="text-xl font-black">Account Settings</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operational Zone</Label>
                            <Select
                                value={formData.zoneId || ""}
                                onValueChange={(id) => {
                                    const selectedZone = zones.find((z: any) => z.id === id);
                                    if (selectedZone) {
                                        setFormData({ 
                                            ...formData, 
                                            zone: selectedZone.name,
                                            zoneId: selectedZone.id,
                                            cityId: selectedZone.city_id
                                        });
                                    }
                                }}
                            >
                                <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-none font-bold">
                                    <SelectValue placeholder="Select your zone" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-black/[0.05] shadow-xl font-bold">
                                    {zones.map((z: any) => (
                                        <SelectItem key={z.id} value={z.id}>
                                            {z.name}
                                        </SelectItem>
                                    ))}
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
                                    {displayVehicles.map((v: string) => (
                                        <SelectItem key={v} value={v}>
                                            {v}
                                        </SelectItem>
                                    ))}
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
                <Card className="border-none shadow-xl shadow-black/[0.02] rounded-xl">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                <BellRing size={20} strokeWidth={2.5} />
                            </div>
                            <CardTitle className="text-xl font-black">configurations</CardTitle>
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

