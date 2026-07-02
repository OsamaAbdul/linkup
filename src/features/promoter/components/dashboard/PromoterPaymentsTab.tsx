import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Clock, CheckCircle2, XCircle, ArrowUpRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PromoterPaymentsTabProps {
  wallet: any;
  withdrawals: any[];
  withdrawalsLoading: boolean;
  withdrawalMutation: any;
}

export function PromoterPaymentsTab({
  wallet,
  withdrawals,
  withdrawalsLoading,
  withdrawalMutation
}: PromoterPaymentsTabProps) {
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

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

    withdrawalMutation.mutate(
      {
        amount,
        bankName,
        accountNumber,
        accountName
      },
      {
        onSuccess: (data: any) => {
          if (data.success) {
            setWithdrawalAmount("");
            setBankName("");
            setAccountNumber("");
            setAccountName("");
            setIsWithdrawModalOpen(false);
          }
        }
      }
    );
  };

  return (
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
  );
}
