import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, DollarSign, MousePointerClick, ShoppingCart, TrendingUp, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function PromoterDashboard() {
  const { user } = useAuth();

  // Get or create promoter code
  const { data: promoterCode, isLoading: codeLoading } = useQuery({
    queryKey: ["promoter-code", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("promoter_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) return data.code;

      // Generate a new code
      const code = "PX" + Math.random().toString(36).substring(2, 8).toUpperCase();
      await supabase.from("promoter_codes").insert({ user_id: user.id, code });
      return code;
    },
    enabled: !!user,
  });

  // Commissions
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ["promoter-commissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("commissions")
        .select("*")
        .eq("promoter_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Click stats
  const { data: clicks = [] } = useQuery({
    queryKey: ["promoter-clicks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("referral_clicks")
        .select("id, clicked_at")
        .eq("promoter_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalEarnings = commissions.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const pendingEarnings = commissions.filter((c: any) => c.status === "pending").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const paidEarnings = commissions.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
  const totalOrders = commissions.length;
  const totalClicks = clicks.length;
  const conversionRate = totalClicks > 0 ? ((totalOrders / totalClicks) * 100).toFixed(1) : "0";

  const copyLink = (productPath?: string) => {
    const base = window.location.origin;
    const link = productPath
      ? `${base}${productPath}?ref=${promoterCode}`
      : `${base}/?ref=${promoterCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promoter Dashboard</h1>
          <p className="text-muted-foreground text-sm">Track your referrals, clicks, and earnings.</p>
        </div>

        {/* Referral Code */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Referral Code</p>
              {codeLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-black text-primary tracking-widest">{promoterCode}</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary" onClick={() => copyLink()}>
              <Copy size={14} /> Copy Store Link
            </Button>
          </CardContent>
        </Card>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign size={16} />
                <span className="text-xs font-medium">Total Earnings</span>
              </div>
              <p className="text-xl font-bold">₦{totalEarnings.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp size={16} />
                <span className="text-xs font-medium">Pending</span>
              </div>
              <p className="text-xl font-bold text-amber-600">₦{pendingEarnings.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MousePointerClick size={16} />
                <span className="text-xs font-medium">Total Clicks</span>
              </div>
              <p className="text-xl font-bold">{totalClicks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShoppingCart size={16} />
                <span className="text-xs font-medium">Conversions</span>
              </div>
              <p className="text-xl font-bold">{totalOrders} <span className="text-xs text-muted-foreground font-normal">({conversionRate}%)</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Commissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            {commissionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : commissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-sm">No commissions yet. Share your referral link to start earning!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {commissions.slice(0, 20).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div>
                      <p className="text-sm font-medium">Order Commission</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">₦{Number(c.amount).toLocaleString()}</p>
                      <Badge variant={c.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                        {c.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
