import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { CartProvider } from "@/features/commerce/context/CartContext";
import Index from "@/features/commerce/pages/Index";
import Auth from "@/features/auth/pages/Auth";
import ProductDetail from "@/features/commerce/pages/ProductDetail";
import Cart from "@/features/commerce/pages/Cart";
import Checkout from "@/features/commerce/pages/Checkout";
import Sell from "@/features/commerce/pages/Sell";
import SearchPage from "@/features/commerce/pages/Search";
import Profile from "./features/dashboard/pages/Profile";
import SellerVerification from "@/features/auth/pages/SellerVerification";
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminAuth from "@/features/admin/pages/AdminAuth";
import { AdminRoute } from "@/features/auth/components/AdminRoute";
import { AdminLayout } from "@/features/admin/components/AdminLayout";
import Notifications from "@/features/dashboard/pages/Notifications";
import Dashboard from "@/features/dashboard/pages/Dashboard";
import NotFound from "./features/dashboard/pages/NotFound";
import Wishlist from "@/features/commerce/pages/Wishlist";
import Orders from "@/features/commerce/pages/Orders";
import Support from "@/features/dashboard/pages/Support";
import Onboarding from "@/features/auth/pages/Onboarding";
import Logistics from "@/features/logistics/pages/Logistics";
import LogisticsDashboard from "@/features/logistics/pages/LogisticsDashboard";
import Messages from "@/features/dashboard/pages/Messages";
import Chat from "@/features/dashboard/pages/Chat";
import PromoterDashboard from "@/features/promoter/pages/PromoterDashboard";

import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { LazyMotion, domAnimation } from "framer-motion";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 3, // 3 minutes
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister,
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LazyMotion features={domAnimation}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/sell" element={<Sell />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/chat/:id" element={<Chat />} />
                <Route path="/support" element={<Support />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/logistics" element={<Logistics />} />
                <Route path="/logistics-dashboard" element={<LogisticsDashboard />} />
                <Route path="/promoter-dashboard" element={<PromoterDashboard />} />
                <Route path="/seller-verification" element={<SellerVerification />} />
                <Route path="/admin-auth" element={<AdminAuth />} />
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <Routes>
                          <Route index element={<AdminDashboard />} />
                          <Route path="orders" element={<AdminDashboard activeSection="orders" />} />
                          <Route path="users" element={<AdminDashboard activeSection="users" />} />
                          <Route path="issues" element={<AdminDashboard activeSection="issues" />} />
                          <Route path="history" element={<AdminDashboard activeSection="history" />} />
                          <Route path="kyc" element={<AdminDashboard activeSection="kyc" />} />
                          <Route path="payments" element={<AdminDashboard activeSection="payments" />} />
                          <Route path="logistics" element={<AdminDashboard activeSection="logistics" />} />
                          <Route path="fees" element={<AdminDashboard activeSection="fees" />} />
                        </Routes>
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </LazyMotion>
  </QueryClientProvider>
);

export default App;
