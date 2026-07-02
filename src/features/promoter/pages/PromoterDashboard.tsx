import { AppLayout } from "@/shared/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { TrendingUp, Package, DollarSign } from "lucide-react";
import { ProfileCompletionBanner } from "@/shared/components/ProfileCompletionBanner";

import { usePromoterData } from "@/features/promoter/hooks/usePromoterData";
import { PromoterHeader } from "@/features/promoter/components/dashboard/PromoterHeader";
import { PromoterOverviewTab } from "@/features/promoter/components/dashboard/PromoterOverviewTab";
import { PromoterMarketplaceTab } from "@/features/promoter/components/dashboard/PromoterMarketplaceTab";
import { PromoterPaymentsTab } from "@/features/promoter/components/dashboard/PromoterPaymentsTab";

export default function PromoterDashboard() {
  const {
    promoterCode,
    codeLoading,
    commissions,
    commissionsLoading,
    wallet,
    referrals,
    withdrawals,
    withdrawalsLoading,
    products,
    productsLoading,
    withdrawalMutation
  } = usePromoterData();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <ProfileCompletionBanner />
        
        <PromoterHeader wallet={wallet} />

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
            <PromoterOverviewTab
              promoterCode={promoterCode}
              codeLoading={codeLoading}
              wallet={wallet}
              commissions={commissions}
              commissionsLoading={commissionsLoading}
              referrals={referrals}
            />
          </TabsContent>

          <TabsContent value="marketplace" className="space-y-6">
            <PromoterMarketplaceTab
              products={products}
              productsLoading={productsLoading}
              promoterCode={promoterCode}
            />
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <PromoterPaymentsTab
              wallet={wallet}
              withdrawals={withdrawals}
              withdrawalsLoading={withdrawalsLoading}
              withdrawalMutation={withdrawalMutation}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
