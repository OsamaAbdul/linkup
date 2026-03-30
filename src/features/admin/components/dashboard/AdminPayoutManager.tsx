import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Landmark, CheckCircle2, XCircle, Clock, Save, Settings2, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";

export function AdminPayoutManager() {
    const queryClient = useQueryClient();
    const [feeInput, setFeeInput] = useState("");
    const [intervalInput, setIntervalInput] = useState("");

    // Fetch payout requests
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ["admin-payout-requests"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payout_requests")
                .select(`
                    *,
                    profiles:user_id(
                        display_name,
                        user_roles(role)
                    )
                `)
                .order("created_at", { ascending: false });
            
            if (error) throw error;
            return data ?? [];
        }
    });

    // Fetch system settings
    const { data: settings } = useQuery({
        queryKey: ["payout-settings"],
        queryFn: async () => {
            const { data } = await supabase.from("system_settings").select("*");
            const withdrawal_fee = data?.find(s => s.key === 'withdrawal_fee')?.value as any;
            const payout_interval = data?.find(s => s.key === 'payout_interval_days')?.value as any;
            
            // Sync local inputs if not set
            if (withdrawal_fee && feeInput === "") setFeeInput(withdrawal_fee.amount.toString());
            if (payout_interval && intervalInput === "") setIntervalInput(payout_interval.toString());
            
        }
    });

    // Real-time updates
    useEffect(() => {
        const channel = supabase
            .channel("admin-payouts-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "payout_requests" }, 
                () => queryClient.invalidateQueries({ queryKey: ["admin-payout-requests"] }))
            .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" },
                () => queryClient.invalidateQueries({ queryKey: ["payout-settings"] }))
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
            const { error } = await supabase
                .from("payout_requests")
                .update({ status, admin_notes: notes })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-payout-requests"] });
            toast.success("Payout status updated");
        },
        onError: (err: any) => toast.error("Failed: " + err.message)
    });

    const updateSettingsMutation = useMutation({
        mutationFn: async ({ fee, interval }: { fee: number; interval: number }) => {
            const { error: feeErr } = await supabase
                .from("system_settings")
                .update({ value: { amount: fee, type: "flat" } })
                .eq("key", "withdrawal_fee");
            
            const { error: intErr } = await supabase
                .from("system_settings")
                .update({ value: interval })
                .eq("key", "payout_interval_days");
                
            if (feeErr || intErr) throw new Error("Update failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payout-settings"] });
            toast.success("System configurations updated");
        },
        onError: (err: any) => toast.error(err.message)
    });

    if (isLoading) return <div className="p-8 text-center animate-pulse">Loading requests...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Config Section */}
            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-8 rounded-3xl border-none shadow-2xl shadow-black/[0.03] bg-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl transition-all duration-700 group-hover:bg-primary/10" />
                    <div className="relative space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Settings2 className="text-primary" size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black tracking-tight">Withdrawal Configuration</h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Policy orchestration & fee structures</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Flat Withdrawal Fee (₦)</Label>
                                <Input 
                                    type="number" 
                                    value={feeInput} 
                                    onChange={(e) => setFeeInput(e.target.value)}
                                    className="h-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white font-bold transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Payout Interval (Days)</Label>
                                <Input 
                                    type="number" 
                                    value={intervalInput} 
                                    onChange={(e) => setIntervalInput(e.target.value)}
                                    className="h-12 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white font-bold transition-all"
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={() => updateSettingsMutation.mutate({ fee: Number(feeInput), interval: Number(intervalInput) })}
                            disabled={updateSettingsMutation.isPending}
                            className="bg-primary text-white h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <Save size={16} className="mr-2" />
                            {updateSettingsMutation.isPending ? "Syncing..." : "Update Global Policies"}
                        </Button>
                    </div>
                </Card>

                <div className="space-y-4">
                    <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100/50">
                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Total Fee Revenue</p>
                        <p className="text-2xl font-black text-emerald-900 tracking-tight">
                            ₦{requests.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.fee_amount, 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100/50">
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Pending Payouts</p>
                        <p className="text-2xl font-black text-amber-900 tracking-tight">
                            ₦{requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Requests Table */}
            <Card className="rounded-3xl border-none shadow-2xl shadow-black/[0.03] overflow-hidden bg-white">
                <div className="p-6 border-b border-black/[0.03] flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Clock size={14} /> Payout Queue
                    </h3>
                    <Badge variant="outline" className="rounded-full px-3 py-1 border-primary/20 text-primary font-bold">{requests.length} Requests</Badge>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">User & Role</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount & Fee</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bank Details</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03]">
                            {requests.map((r: any) => (
                                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-primary">
                                                {r.profiles?.display_name?.[0] || 'S'}
                                            </div>
                                             <div>
                                                <p className="text-[13px] font-black text-foreground tracking-tight">{r.profiles?.display_name || 'Anonymous User'}</p>
                                                <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest mt-0.5 border-black/5 bg-gray-50">
                                                    {r.profiles?.user_roles?.[0]?.role || 'user'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="text-sm font-black text-foreground">₦{r.amount.toLocaleString()}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fee: ₦{r.fee_amount.toLocaleString()}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <Landmark size={14} className="text-muted-foreground" />
                                            <div>
                                                <p className="text-xs font-black text-foreground">{r.bank_name}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground">{r.account_number} · {r.account_name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <Badge className={cn(
                                            "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                                            r.status === 'completed' ? "bg-emerald-100 text-emerald-800" :
                                            r.status === 'rejected' ? "bg-red-100 text-red-800" :
                                            r.status === 'approved' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                                        )}>
                                            {r.status}
                                        </Badge>
                                        <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{format(new Date(r.created_at), "MMM d, HH:mm")}</p>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex justify-end gap-2">
                                            {r.status === 'pending' && (
                                                <>
                                                    <Button 
                                                        size="sm" variant="outline" 
                                                        className="h-8 w-8 p-0 rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'approved' })}
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </Button>
                                                    <Button 
                                                        size="sm" variant="outline" 
                                                        className="h-8 w-8 p-0 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                                                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'rejected' })}
                                                    >
                                                        <XCircle size={16} />
                                                    </Button>
                                                </>
                                            )}
                                            {r.status === 'approved' && (
                                                <Button 
                                                    size="sm" 
                                                    className="h-8 rounded-lg bg-emerald-600 font-black text-[9px] uppercase px-4"
                                                    onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'completed' })}
                                                >
                                                    Complete Payment
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground font-bold italic">No payout requests in the queue.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
