import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpRight,
  Clock,
  Landmark,
  ShieldCheck,
  RotateCcw,
  Package,
  Send,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Receipt,
  HelpCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PayoutRequestModal } from "@/features/seller/components/PayoutRequestModal";
import { format } from "date-fns";

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Fetch real wallet
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["user-wallet", user?.id],
    queryFn: async () => {
      if (!user) return null;
      let { data, error } = await supabase
        .from("wallets")
        .select("id, balance, escrow_balance, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // If no wallet row yet, create one
      if (!data && !error) {
        const { data: created, error: createError } = await supabase
          .from("wallets")
          .insert({ user_id: user.id, balance: 0, escrow_balance: 0 })
          .select()
          .single();
        if (!createError) data = created;
      }
      return data;
    },
    enabled: !!user,
  });

  // Fetch wallet transactions
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["user-wallet-transactions", wallet?.id],
    queryFn: async () => {
      if (!wallet?.id) return [];
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, amount, type, reference, created_at")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.warn("Wallet transactions fetch error:", error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!wallet?.id,
  });

  // Fetch pending payout requests
  const { data: pendingPayouts = [] } = useQuery({
    queryKey: ["user-pending-payouts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("payout_requests")
        .select("id, amount, status, bank_name, account_number, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user profile for saved bank details
  const { data: profile } = useQuery({
    queryKey: ["user-profile-bank", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("payout_bank_name, payout_account_number, payout_account_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const availableBalance = Number(wallet?.balance || 0);
  const escrowBalance = Number(wallet?.escrow_balance || 0);

  const getTxTypeBadge = (type: string) => {
    const lower = (type || "").toLowerCase();
    if (lower.includes("refund")) {
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold hover:bg-emerald-100">
          <RotateCcw size={11} className="mr-1" /> Refund
        </Badge>
      );
    }
    if (lower.includes("payout") || lower.includes("withdraw")) {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold hover:bg-blue-100">
          <ArrowDownToLine size={11} className="mr-1" /> Withdrawal
        </Badge>
      );
    }
    if (lower.includes("credit") || lower.includes("deposit")) {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold hover:bg-purple-100">
          <ArrowUpRight size={11} className="mr-1" /> Credit
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="font-semibold capitalize">
        {type}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full h-10 w-10 shrink-0 border"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
                <Wallet className="h-7 w-7 text-primary" />
                My Wallet & Refunds
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage your refunded balances, delivery credits, and bank withdrawals.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsWithdrawModalOpen(true)}
              disabled={availableBalance <= 0}
              className="rounded-2xl h-11 px-5 font-bold shadow-md shadow-primary/20 gap-2"
            >
              <ArrowDownToLine size={17} />
              Withdraw Funds
            </Button>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Available Balance */}
          <Card className="rounded-3xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="absolute right-3 top-3 opacity-10 text-primary">
              <Wallet size={80} />
            </div>
            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  Available Balance
                </span>
                <Badge variant="outline" className="bg-background/80 text-[10px] text-emerald-700 border-emerald-300">
                  Ready to Withdraw
                </Badge>
              </div>

              <div>
                <p className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                  ₦{availableBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Includes order refunds, cancellations & credits
                </p>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setIsWithdrawModalOpen(true)}
                  disabled={availableBalance <= 0}
                  className="h-8 text-xs font-bold rounded-xl gap-1"
                >
                  <ArrowDownToLine size={13} />
                  Withdraw to Bank
                </Button>
                <Link to="/send">
                  <Button size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-xl gap-1">
                    <Send size={13} className="text-primary" />
                    Send Package
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          {/* Escrow Balance */}
          <Card className="rounded-3xl border-border bg-card p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-500" />
                  In Escrow
                </span>
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                  Protected
                </Badge>
              </div>

              <div>
                <p className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                  ₦{escrowBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Held securely in escrow during active shipments
                </p>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock size={12} className="text-amber-600" /> Automatically released once delivery is completed.
                </p>
              </div>
            </div>
          </Card>

          {/* Saved Bank Details Card */}
          <Card className="rounded-3xl border-border bg-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Landmark size={14} className="text-blue-600" />
                  Payout Bank Account
                </span>
              </div>

              {profile?.payout_bank_name && profile?.payout_account_number ? (
                <div className="p-3 rounded-2xl bg-muted/60 space-y-1">
                  <p className="text-xs font-bold text-foreground">
                    {profile.payout_bank_name}
                  </p>
                  <p className="text-sm font-mono font-bold text-primary">
                    {profile.payout_account_number}
                  </p>
                  {profile.payout_account_name && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {profile.payout_account_name}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <p className="text-xs font-bold flex items-center gap-1">
                    <AlertCircle size={13} className="text-amber-600" /> No Bank Account Saved
                  </p>
                  <p className="text-[11px] text-amber-800">
                    You can enter your bank details when requesting your withdrawal.
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsWithdrawModalOpen(true)}
              className="h-8 text-xs text-primary hover:text-primary font-semibold w-full justify-start p-0 mt-2"
            >
              {profile?.payout_account_number ? "Change Payout Account →" : "Add Bank Account →"}
            </Button>
          </Card>
        </div>

        {/* Pending Withdrawal Requests (if any) */}
        {pendingPayouts.length > 0 && (
          <Card className="rounded-3xl border-border bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                Recent Payout Requests
              </h3>
            </div>
            <div className="space-y-2">
              {pendingPayouts.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-2xl border bg-muted/30 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-foreground">
                      ₦{Number(p.amount).toLocaleString()} to {p.bank_name} ({p.account_number})
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Requested {format(new Date(p.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize font-bold text-[10px] ${
                      p.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : p.status === "pending"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Transaction History */}
        <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Receipt size={18} className="text-primary" />
                  Transaction & Refund History
                </CardTitle>
                <CardDescription className="text-xs">
                  All credits, refunds from cancelled packages, and bank withdrawals.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {txLoading ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                Loading wallet transactions...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Wallet size={24} />
                </div>
                <p className="text-sm font-bold text-foreground">No Transactions Yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  When you receive a refund for a cancelled package or make a withdrawal, your transaction history will show up here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {transactions.map((tx: any) => {
                  const isPositive =
                    tx.type?.includes("refund") ||
                    tx.type?.includes("credit") ||
                    tx.type?.includes("deposit");

                  return (
                    <div
                      key={tx.id}
                      className="p-4 sm:p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            isPositive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isPositive ? <RotateCcw size={18} /> : <ArrowDownToLine size={18} />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-foreground">
                              {tx.reference || (isPositive ? "Wallet Refund / Credit" : "Withdrawal")}
                            </span>
                            {getTxTypeBadge(tx.type)}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(tx.created_at), "MMM d, yyyy · h:mm a")}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-black text-xs sm:text-sm ${
                            isPositive ? "text-emerald-600" : "text-foreground"
                          }`}
                        >
                          {isPositive ? "+" : "-"}₦{Number(tx.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                          Completed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payout Request Modal */}
      {wallet && (
        <PayoutRequestModal
          isOpen={isWithdrawModalOpen}
          onClose={() => {
            setIsWithdrawModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["user-wallet", user?.id] });
            queryClient.invalidateQueries({ queryKey: ["user-wallet-transactions", wallet?.id] });
            queryClient.invalidateQueries({ queryKey: ["user-pending-payouts", user?.id] });
          }}
          wallet={wallet}
          balanceOverride={availableBalance}
        />
      )}
    </AppLayout>
  );
}
