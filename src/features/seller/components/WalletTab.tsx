import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Wallet, TrendingUp, Clock, Calendar, PackageCheck, ArrowDownToLine, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { PayoutRequestModal } from "./PayoutRequestModal";
import { PayoutReceiptModal } from "./PayoutReceiptModal";
import { useState } from "react";
import { format } from "date-fns";
import { Receipt } from "lucide-react";
export function WalletTab() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

    // Real wallet balance
    const { data: wallet } = useQuery({
        queryKey: ["wallet", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data } = await supabase
                .from("wallets")
                .select("id, balance, escrow_balance")
                .or(`seller_id.eq.${user.id},user_id.eq.${user.id}`)
                .maybeSingle();
            return data;
        },
        enabled: !!user,
    });

    // Real transaction history from wallet_transactions
    const { data: transactions = [] } = useQuery({
        queryKey: ["wallet-transactions", wallet?.id],
        queryFn: async () => {
            if (!wallet?.id) return [];
            const { data } = await supabase
                .from("wallet_transactions")
                .select("id, amount, type, reference, created_at, status, metadata")
                .eq("wallet_id", wallet.id)
                .order("created_at", { ascending: false })
                .limit(20);
            return data ?? [];
        },
        enabled: !!wallet?.id,
    });

    // Completed shipments for this seller €” shows order-level settlement history
    const { data: completedShipments = [] } = useQuery({
        queryKey: ["seller-completed-shipments", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data } = await supabase
                .from("shipments")
                .select(`
                    id,
                    order_id,
                    delivery_fee,
                    created_at,
                    orders!inner(total, status, updated_at)
                `)
                .eq("seller_id", user.id)
                .eq("orders.status", "completed")
                .order("created_at", { ascending: false })
                .limit(20);
            return data ?? [];
        },
        enabled: !!user,
    });

    // Payout requests history
    const { data: payoutRequests = [] } = useQuery({
        queryKey: ["payout-requests", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payout_requests")
                .select("*")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false });
                
            if (error) console.error("Payout history fetch error:", error);
            return data ?? [];
        },
        enabled: !!user?.id
    });

    // Real-time wallet updates
    useEffect(() => {
        if (!user || !wallet?.id) return;
        const ch = supabase
            .channel("seller-wallet-tab-rt")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets" },
                () => queryClient.invalidateQueries({ queryKey: ["wallet", user.id] }))
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["wallet", user.id] });
                    queryClient.invalidateQueries({ queryKey: ["wallet-transactions", wallet.id] });
                    queryClient.invalidateQueries({ queryKey: ["seller-completed-shipments", user.id] });
                })
            .on("postgres_changes", { event: "*", schema: "public", table: "payout_requests", filter: `seller_id=eq.${user.id}` },
                () => queryClient.invalidateQueries({ queryKey: ["payout-requests", user.id] }))
            .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" },
                () => queryClient.invalidateQueries({ queryKey: ["payout-settings"] }))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user, wallet?.id, queryClient]);

    const settlementTransactions = transactions.filter((t: any) => t.type === "settlement" && t.status === "success");
    const totalSettled = settlementTransactions.reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
    const escrowBalance = wallet?.escrow_balance ?? 0;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthlySettled = settlementTransactions
        .filter((t: any) => new Date(t.created_at) >= thisMonth)
        .reduce((acc: number, t: any) => acc + (t.amount || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Liquidity Hub</p>
                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">Financial Treasury</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                {/* Main balance card */}
                <Card className="md:col-span-2 rounded-xl bg-gradient-to-br from-primary via-primary to-primary-foreground border-none text-white p-6 relative overflow-hidden shadow-2xl shadow-primary/30">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-8 -mb-8" />
                    <div className="relative space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <Wallet size={22} strokeWidth={3} />
                            </div>
                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-none rounded-full px-3 text-[9px] font-black uppercase tracking-widest">Master Safe</Badge>
                        </div>
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Available Balance</p>
                                <h2 className="text-4xl font-black tracking-tighter">
                                    <span className="text-xl mr-1 opacity-50 font-bold">₦</span>
                                    {(wallet?.balance ?? 0).toLocaleString()}
                                </h2>
                                <p className="text-[10px] text-white/50 font-medium">Total settled: ₦{totalSettled.toLocaleString()}</p>
                            </div>
                            <Button
                                onClick={() => setIsPayoutModalOpen(true)}
                                className="bg-white text-primary hover:bg-white/90 rounded-xl h-12 px-6 font-black text-[11px] uppercase tracking-widest shadow-xl shadow-black/10"
                            >
                                <ArrowDownToLine size={16} className="mr-2" />
                                Withdraw Funds
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="space-y-3">
                    <div className="p-5 rounded-xl bg-white border border-black/5 shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">This Month</p>
                        <p className="text-2xl font-black text-foreground tracking-tight">₦{monthlySettled.toLocaleString()}</p>
                        <div className="flex items-center gap-1.5 text-green-500 mt-1.5">
                            <TrendingUp size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{settlementTransactions.length} orders</span>
                        </div>
                    </div>
                    <div className="p-5 rounded-xl bg-white border border-black/5 shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-500">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Escrow (Pending)</p>
                        <p className="text-2xl font-black text-foreground tracking-tight">₦{escrowBalance.toLocaleString()}</p>
                        <div className="flex items-center gap-1.5 text-amber-500 mt-1.5">
                            <Clock size={14} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Buyer</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Completed Orders Settlement Table */}
            {completedShipments.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                        <PackageCheck size={12} className="inline mr-2" />Settled Orders
                    </h3>
                    <Card className="border-none shadow-xl rounded-xl overflow-hidden max-w-full">
                        <div className="overflow-x-auto no-scrollbar">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pl-8 min-w-[120px]">Order</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 min-w-[100px]">Date</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 min-w-[120px]">Customer Paid</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pr-8 text-right min-w-[120px]">Your Payout</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {completedShipments.map((s: any) => {
                                        const orderTotal = s.orders?.total ?? 0;
                                        // Match with transaction if available (via metadata or reference fallback)
                                        const tx = transactions.find((t: any) =>
                                            t.type === 'settlement' &&
                                            (t.metadata?.order_id === s.order_id || t.reference?.includes(s.order_id))
                                        );
                                        const payout = tx ? tx.amount : null;
                                        const txMetadata = tx?.metadata as { reason?: string } | null;

                                        return (
                                            <TableRow key={s.id} className="border-black/[0.03]">
                                                <TableCell className="font-mono text-xs pl-8 text-muted-foreground">#{s.order_id?.slice(0, 8)}</TableCell>
                                                <TableCell className="text-xs font-medium">{new Date(s.orders?.updated_at ?? s.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-sm font-bold text-muted-foreground">₦{orderTotal.toLocaleString()}</TableCell>
                                                <TableCell className="text-right pr-8">
                                                    {payout !== null && tx?.status === 'success' ? (
                                                        <span className="text-sm font-black text-green-600">+₦{payout.toLocaleString()}</span>
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-200 text-amber-700 bg-amber-50">Pending Settlement</Badge>
                                                            {txMetadata?.reason && (
                                                                <span className="text-[8px] text-muted-foreground font-medium max-w-[100px] text-right leading-tight italic">
                                                                    {txMetadata.reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}

            {/* Payout Requests History */}
            {payoutRequests.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">Payout History</h3>
                    <div className="grid gap-3">
                        {payoutRequests.map((req: any) => (
                            <div key={req.id} className="p-4 bg-white border border-black/[0.03] rounded-xl flex items-center justify-between group hover:shadow-xl hover:shadow-black/[0.02] transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-11 h-11 rounded-xl flex items-center justify-center",
                                        req.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                                            req.status === 'rejected' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                        <Landmark size={18} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-black text-foreground uppercase tracking-tight">Withdrawal Request</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={cn(
                                                "text-[8px] font-black uppercase px-2 py-0 border-none rounded-full",
                                                req.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                                    req.status === 'rejected' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                            )}>
                                                {req.status}
                                            </Badge>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                {req.created_at ? format(new Date(req.created_at), "MMM d, yyyy") : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <p className="text-lg font-black tracking-tighter text-foreground">₦{req.amount.toLocaleString()}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Fee: ₦{req.fee_amount.toLocaleString()}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100"
                                        onClick={() => setSelectedReceipt(req)}
                                    >
                                        <Receipt size={14} className="text-muted-foreground" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Transaction history */}
            {transactions.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">Transaction History</h3>
                    <div className="grid gap-2">
                        {transactions.map((t: any) => (
                            <div key={t.id} className="group flex items-center justify-between p-4 bg-white border border-black/[0.03] rounded-xl hover:shadow-xl hover:shadow-black/[0.02] transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-inner",
                                        t.amount > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                                        <TrendingUp size={18} strokeWidth={3} className={cn(t.amount < 0 && "rotate-180")} />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-black text-foreground uppercase tracking-tight">{String(t.type).replace(/_/g, " ")}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                            <Calendar size={10} />
                                            {new Date(t.created_at).toLocaleDateString()}
                                            {t.reference && <span className="opacity-50 font-mono normal-case">· {t.reference}</span>}
                                            {t.status === 'pending' && (
                                                <Badge variant="outline" className="ml-2 text-[7px] font-black uppercase border-amber-200 text-amber-700 bg-amber-50 py-0 px-1.5 h-auto">On Hold</Badge>
                                            )}
                                        </p>
                                        {t.status === 'pending' && (t.metadata as any)?.reason && (
                                            <p className="text-[8px] text-amber-600 font-bold italic mt-1 leading-none">{(t.metadata as any).reason}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={cn("text-lg font-black tracking-tighter", t.amount > 0 ? "text-green-600" : "text-red-500")}>
                                        {t.amount > 0 ? "+" : "-"} ₦{Math.abs(t.amount).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <PayoutRequestModal
                isOpen={isPayoutModalOpen}
                onClose={() => setIsPayoutModalOpen(false)}
                wallet={wallet}
            />

            <PayoutReceiptModal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                request={selectedReceipt}
            />
        </div>
    );
}

