import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { User, Shield, BellRing, Smartphone, Award, MapPin, Truck, Landmark, ChevronRight } from "lucide-react";
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
import { ProfileForm } from "@/features/user/components/ProfileForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";

interface LogisticsSettingsProps {
    details: any;
}

export function LogisticsSettings({ details }: LogisticsSettingsProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const queryClient = useQueryClient();
    
    // Modal state
    const [profileOpen, setProfileOpen] = useState(false);
    const [fleetOpen, setFleetOpen] = useState(false);
    const [settlementOpen, setSettlementOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);

    // Fetch profile for bank details
    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("profiles")
                .select("payout_bank_name, payout_account_number, payout_account_name")
                .eq("id", user?.id)
                .single();
            return data;
        },
        enabled: !!user?.id
    });

    const [bankInfo, setBankInfo] = useState({
        bankName: "",
        accountNumber: "",
        accountName: ""
    });

    // Populate bank info when profile loads
    useEffect(() => {
        if (profile) {
            setBankInfo({
                bankName: profile.payout_bank_name || "",
                accountNumber: profile.payout_account_number || "",
                accountName: profile.payout_account_name || ""
            });
        }
    }, [profile]);

    // Handle bank info sync
    const [isSyncingBank, setIsSyncingBank] = useState(false);
    const handleSaveBank = async () => {
        setIsSyncingBank(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    payout_bank_name: bankInfo.bankName,
                    payout_account_number: bankInfo.accountNumber,
                    payout_account_name: bankInfo.accountName,
                    updated_at: new Date().toISOString()
                })
                .eq("id", user?.id);
            
            if (error) throw error;
            toast.success("Payment details saved");
            queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
            setSettlementOpen(false); // Close modal on success
        } catch (error: any) {
            toast.error("Sync error: " + error.message);
        } finally {
            setIsSyncingBank(false);
        }
    };

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
    });

    const [notifs, setNotifs] = useState(details?.notification_settings || {
        new_order: true,
        order_delivered: true,
        issue_reported: true,
        promoter_earnings: true
    });

    const handleSaveLogistics = async () => {
        setLoading(true);
        try {
            if (!user?.id) throw new Error("User identity not verified");

            const { error: detailsError } = await (supabase as any)
                .from("logistics_details")
                .upsert({
                    user_id: user.id,
                    vehicle_type: formData.vehicleType,
                    notification_settings: notifs,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (detailsError) throw detailsError;

            await queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] });
            toast.success("Vehicle info saved");
            setFleetOpen(false); // Close modal on success
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            if (!user?.id) throw new Error("User identity not verified");

            const { error: detailsError } = await (supabase as any)
                .from("logistics_details")
                .upsert({
                    user_id: user.id,
                    notification_settings: notifs,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (detailsError) throw detailsError;

            await queryClient.invalidateQueries({ queryKey: ["logistics-details", user.id] });
            toast.success("Notification settings saved");
            setConfigOpen(false); // Close modal on success
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto pb-20">
            
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-20 rounded-2xl justify-start px-6 bg-white hover:bg-black/[0.02] border-black/[0.05] shadow-sm group">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mr-4 group-hover:scale-110 transition-transform">
                            <User size={20} strokeWidth={2.5} />
                        </div>
                        <div className="text-left flex-1">
                            <div className="font-black text-lg">My Profile</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Personal details & location</div>
                        </div>
                        <ChevronRight className="text-muted-foreground/50 w-5 h-5 group-hover:text-foreground transition-colors" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl bg-muted/20 border-none p-0 sm:rounded-[32px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="px-6 pt-6 pb-2">
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                           <User size={20} className="text-primary" /> 
                           My Profile
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 pt-0">
                        <ProfileForm onSuccess={() => setProfileOpen(false)} />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={fleetOpen} onOpenChange={setFleetOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-20 rounded-2xl justify-start px-6 bg-white hover:bg-black/[0.02] border-black/[0.05] shadow-sm group">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent mr-4 group-hover:scale-110 transition-transform">
                            <Truck size={20} strokeWidth={2.5} />
                        </div>
                        <div className="text-left flex-1">
                            <div className="font-black text-lg">Delivery Vehicle</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Choose the vehicle you use</div>
                        </div>
                        <ChevronRight className="text-muted-foreground/50 w-5 h-5 group-hover:text-foreground transition-colors" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-white border-black/[0.05] sm:rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                           <Truck size={20} className="text-accent" /> 
                           Delivery Vehicle
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Your Vehicle Type</Label>
                            <Select
                                value={formData.vehicleType}
                                onValueChange={(v) => setFormData({ ...formData, vehicleType: v })}
                            >
                                <SelectTrigger className="h-12 rounded-2xl bg-white border border-black/[0.05] shadow-inner font-bold focus:ring-accent/20">
                                    <SelectValue placeholder="Select vehicle type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl font-bold">
                                    {displayVehicles.map((v: string) => (
                                        <SelectItem key={v} value={v} className="rounded-xl">
                                            {v}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                            <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Important</p>
                            <p className="text-[11px] font-bold text-accent/70 leading-relaxed">The vehicle you select determines what size of orders you can deliver.</p>
                        </div>

                        <Button onClick={handleSaveLogistics} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/10" disabled={loading}>
                            {loading ? "Syncing..." : "Save Vehicle Info"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-20 rounded-2xl justify-start px-6 bg-white hover:bg-black/[0.02] border-black/[0.05] shadow-sm group">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mr-4 group-hover:scale-110 transition-transform">
                            <Landmark size={20} strokeWidth={2.5} />
                        </div>
                        <div className="text-left flex-1">
                            <div className="font-black text-lg">Payment Details</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Where we send your earnings</div>
                        </div>
                        <ChevronRight className="text-muted-foreground/50 w-5 h-5 group-hover:text-foreground transition-colors" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-white border-black/[0.05] sm:rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                           <Landmark size={20} className="text-emerald-600" /> 
                           Payment Details
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Bank Name</Label>
                                <Input 
                                    placeholder="e.g. GTBank" 
                                    className="h-12 rounded-2xl bg-white border border-black/[0.05] shadow-inner font-bold focus:ring-emerald-500/20"
                                    value={bankInfo.bankName}
                                    onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Number</Label>
                                    <Input 
                                        placeholder="10 digits" 
                                        maxLength={10}
                                        className="h-12 rounded-2xl bg-white border border-black/[0.05] shadow-inner font-mono font-bold focus:ring-emerald-500/20"
                                        value={bankInfo.accountNumber}
                                        onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Name</Label>
                                    <Input 
                                        placeholder="Full name" 
                                        className="h-12 rounded-2xl bg-white border border-black/[0.05] shadow-inner font-bold focus:ring-emerald-500/20"
                                        value={bankInfo.accountName}
                                        onChange={(e) => setBankInfo({ ...bankInfo, accountName: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Quick Withdrawals</p>
                            <p className="text-[11px] font-bold text-emerald-700/70 leading-relaxed">We'll use this account to pay your earnings. Saving this makes cashing out faster.</p>
                        </div>

                        <Button 
                            onClick={handleSaveBank} 
                            className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20" 
                            disabled={isSyncingBank}
                        >
                            {isSyncingBank ? "Syncing Details..." : "Save Bank Details"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-20 rounded-2xl justify-start px-6 bg-white hover:bg-black/[0.02] border-black/[0.05] shadow-sm group">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mr-4 group-hover:scale-110 transition-transform">
                            <BellRing size={20} strokeWidth={2.5} />
                        </div>
                        <div className="text-left flex-1">
                            <div className="font-black text-lg">Notifications</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Manage your alerts</div>
                        </div>
                        <ChevronRight className="text-muted-foreground/50 w-5 h-5 group-hover:text-foreground transition-colors" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-white border-black/[0.05] sm:rounded-[32px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                           <BellRing size={20} className="text-amber-600" /> 
                           Notifications
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-8 pt-4">
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground border-b pb-2">Delivery Alerts</p>
                            <ToggleItem
                                label="When I get a new order"
                                checked={notifs.new_order}
                                onCheckedChange={(v) => setNotifs({ ...notifs, new_order: v })}
                            />
                            <ToggleItem
                                label="When an order is completed"
                                checked={notifs.order_delivered}
                                onCheckedChange={(v) => setNotifs({ ...notifs, order_delivered: v })}
                            />
                            <ToggleItem
                                label="When there's a problem"
                                checked={notifs.issue_reported}
                                onCheckedChange={(v) => setNotifs({ ...notifs, issue_reported: v })}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                                <Award size={14} className="text-purple-600" />
                                <p className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Referral Earnings</p>
                            </div>
                            <ToggleItem
                                label="When I earn money from referrals"
                                checked={notifs.promoter_earnings}
                                onCheckedChange={(v) => setNotifs({ ...notifs, promoter_earnings: v })}
                            />
                        </div>

                        <Button 
                            onClick={handleSaveConfig} 
                            className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20" 
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Notifications"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
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
