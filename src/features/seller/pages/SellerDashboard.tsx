import { useState } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Navigate } from "react-router-dom";

// Modular Components
import { DashboardSidebar, Tab } from "@/features/seller/components/DashboardSidebar";
import { InventoryTab } from "@/features/seller/components/InventoryTab";
import { ListProductTab } from "@/features/seller/components/ListProductTab";
import { OrdersTab } from "@/features/seller/components/OrdersTab";
import { WalletTab } from "@/features/seller/components/WalletTab";
import { AnalyticsTab } from "@/features/seller/components/AnalyticsTab";
import { CategoryTab } from "@/features/seller/components/CategoryTab";
import { IssuesTab } from "@/features/seller/components/IssuesTab";
import { EditProductModal } from "@/features/seller/components/EditProductModal";
import { PaymentReconciliationTab } from "@/features/seller/components/PaymentReconciliationTab";
import { ProfileTab } from "@/features/seller/components/ProfileTab";

// Hooks
import { useSellerDashboardData } from "../hooks/useSellerDashboardData";
import { useSellerRealtime } from "../hooks/useSellerRealtime";
import { ProfileCompletionBanner } from "@/shared/components/ProfileCompletionBanner";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("products");
  const [newCategoryName, setNewCategoryName] = useState("");

  const data = useSellerDashboardData();
  useSellerRealtime(user);

  const {
    products,
    totalProducts,
    orders,
    sellerProfile,
    pendingOrdersCount,
    openIssuesCount,
    analytics,
    wallet,
    transactions,
    dbCategories,
    totals,
    editingProduct,
    setEditingProduct,
    productsPage,
    setProductsPage,
    ordersPage,
    setOrdersPage,
    updateProduct,
    updateOrderStatus,
    broadcastOrderMutation,
    updateProfileMutation,
    deleteProductMutation,
    addCategoryMutation,
    deleteCategoryMutation,
    PAGE_SIZE,
  } = data;

  const revenue = totals?.revenue || 0;
  const netRevenue = transactions
    .filter((t: any) => t.type === 'settlement')
    .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  const totalOrders = totals?.count || 0;
  const chartData = totals?.chartData || [];

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-black uppercase tracking-[0.2em] text-xs animate-pulse font-mono">Starting up your dashboard...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="flex items-start">
        <DashboardSidebar activeTab={tab} setTab={setTab} pendingOrdersCount={pendingOrdersCount} openIssuesCount={openIssuesCount} />

        <main className="flex-1 min-w-0 w-full p-6 lg:p-10 pt-24 lg:pt-10 pb-32 lg:pb-10 max-w-6xl mx-auto space-y-10">
          <ProfileCompletionBanner />
          {tab === "products" && (
            <InventoryTab
              products={products}
              totalProducts={totalProducts}
              productsPage={productsPage}
              setProductsPage={setProductsPage}
              setEditingProduct={setEditingProduct}
              deleteProductMutation={deleteProductMutation}
              pageSize={PAGE_SIZE}
              onListProduct={() => setTab("list-product")}
            />
           )}

          {tab === "list-product" && <ListProductTab />}

          {tab === "orders" && (
            <OrdersTab
              orders={orders}
              updateOrderStatus={updateOrderStatus}
              sellerZone={sellerProfile?.zone || undefined}
              sellerZoneId={(sellerProfile as any)?.zone_id}
              sellerCityId={(sellerProfile as any)?.city_id}
              sellerAddress={sellerProfile?.verification?.business_address || undefined}
              broadcastOrder={(orderId, zone, zoneId, pickupAddress, pickupTime, lat, lng) => {
                const order = orders.find(o => o.id === orderId);
                const recipient = order?.order_recipient || {};
                const deliveryAddress = `${recipient.address_line || ''}, ${recipient.cities?.name || ''}, ${recipient.delivery_zones?.name || ''}`;
                
                // Extract existing fees from shipment if available
                const existingShipment = order?.shipments?.[0] || {};
                const deliveryFeeAmount = (existingShipment as any).delivery_fee_amount;
                const crossZoneFeeAmount = (existingShipment as any).cross_zone_fee_amount;

                broadcastOrderMutation.mutate({ 
                  id: orderId, 
                  zone, 
                  zoneId, 
                  cityId: (sellerProfile as any)?.city_id, 
                  pickupAddress, 
                  deliveryAddress,
                  pickupTime, 
                  lat, 
                  lng,
                  deliveryFeeAmount,
                  crossZoneFeeAmount
                });
              }}
            />
          )}

          {tab === "wallet" && <WalletTab />}

          {tab === "analytics" && (
            <AnalyticsTab
              revenue={revenue}
              netRevenue={netRevenue}
              escrowBalance={wallet?.escrow_balance || 0}
              totalOrders={totalOrders}
              chartData={chartData}
            />
          )}

          {tab === "categories" && (
            <CategoryTab
              dbCategories={dbCategories}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              addCategoryMutation={addCategoryMutation}
              deleteCategoryMutation={deleteCategoryMutation}
            />
          )}

          {tab === "issues" && <IssuesTab />}

          {tab === "payments" && <PaymentReconciliationTab />}

          {tab === "profile" && (
            <ProfileTab 
              profile={sellerProfile} 
              onUpdate={(data) => updateProfileMutation.mutateAsync(data)}
              isUpdating={updateProfileMutation.isPending}
            />
          )}
        </main>
      </div>

      <EditProductModal
        product={editingProduct}
        setProduct={setEditingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={(p) => updateProduct.mutate(p)}
      />
    </div>
  );
}
