import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Copy, TrendingUp, ShoppingCart, Clock, Link2, MousePointerClick, Package } from "lucide-react";
import { toast } from "sonner";

interface PromoterOverviewTabProps {
  promoterCode: string | null | undefined;
  codeLoading: boolean;
  wallet: any;
  commissions: any[];
  commissionsLoading: boolean;
  referrals: any[];
}

export function PromoterOverviewTab({
  promoterCode,
  codeLoading,
  wallet,
  commissions,
  commissionsLoading,
  referrals
}: PromoterOverviewTabProps) {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
