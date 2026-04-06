import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui/dialog";
import { TrendingUp, Calendar, CreditCard, Wallet, ArrowDownToLine, Loader2, CheckCircle, Package, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PayoutRequestModal } from "@/features/seller/components/PayoutRequestModal";
import { PayoutReceiptModal } from "@/features/seller/components/PayoutReceiptModal";
import { format } from "date-fns";

const DAILY_LIMIT = 50000;

export function LogisticsEarnings() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [selectedPayout, setSelectedPayout] = useState<any>(null);
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [accountName, setAccountName] = useState("");

    // Real wallet balance — keyed by user_id (rider wallet)
    const { data: wallet } = useQuery({
        queryKey: ["rider-wallet", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("wallets")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();
            return data;
        },
        enabled: !!user,
    });

    // Completed shipments for this rider — each row has delivery_fee from our RPC
    const { data: completedShipments = [] } = useQuery({
        queryKey: ["rider-completed-shipments", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data } = await (supabase as any)
                .from("shipments")
                .select(`
                    id,
                    order_id,
                    delivery_fee,
                    earnings,
                    zone,
                    created_at,
                    orders!inner(total, status, updated_at, buyer_id)
                `)
                .eq("rider_id", user.id)
                .eq("orders.status", "completed")
                .order("created_at", { ascending: false });
            return data ?? [];
        },
        enabled: !!user,
    });

    // Real transaction history from wallet
    const { data: riderTransactions = [] } = useQuery({
        queryKey: ["rider-transactions", wallet?.id],
        queryFn: async () => {
            if (!wallet?.id) return [];
            const { data, error } = await (supabase as any)
                .from("wallet_transactions")
                .select("*")
                .eq("wallet_id", wallet.id)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!wallet?.id,
    });

    // Payout requests history (Unified system)
    const { data: payoutRequests = [] } = useQuery({
        queryKey: ["rider-payout-requests", user?.id],
        queryFn: async () => {
            const { data } = await (supabase as any)
                .from("payout_requests")
                .select("*")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false });
            return data || [];
        },
        enabled: !!user,
    });

    // Real-time wallet updates when settlement fires
    useEffect(() => {
        if (!user) return;
        const ch = supabase
            .channel(`rider-earnings-rt-${user.id}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets" },
                () => queryClient.invalidateQueries({ queryKey: ["rider-wallet", user.id] }))
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shipments" },
                () => queryClient.invalidateQueries({ queryKey: ["rider-completed-shipments", user.id] }))
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" },
                (payload) => {
                    if ((payload.new as any).status === "completed") {
                        queryClient.invalidateQueries({ queryKey: ["rider-wallet", user.id] });
                        queryClient.invalidateQueries({ queryKey: ["rider-completed-shipments", user.id] });
                    }
                })
            .on("postgres_changes", { event: "*", schema: "public", table: "payout_requests" },
                () => queryClient.invalidateQueries({ queryKey: ["rider-payout-requests", user.id] }))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user, queryClient]);

    // Metrics come from REAL transaction records
    const deliveryFees = riderTransactions.filter((t: any) => t.type === 'delivery_fee' && t.status === 'success');
    const pendingFees = riderTransactions.filter((t: any) => t.type === 'delivery_fee' && t.status === 'pending');
    
    const pendingBalance = wallet?.escrow_balance ?? 0;
    const totalEarnings = riderTransactions
        .filter((t: any) => t.type === 'delivery_fee')
        .reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
    
    const today = new Date().toDateString();
    const todayEarnings = deliveryFees
        .filter((t: any) => new Date(t.created_at).toDateString() === today)
        .reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
        
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    const weekEarnings = deliveryFees
        .filter((t: any) => new Date(t.created_at) >= thisWeekStart)
        .reduce((acc: number, t: any) => acc + (t.amount || 0), 0);

    const todayWithdrawn = payoutRequests
        .filter((w: any) => new Date(w.created_at).toDateString() === today && w.status !== "rejected")
        .reduce((acc: number, w: any) => acc + (w.amount || 0), 0);
    const remainingDailyLimit = Math.max(0, DAILY_LIMIT - todayWithdrawn);

    const requestWithdrawal = useMutation({
        mutationFn: async () => {
            const { data, error } = await (supabase as any).rpc("request_withdrawal", {
                p_user_id: user?.id,
                p_amount: parseFloat(amount),
                p_bank_name: bankName,
                p_account_number: accountNumber,
                p_account_name: accountName,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Withdrawal failed");
            return data;
        },
        onSuccess: () => {
            toast.success("Withdrawal request submitted!", { description: "An admin will process it shortly." });
            queryClient.invalidateQueries({ queryKey: ["rider-wallet", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["rider-withdrawals", user?.id] });
            setWithdrawOpen(false);
            setAmount(""); setBankName(""); setAccountNumber(""); setAccountName("");
        },
        onError: (err: any) => toast.error(err.message || "Withdrawal request failed"),
    });

    const handleViewReceipt = (payout: any) => {
        setSelectedPayout(payout);
        setReceiptOpen(true);
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            pending: "bg-amber-100 text-amber-700",
            approved: "bg-blue-100 text-blue-700",
            processing: "bg-purple-100 text-purple-700",
            completed: "bg-green-100 text-green-700",
            rejected: "bg-red-100 text-red-700",
        };
        return (
            <Badge className={cn("font-black text-[9px] uppercase tracking-wider border-none px-2 py-0.5 rounded-full", map[status] || "bg-muted text-muted-foreground")}>
                {status}
            </Badge>
        );
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Wallet Balance Hero */}
            <Card className="rounded-xl border-none overflow-hidden shadow-2xl shadow-primary/20 bg-gradient-to-br from-primary via-primary to-primary/80 text-white relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
                <CardContent className="p-10 relative space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                            <Wallet size={28} strokeWidth={2.5} />
                        </div>
                        <Badge className="bg-white/20 text-white border-none rounded-full px-4 font-black text-[10px] uppercase tracking-widest">
                            Rider Wallet
                        </Badge>
                    </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-white/60">Available Balance</p>
                            <h2 className="text-5xl font-black tracking-tighter mt-1">
                                <span className="text-2xl opacity-60 mr-1">₦</span>
                                {(wallet?.balance || 0).toLocaleString()}
                            </h2>
                            <div className="flex items-center gap-4 mt-2">
                                <p className="text-[10px] text-white/70 font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-lg">
                                    ₦{pendingBalance.toLocaleString()} Settling
                                </p>
                                <p className="text-xs text-white/50 font-medium">
                                    {completedShipments.length} completed deliveries
                                </p>
                            </div>
                        </div>
                    <Button
                        onClick={() => setWithdrawOpen(true)}
                        disabled={!wallet?.balance || wallet.balance <= 0}
                        className="bg-white text-primary rounded-xl h-14 px-10 font-black text-xs uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 gap-2"
                    >
                        <ArrowDownToLine size={16} strokeWidth={3} /> Withdraw Earnings
                    </Button>
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Pending Cut", value: pendingBalance, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Today", value: todayEarnings, icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Total History", value: totalEarnings, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
                ].map((card, i) => (
                    <Card key={i} className="border-none shadow-sm rounded-xl">
                        <CardContent className="p-8 flex items-center gap-5">
                            <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0", card.bg, card.color)}>
                                <card.icon size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{card.label}</p>
                                <p className="text-2xl font-black text-foreground mt-0.5">{card.value.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Completed Deliveries Table */}
            <section className="space-y-4">
                <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                    <Package size={18} strokeWidth={2.5} /> Completed Deliveries
                </h2>
                {deliveryFees.length === 0 ? (
                    <div className="py-14 text-center border-2 border-dashed border-black/5 rounded-xl text-muted-foreground text-sm font-medium">
                        <TrendingUp size={32} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
                        No earnings history found.
                    </div>
                ) : (
                    <Card className="border-none shadow-xl shadow-black/[0.02] rounded-xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pl-8">Type</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Details</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Date</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pr-8 text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {riderTransactions.filter((t: any) => t.type === 'delivery_fee').map((t: any) => (
                                    <TableRow key={t.id} className="border-black/[0.03]">
                                        <TableCell className="pl-8">
                                            <Badge variant="outline" className={cn("font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full", t.status === 'pending' ? "border-amber-200 text-amber-700 bg-amber-50" : "border-green-200 text-green-700 bg-green-50")}>
                                                Delivery Fee
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold">{t.reference || "Order Fee"}</TableCell>
                                        <TableCell className="text-xs font-medium">
                                            {new Date(t.created_at).toLocaleDateString()}
                                            {t.status === 'pending' && (
                                                <Badge variant="outline" className="ml-2 text-[7px] font-black uppercase border-amber-200 text-amber-700 bg-amber-50 py-0 px-1.5 h-auto">On Hold</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={cn("text-sm font-black", t.status === 'pending' ? "text-amber-600" : "text-green-600")}>
                                                    {t.status === 'pending' ? "" : "+"}₦{(t.amount || 0).toLocaleString()}
                                                </span>
                                                {t.status === 'pending' && t.metadata?.reason && (
                                                    <span className="text-[8px] text-muted-foreground font-medium italic leading-tight">
                                                        {t.metadata.reason}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}
            </section>

            {/* Withdrawal History */}
            {payoutRequests.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-xl font-black tracking-tight">Withdrawal History</h2>
                    <Card className="border-none shadow-xl shadow-black/[0.02] rounded-xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pl-8">Date</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Bank Details</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Amount</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 text-center">Status</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pr-8 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payoutRequests.map((p: any) => (
                                    <TableRow key={p.id} className="border-black/[0.03]">
                                        <TableCell className="font-medium text-xs pl-8">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <p className="text-xs font-bold">{p.bank_name}</p>
                                            <p className="text-[10px] text-muted-foreground">{p.account_number}</p>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm font-black text-primary">₦{p.amount?.toLocaleString()}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground">Fee: ₦{p.fee_amount?.toLocaleString()}</p>
                                        </TableCell>
                                        <TableCell className="text-center">{statusBadge(p.status)}</TableCell>
                                        <TableCell className="text-right pr-8">
                                            <Button 
                                                variant="ghost" size="sm" 
                                                className="h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-primary/5 text-primary"
                                                onClick={() => handleViewReceipt(p)}
                                            >
                                                Receipt
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </section>
            )}

            {/* Premium Payout Modals */}
            <PayoutRequestModal 
                isOpen={withdrawOpen} 
                onClose={() => setWithdrawOpen(false)} 
                wallet={wallet} 
            />

            {selectedPayout && (
                <PayoutReceiptModal
                    isOpen={receiptOpen}
                    onClose={() => setReceiptOpen(false)}
                    request={selectedPayout}
                />
            )}
        </div>
    );
}

