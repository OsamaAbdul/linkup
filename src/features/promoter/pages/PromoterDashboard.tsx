import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import {
  Copy,
  DollarSign,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  Link2,
  Package,
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { PromoteAction } from "@/features/promoter/components/PromoteAction";

import { ProfileCompletionBanner } from "@/shared/components/ProfileCompletionBanner";

export default function PromoterDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Get or create promoter code
  const { data: promoterCode, isLoading: codeLoading } = useQuery({
    queryKey: ["promoter-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("promoter_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[PromoterDebug] Error fetching code:", error);
      }

      if (data) return data.code;

      const code = "PX" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: insertError } = await supabase.from("promoter_codes").insert({ user_id: user.id, code });

      if (insertError) {
        console.error("[PromoterDebug] Error inserting code:", insertError);
      }

      return code;
    },
    enabled: !!user,
  });

  // Commissions
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ["commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("order_settlements")
        .select(`
          id,
          promoter_amount,
          status,
          created_at,
          order_id,
          orders!inner(promoter_id)
        `)
        .eq("orders.promoter_id", user.id)
        .gt("promoter_amount", 0)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[PromoterDebug] Error fetching order_settlements:", error);
      }


      return (data || []).map((d: any) => ({
        ...d,
        amount: d.promoter_amount
      }));
    },
    enabled: !!user,
  });

  // Wallet and Balance
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["promoter-wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase
        .from("wallets" as any)
        .select("balance, escrow_balance")
        .eq("user_id", user.id)
        .maybeSingle() as any);

      console.log("[PromoterDebug] Wallet Balance State:", {
        available: data?.balance,
        escrow: data?.escrow_balance
      });
      return data;
    },
    enabled: !!user,
  });

  // Referrals Table (Debug/Audit)
  const { data: referrals = [] } = useQuery({
    queryKey: ["promoter-referrals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("referrals")
        .select("id, status, created_at, order_id, orders(buyer_id), promoter_campaigns(product_id)")
        .eq("promoter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      console.log("[PromoterDebug] Referrals Table Data:", data);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Payout Requests (Updated from legacy withdrawal_requests)
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["promoter-withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase
        .from("payout_requests" as any)
        .select("id, amount, status, created_at, admin_notes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20) as any);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Real-time Sync
  useEffect(() => {
    if (!user) return;

    // Listen for payout status changes
    const payoutChannel = supabase
      .channel('payout-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["promoter-withdrawals"] });
          queryClient.invalidateQueries({ queryKey: ["promoter-wallet"] });
        }
      )
      .subscribe();

    // Listen for balance changes
    const walletChannel = supabase
      .channel('wallet-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["promoter-wallet"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(payoutChannel);
      supabase.removeChannel(walletChannel);
    };
  }, [user, queryClient]);

  // Marketplace Products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["promoter-marketplace"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("products" as any)
        .select("id, title, price, images, description, inventory")
        .gt("inventory", 0)
        .order("created_at", { ascending: false })
        .limit(20) as any);
      return data ?? [];
    },
  });

  // Withdrawal Mutation
  const withdrawalMutation = useMutation({
    mutationFn: async (payload: { amount: number, bankName: string, accountNumber: string, accountName: string }) => {
      const { data, error } = await (supabase.rpc as any)("request_withdrawal", {
        p_user_id: user?.id,
        p_amount: payload.amount,
        p_bank_name: payload.bankName,
        p_account_number: payload.accountNumber,
        p_account_name: payload.accountName
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success("Withdrawal request submitted!");
        setWithdrawalAmount("");
        setBankName("");
        setAccountNumber("");
        setAccountName("");
        setIsWithdrawModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ["promoter-wallet"] });
        queryClient.invalidateQueries({ queryKey: ["promoter-withdrawals"] });
      } else {
        toast.error(data.error || "Failed to submit withdrawal");
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred");
    }
  });

  const handleWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!bankName || !accountNumber || !accountName) {
      toast.error("Please fill in all bank details");
      return;
    }

    if (accountNumber.length !== 10) {
      toast.error("Account number must be 10 digits");
      return;
    }

    if (wallet && amount > wallet.balance) {
      toast.error(`Insufficient balance. You only have ₦${wallet.balance.toLocaleString()} available.`);
      return;
    }

    withdrawalMutation.mutate({
      amount,
      bankName,
      accountNumber,
      accountName
    });
  };

  // Stats calculation
  const totalEarnings = commissions.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const pendingEarnings = commissions
    .filter((c: any) => c.status === "pending")
    .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  const totalOrders = commissions.length;

  console.log(`[PromoterDebug] Render Stats:`, {
    totalEarnings,
    pendingEarnings,
    totalOrders,
    commissionsCount: commissions.length,
    referralsCount: referrals.length
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <ProfileCompletionBanner />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Promoter Hub</h1>
            <p className="text-muted-foreground">Manage your promotions, track earnings, and withdraw funds.</p>
          </div>

          <div className="flex gap-4 shrink-0">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Wallet className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Available</p>
                  <p className="text-xl font-bold text-primary">₦{wallet?.balance?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 bg-amber-500/10 rounded-full">
                  <Clock className="text-amber-600" size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">In Escrow</p>
                  <p className="text-xl font-bold text-amber-600">₦{wallet?.escrow_balance?.toLocaleString() ?? "0"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/50 p-1">
            <TabsTrigger value="overview" className="gap-2">
              <TrendingUp size={16} /> Overview
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-2">
              <Package size={16} /> Marketplace
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign size={16} /> Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Referral Code */}
            <Card className="overflow-hidden border-none bg-gradient-to-r from-primary/10 via-primary/5 to-background border-l-4 border-l-primary">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <h3 className="text-lg font-bold">Your Promoter Identity</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Share this code with your audience. Every purchase made using your code earns you a 5% commission instantly.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-background/50 p-2 rounded-xl border border-primary/10 shadow-sm">
                  {codeLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <code className="text-2xl font-black text-primary tracking-[0.2em] px-4">{promoterCode}</code>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-primary/10"
                    onClick={() => {
                      navigator.clipboard.writeText(promoterCode || "");
                      toast.success("Code copied!");
                    }}
                  >
                    <Copy size={18} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="hover:shadow-md transition-shadow cursor-default">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total Revenue Generated</p>
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <TrendingUp className="text-green-600" size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">₦{((wallet?.balance || 0) + (wallet?.escrow_balance || 0)).toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-default">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Pending Settlement</p>
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Clock className="text-amber-600" size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">₦{wallet?.escrow_balance?.toLocaleString() ?? "0"}</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-default">
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Total Conversions</p>
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <ShoppingCart className="text-blue-600" size={18} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{referrals.filter((r: any) => r.status === "conversion").length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent History */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Recent Earnings</CardTitle>
                    <CardDescription>Your last commission settlements</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">View All</Button>
                </CardHeader>
                <CardContent>
                  {commissionsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : commissions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Link2 className="mx-auto mb-4 opacity-20" size={48} />
                      <p>No earnings yet. Start promoting products!</p>
                    </div>
                  ) : (
                    <div className="relative overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                            <th className="px-4 py-3 font-medium text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commissions.slice(0, 5).map((c: any) => (
                            <tr key={c.id} className="border-b border-muted/50 last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-4">{new Date(c.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-4 text-right font-bold">₦{Number(c.amount).toLocaleString()}</td>
                              <td className="px-4 py-4 text-center">
                                <Badge variant={c.status === "paid" ? "default" : "secondary"} className="rounded-full px-3 text-[10px]">
                                  {c.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Referral Tracking</CardTitle>
                    <CardDescription>Real-time click & attribution logs</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px]">Live</Badge>
                </CardHeader>
                <CardContent>
                  {referrals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MousePointerClick className="mx-auto mb-4 opacity-20" size={48} />
                      <p>No clicks tracked yet.</p>
                    </div>
                  ) : (
                    <div className="relative overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Device/Buyer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referrals.slice(0, 5).map((r: any) => (
                            <tr key={r.id} className="border-b border-muted/50 last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-4">
                                <p className="text-xs">{new Date(r.created_at).toLocaleDateString()}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</p>
                              </td>
                              <td className="px-4 py-4">
                                <Badge variant={r.status === "conversion" ? "default" : "outline"} className="rounded-full px-2 text-[9px] uppercase font-bold">
                                  {r.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[100px]">
                                    {r.orders?.buyer_id ? "Buyer: " + r.orders.buyer_id.slice(0, 8) : "Click ID: " + r.id.slice(0, 8)}
                                  </span>
                                  {r.promoter_campaigns?.product_id && (
                                    <span className="text-[9px] text-primary flex items-center gap-1">
                                      <Package size={8} /> Product: {r.promoter_campaigns.product_id.slice(0, 6)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Marketplace</h2>
              <div className="text-sm text-muted-foreground">
                Showing {products.length} popular products
              </div>
            </div>

            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-40 w-full" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card className="text-center py-12">
                <Package className="mx-auto mb-4 opacity-20" size={48} />
                <p className="text-muted-foreground">The marketplace is empty right now. Check back later!</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((p: any) => (
                  <Card key={p.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-all group border-muted/50">
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      <img
                        src={p.images?.[0] || "/placeholder.svg"}
                        alt={p.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <Badge className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border-none">
                        5% Comm.
                      </Badge>
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3 className="font-bold line-clamp-1 h-5">{p.title}</h3>
                        <p className="text-primary font-bold text-lg mt-1">₦{p.price.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                      </div>
                      <div className="pt-2 flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {p.inventory} in stock
                        </Badge>
                        <PromoteAction
                          productId={p.id}
                          productTitle={p.title}
                          promoterCode={promoterCode || ""}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Withdrawal Form */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Withdraw Funds</CardTitle>
                  <CardDescription>Minimum withdrawal is ₦1,000</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                    <p className="text-xs text-muted-foreground uppercase font-medium">Available for Payout</p>
                    <p className="text-3xl font-black">₦{wallet?.balance?.toLocaleString() ?? "0"}</p>
                  </div>

                  <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full h-12 gap-2"
                        size="lg"
                        disabled={!wallet || wallet.balance < 1000}
                      >
                        Request Withdrawal <ArrowUpRight size={18} />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Withdraw Funds</DialogTitle>
                        <DialogDescription>
                          Earnings will be sent to your bank account after admin approval.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleWithdrawal} className="space-y-4 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="amount">Amount to Withdraw (₦)</Label>
                            {wallet && (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-[10px]"
                                onClick={() => setWithdrawalAmount(wallet.balance.toString())}
                              >
                                Use Max: ₦{wallet.balance.toLocaleString()}
                              </Button>
                            )}
                          </div>
                          <Input
                            id="amount"
                            type="number"
                            placeholder="Min. 1,000"
                            value={withdrawalAmount}
                            onChange={(e) => setWithdrawalAmount(e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="bank">Bank Name</Label>
                          <Input
                            id="bank"
                            placeholder="e.g. GTBank, Zenith"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="account">Account Number</Label>
                          <Input
                            id="account"
                            placeholder="10-digit number"
                            maxLength={10}
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="name">Account Name</Label>
                          <Input
                            id="name"
                            placeholder="Full name on account"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            required
                          />
                        </div>

                        <DialogFooter className="pt-4">
                          <Button
                            type="submit"
                            className="w-full h-12"
                            disabled={withdrawalMutation.isPending}
                          >
                            {withdrawalMutation.isPending ? "Submitting..." : "Confirm Withdrawal"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {(!wallet || wallet.balance < 1000) && (
                    <p className="text-[10px] text-center text-amber-600 flex items-center justify-center gap-1">
                      <AlertCircle size={10} /> Insufficient balance (min ₦1,000)
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Payout History</CardTitle>
                  <CardDescription>Track your withdrawal requests and their status</CardDescription>
                </CardHeader>
                <CardContent>
                  {withdrawalsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : withdrawals.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="mx-auto mb-4 opacity-20" size={48} />
                      <p>No withdrawal requests yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {withdrawals.map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-muted/50">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${w.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                              w.status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                                'bg-amber-500/10 text-amber-600'
                              }`}>
                              {w.status === 'completed' ? <CheckCircle2 size={20} /> :
                                w.status === 'rejected' ? <XCircle size={20} /> :
                                  <Clock size={20} />}
                            </div>
                            <div>
                              <p className="font-bold">₦{Number(w.amount).toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()} at {new Date(w.created_at).toLocaleTimeString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="capitalize rounded-lg px-3">
                              {w.status}
                            </Badge>
                            {w.admin_notes && (
                              <p className="text-[10px] text-muted-foreground mt-1 max-w-[150px] line-clamp-1">{w.admin_notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
