import React, { Suspense, lazy } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { CartProvider } from "@/features/marketplace/context/CartContext";

const Index = lazy(() => import("@/features/marketplace/pages/Index"));
const Auth = lazy(() => import("@/features/auth/pages/Auth"));
const ProductDetail = lazy(() => import("@/features/marketplace/pages/ProductDetail"));
const Cart = lazy(() => import("@/features/marketplace/pages/Cart"));
const Checkout = lazy(() => import("@/features/marketplace/pages/Checkout"));
const ListProduct = lazy(() => import("@/features/seller/pages/ListProduct"));
const SearchPage = lazy(() => import("@/features/marketplace/pages/Search"));
const Profile = lazy(() => import("./features/user/pages/Profile"));
const SellerVerification = lazy(() => import("@/features/seller/pages/SellerVerification"));
const AdminDashboard = lazy(() => import("@/features/admin/pages/AdminDashboard"));
const AdminAuth = lazy(() => import("@/features/admin/pages/AdminAuth"));
import { AdminRoute } from "@/features/auth/components/AdminRoute";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { AdminLayout } from "@/features/admin/components/AdminLayout";
const Notifications = lazy(() => import("@/features/user/pages/Notifications"));
const Dashboard = lazy(() => import("@/features/seller/pages/SellerDashboard"));
const NotFound = lazy(() => import("./features/user/pages/NotFound"));
const Wishlist = lazy(() => import("@/features/marketplace/pages/Wishlist"));
const Orders = lazy(() => import("@/features/marketplace/pages/Orders"));
const Support = lazy(() => import("@/features/user/pages/Support"));
const Onboarding = lazy(() => import("@/features/auth/pages/Onboarding"));
const Messages = lazy(() => import("@/features/user/pages/Messages"));
const Chat = lazy(() => import("@/features/user/pages/Chat"));
const PromoterDashboard = lazy(() => import("@/features/promoter/pages/PromoterDashboard"));
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));
const LogisticsDashboardV2 = lazy(() => import("@/features/logistics_v2/pages/LogisticsDashboardV2"));

import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { LazyMotion, domAnimation } from "framer-motion";

const GlobalLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

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
              <Suspense fallback={<GlobalLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                  <Route path="/sell" element={<ProtectedRoute><ListProduct /></ProtectedRoute>} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                  <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                  <Route path="/chat/:id" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
                  <Route path="/logistics" element={<ProtectedRoute><LogisticsDashboardV2 /></ProtectedRoute>} />
                  <Route path="/logistics-dashboard" element={<ProtectedRoute><LogisticsDashboardV2 /></ProtectedRoute>} />
                  <Route path="/logistics-v2" element={<ProtectedRoute><LogisticsDashboardV2 /></ProtectedRoute>} />
                  <Route path="/promoter-dashboard" element={<ProtectedRoute><PromoterDashboard /></ProtectedRoute>} />
                  <Route path="/seller-verification" element={<ProtectedRoute><SellerVerification /></ProtectedRoute>} />
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
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </LazyMotion>
  </QueryClientProvider>
);

export default App;
