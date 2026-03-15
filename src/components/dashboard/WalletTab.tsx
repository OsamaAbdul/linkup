import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, TrendingUp, Clock, Calendar, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function WalletTab() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Real wallet balance
    const { data: wallet } = useQuery({
        queryKey: ["wallet", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data } = await (supabase as any)
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
                .select("id, amount, type, reference, created_at")
                .eq("wallet_id", wallet.id)
                .order("created_at", { ascending: false })
                .limit(20);
            return data ?? [];
        },
        enabled: !!wallet?.id,
    });

    // Completed shipments for this seller — shows order-level settlement history
    const { data: completedShipments = [] } = useQuery({
        queryKey: ["seller-completed-shipments", user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data } = await (supabase as any)
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
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [user, wallet?.id, queryClient]);

    const settlementTransactions = transactions.filter((t: any) => t.type === "settlement");
    const totalSettled = settlementTransactions.reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
    const escrowBalance = wallet?.escrow_balance ?? 0;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthlySettled = settlementTransactions
        .filter((t: any) => new Date(t.created_at) >= thisMonth)
        .reduce((acc: number, t: any) => acc + (t.amount || 0), 0);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mb-1">Liquidity Hub</p>
                <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Financial Treasury</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Main balance card */}
                <Card className="md:col-span-2 rounded-[3rem] bg-gradient-to-br from-primary via-primary to-primary-foreground border-none text-white p-10 relative overflow-hidden shadow-2xl shadow-primary/30">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10" />
                    <div className="relative space-y-10">
                        <div className="flex justify-between items-start">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <Wallet size={28} strokeWidth={3} />
                            </div>
                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-none rounded-full px-4 text-[10px] font-black uppercase tracking-widest">Master Safe</Badge>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Available Balance</p>
                            <h2 className="text-6xl font-black tracking-tighter">
                                <span className="text-2xl mr-1 opacity-50 font-bold">₦</span>
                                {(wallet?.balance ?? 0).toLocaleString()}
                            </h2>
                            <p className="text-xs text-white/50 font-medium">Total settled: ₦{totalSettled.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <div className="space-y-4">
                    <div className="p-8 rounded-[2.5rem] bg-white border border-black/5 shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">This Month</p>
                        <p className="text-3xl font-black text-foreground tracking-tight">₦{monthlySettled.toLocaleString()}</p>
                        <div className="flex items-center gap-2 text-green-500 mt-2">
                            <TrendingUp size={16} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{settlementTransactions.length} orders</span>
                        </div>
                    </div>
                    <div className="p-8 rounded-[2.5rem] bg-white border border-black/5 shadow-xl shadow-black/[0.02] hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-500">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Escrow (Pending)</p>
                        <p className="text-3xl font-black text-foreground tracking-tight">₦{escrowBalance.toLocaleString()}</p>
                        <div className="flex items-center gap-2 text-amber-500 mt-2">
                            <Clock size={16} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Buyer</span>
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
                    <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pl-8">Order</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Date</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Order Total</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 pr-8 text-right">You Received (Full Price)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {completedShipments.map((s: any) => {
                                    const orderTotal = s.orders?.total ?? 0;
                                    return (
                                        <TableRow key={s.id} className="border-black/[0.03]">
                                            <TableCell className="font-mono text-xs pl-8 text-muted-foreground">#{s.order_id?.slice(0, 8)}</TableCell>
                                            <TableCell className="text-xs font-medium">{new Date(s.orders?.updated_at ?? s.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-sm font-bold">₦{orderTotal.toLocaleString()}</TableCell>
                                            <TableCell className="text-right pr-8 text-sm font-black text-green-600">+₦{orderTotal.toLocaleString()}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* Transaction history */}
            {transactions.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Transaction History</h3>
                    <div className="grid gap-3">
                        {transactions.map((t: any) => (
                            <div key={t.id} className="group flex items-center justify-between p-6 bg-white border border-black/[0.03] rounded-3xl hover:shadow-xl hover:shadow-black/[0.02] transition-all duration-300">
                                <div className="flex items-center gap-5">
                                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner",
                                        t.amount > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                                        <TrendingUp size={20} strokeWidth={3} className={cn(t.amount < 0 && "rotate-180")} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground uppercase tracking-tight">{String(t.type).replace(/_/g, " ")}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Calendar size={12} />
                                            {new Date(t.created_at).toLocaleDateString()}
                                            {t.reference && <span className="opacity-50 font-mono normal-case">· {t.reference}</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={cn("text-xl font-black tracking-tighter", t.amount > 0 ? "text-green-600" : "text-red-500")}>
                                        {t.amount > 0 ? "+" : "-"} ₦{Math.abs(t.amount).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {transactions.length === 0 && completedShipments.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-black/5 rounded-[2rem] text-muted-foreground text-sm font-medium">
                    <Wallet size={36} strokeWidth={1} className="mx-auto mb-3 opacity-20" />
                    No transactions yet. Revenue will appear here when buyers confirm receipt.
                </div>
            )}
        </div>
    );
}
