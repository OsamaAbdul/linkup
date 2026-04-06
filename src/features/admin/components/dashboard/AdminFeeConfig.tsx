import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { toast } from "sonner";
import { Wallet, Percent, Banknote, Save, RotateCcw, ShieldCheck, Info, Map, Route } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeeConfig {
    id: string;
    fee_type: string;
    name: string;
    rate: number;
    flat_fee: number;
    priority: number;
    is_active: boolean;
}

export default function AdminFeeConfig() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: fees, isLoading } = useQuery({
        queryKey: ["admin-fee-config"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("fee_config")
                .select("*")
                .order("priority", { ascending: false });
            if (error) throw error;
            return data as FeeConfig[];
        }
    });

    const updateFeeMutation = useMutation({
        mutationFn: async (updatedFee: Partial<FeeConfig> & { id: string }) => {
            const { error } = await (supabase as any)
                .from("fee_config")
                .update(updatedFee)
                .eq("id", updatedFee.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-fee-config"] });
            queryClient.invalidateQueries({ queryKey: ["fee-config"] });
            toast.success("Fee configuration updated successfully");
            setEditingId(null);
        },
        onError: (error: any) => {
            toast.error("Failed to update fee", { description: error.message });
        }
    });

    if (isLoading) return <div className="p-8 text-center text-muted-foreground font-black uppercase tracking-widest animate-pulse">Loading Fee Configuration...</div>;

    const getIcon = (type: string) => {
        switch (type) {
            case 'platform': return <ShieldCheck className="text-blue-500" />;
            case 'rider': return <Banknote className="text-green-500" />;
            case 'promoter': return <Percent className="text-purple-500" />;
            case 'rider_out_of_zone': return <Map className="text-orange-500" />;
            case 'rider_distance': return <Route className="text-blue-600" />;
            default: return <Wallet className="text-gray-500" />;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-3xl border border-black/[0.03] shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Wallet size={24} />
                        </div>
                        Financial Controller
                    </h2>
                    <p className="text-muted-foreground font-medium text-sm ml-1">Configure platform rates, logistics payouts, and promoter commissions.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-blue-50/50 px-4 py-2 rounded-2xl border border-blue-100">
                    <Info size={16} className="text-blue-600" />
                    <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Global Rates</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {fees?.map((fee) => (
                    <Card key={fee.id} className={cn(
                        "rounded-3xl border-black/[0.03] shadow-sm transition-all duration-300 overflow-hidden group",
                        !fee.is_active && "opacity-60 grayscale"
                    )}>
                        <CardHeader className="bg-gray-50/50 border-b border-black/[0.02] p-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="w-10 h-10 rounded-xl bg-white border border-black/[0.05] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    {getIcon(fee.fee_type)}
                                </div>
                                <Switch 
                                    checked={fee.is_active}
                                    onCheckedChange={(checked) => updateFeeMutation.mutate({ id: fee.id, is_active: checked })}
                                />
                            </div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight">{fee.name}</CardTitle>
                            <CardDescription className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Type: {fee.fee_type}</CardDescription>
                        </CardHeader>
                        
                        <CardContent className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rate (%)</Label>
                                    <div className="relative group/input">
                                        <Input 
                                            type="number" 
                                            defaultValue={fee.rate * 100}
                                            step="0.01"
                                            className="font-black text-lg h-12 pr-10 rounded-xl border-black/[0.05] focus:ring-primary focus:border-primary"
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) / 100;
                                                fee.rate = isNaN(val) ? 0 : val;
                                            }}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">%</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Flat Fee (₦)</Label>
                                    <div className="relative group/input">
                                        <Input 
                                            type="number" 
                                            defaultValue={fee.flat_fee}
                                            step="10"
                                            className="font-black text-lg h-12 pr-10 rounded-xl border-black/[0.05] focus:ring-primary focus:border-primary"
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                fee.flat_fee = isNaN(val) ? 0 : val;
                                            }}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">₦</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button 
                                    className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-xs gap-2 shadow-lg shadow-primary/20"
                                    onClick={() => updateFeeMutation.mutate({ 
                                        id: fee.id, 
                                        rate: fee.rate, 
                                        flat_fee: fee.flat_fee 
                                    })}
                                    disabled={updateFeeMutation.isPending}
                                >
                                    <Save size={16} />
                                    Save Changes
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="h-12 w-12 p-0 rounded-xl border-black/[0.05] hover:bg-gray-50"
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-fee-config"] })}
                                >
                                    <RotateCcw size={16} className="text-muted-foreground" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="rounded-3xl border-dashed border-2 border-black/[0.05] bg-transparent">
                <CardContent className="p-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-muted-foreground">
                        <Banknote size={32} strokeWidth={1.5} />
                    </div>
                    <div className="max-w-md mx-auto">
                        <h4 className="text-lg font-black uppercase tracking-tight">Calculation Logic</h4>
                        <p className="text-sm text-muted-foreground font-medium">
                            System fees are calculated as: 
                            <br />
                            <code className="bg-black/5 px-2 py-1 rounded-md text-primary font-black mt-2 inline-block">
                                (Order Subtotal × Rate) + Flat Fee
                            </code>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
