import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Sell from "./pages/Sell";
import SearchPage from "./pages/Search";
import Profile from "./pages/Profile";
import SellerVerification from "./pages/SellerVerification";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAuth from "./pages/admin/AdminAuth";
import { AdminRoute } from "./components/auth/AdminRoute";
import { AdminLayout } from "./components/admin/AdminLayout";
import Notifications from "./pages/Notifications";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Wishlist from "./pages/Wishlist";
import Orders from "./pages/Orders";
import Support from "./pages/Support";
import Onboarding from "./pages/Onboarding";
import Logistics from "./pages/Logistics";
import LogisticsDashboard from "./pages/LogisticsDashboard";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import PromoterDashboard from "./pages/PromoterDashboard";

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
