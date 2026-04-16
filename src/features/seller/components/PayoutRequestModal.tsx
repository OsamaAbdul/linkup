import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { AlertCircle, Landmark, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addDays, isAfter } from "date-fns";

interface PayoutRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    wallet: any;
    balanceOverride?: number;
}

export function PayoutRequestModal({ isOpen, onClose, wallet, balanceOverride }: PayoutRequestModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");

    // Fetch system settings for fee and interval
    const { data: settings } = useQuery({
        queryKey: ["payout-settings"],
        queryFn: async () => {
            const { data } = await supabase.from("system_settings").select("*");
            const withdrawal_fee = data?.find(s => s.key === 'withdrawal_fee')?.value as { amount: number, type: string };
            const payout_interval = data?.find(s => s.key === 'payout_interval_days')?.value as number;
            return { withdrawal_fee, payout_interval };
        }
    });

    // Fetch last payout request to check interval
    const { data: lastRequest } = useQuery({
        queryKey: ["last-payout-request", user?.id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("payout_requests")
                .select("created_at")
                .eq("user_id", user?.id)
                .neq("status", "rejected")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error) console.error("Last payout request fetch error:", error);
            return data;
        },
        enabled: !!user?.id
    });

    const fee = settings?.withdrawal_fee?.amount ?? 0;
    const intervalDays = settings?.payout_interval ?? 7;
    const nextAvailableDate = lastRequest ? addDays(new Date(lastRequest.created_at), intervalDays) : new Date();
    // Allow if no last request OR current time is after (or equal to) next available date (with 1s buffer)
    const canRequest = !lastRequest || isAfter(new Date(), new Date(nextAvailableDate.getTime() - 1000));

    const withdrawalAmount = Number(amount) || 0;
    const totalDeduction = withdrawalAmount + fee;
    const currentBalance = balanceOverride !== undefined ? balanceOverride : (wallet?.balance ?? 0);
    const isInsufficient = totalDeduction > currentBalance;

    const payoutMutation = useMutation({
        mutationFn: async (payload: any) => {
            const { error } = await supabase.from("payout_requests").insert(payload);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
            queryClient.invalidateQueries({ queryKey: ["payout-requests"] });
            toast.success("Payout request submitted successfully!");
            onClose();
            setAmount("");
        },
        onError: (err: any) => toast.error("Request failed: " + err.message)
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canRequest) {
            toast.error(`You can only request payouts every ${intervalDays} days.`);
            return;
        }
        if (isInsufficient) {
            toast.error("Insufficient balance to cover amount and fee.");
            return;
        }

        payoutMutation.mutate({
            user_id: user?.id,
            wallet_id: wallet.id,
            amount: withdrawalAmount,
            fee_amount: fee,
            bank_name: bankName,
            account_number: accountNumber,
            account_name: accountName,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 bg-white max-h-[90vh] overflow-y-auto scrollbar-hide">
                <div className="bg-primary p-8 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight">Withdrawal Hub</DialogTitle>
                        <DialogDescription className="text-white/70 font-medium">
                            Request your earnings settlement securely.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-8 bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Available Balance</p>
                            <p className="text-2xl font-black">₦{currentBalance.toLocaleString()}</p>
                        </div>
                        <Wallet className="text-white/40" size={32} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {!canRequest && (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 text-amber-700">
                            <Clock className="shrink-0" size={18} />
                            <div className="text-xs font-bold leading-relaxed">
                                Interval Constraint: You can request your next payout on {format(nextAvailableDate, "MMM d, yyyy")}.
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount to Withdraw</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-foreground">₦</span>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    className="h-14 pl-10 rounded-xl border-black/[0.05] bg-gray-50 focus:bg-white transition-all font-black text-lg"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Bank Name</Label>
                                <Input 
                                    placeholder="e.g. GTBank" 
                                    className="h-12 rounded-xl border-black/[0.05]"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Number</Label>
                                <Input 
                                    placeholder="10 digits" 
                                    className="h-12 rounded-xl border-black/[0.05] font-mono"
                                    maxLength={10}
                                    value={accountNumber}
                                    onChange={(e) => setAccountNumber(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Name</Label>
                            <Input 
                                placeholder="Full name on account" 
                                className="h-12 rounded-xl border-black/[0.05]"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-2xl border border-black/[0.03] space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-muted-foreground">Withdrawal Fee</span>
                            <span className="text-foreground">₦{fee.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Deduction</span>
                            <span className={cn("text-lg font-black", isInsufficient ? "text-red-500" : "text-primary")}>
                                ₦{totalDeduction.toLocaleString()}
                            </span>
                        </div>
                        {isInsufficient && (
                            <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                <AlertCircle size={12} />
                                Exceeds available balance
                            </p>
                        )}
                    </div>

                    <Button 
                        type="submit" 
                        disabled={!canRequest || !amount || isInsufficient || payoutMutation.isPending}
                        className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {payoutMutation.isPending ? "Processing..." : "Initiate Withdrawal"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
