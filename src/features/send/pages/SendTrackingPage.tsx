import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { RealtimeTrackingView } from '../components/tracking/RealtimeTrackingView';
import { useSendOrderTracking } from '../hooks/useSendOrderTracking';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useCart } from '@/features/marketplace/context/CartContext';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card } from '@/shared/components/ui/card';
import { ArrowLeft, Search, Loader2, PackageX, Bell, ShoppingCart } from 'lucide-react';
import { ContactSupportButton, SendSupportModal } from '../components/support/SendSupportModal';

export default function SendTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { totalCount } = useCart();
  const [searchInput, setSearchInput] = useState('');
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const { order, riderCoords, isLoading, error, refetch } = useSendOrderTracking(orderId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/send/track/${searchInput.trim().toUpperCase()}`);
    }
  };

  // const userInitial = (user?.email || profile?.name || 'D')[0].toUpperCase();

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-3 sm:py-5 space-y-4">
        {/* Top Header matching screenshots */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/send')}
              className="p-1 rounded-full hover:bg-muted transition-colors text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold font-heading text-foreground">
                Track My Order
              </h1>
              <p className="mt-5 text-[11px] text-muted-foreground">
                {order?.status === 'finding_rider'
                  ? 'Stay updated in real time'
                  : 'Track your package in real time'}
              </p>
            </div>
          </div>

          {/* Contact Support Pill Button */}
          <ContactSupportButton onClick={() => setSupportModalOpen(true)} />
        </div>

        {/* If no orderId provided in URL, show search box */}
        {!orderId && (
          <Card className="rounded-2xl border-border/70 p-6 text-center space-y-4 shadow-sm bg-card">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">Track Any Package</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter your Order ID (e.g. LSEND-250512-9876) to view real-time tracking
              </p>
            </div>
            <form onSubmit={handleSearch} className="flex gap-2 max-w-sm mx-auto">
              <Input
                placeholder="LSEND-250512-9876"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="font-mono uppercase text-xs"
              />
              <Button type="submit" className="text-xs font-bold gap-1 bg-primary text-white">
                <Search className="w-3.5 h-3.5" />
                <span>Track</span>
              </Button>
            </form>
          </Card>
        )}

        {/* Loading State */}
        {orderId && isLoading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold text-muted-foreground">Connecting to live tracking satellite...</p>
          </div>
        )}

        {/* Not Found State */}
        {orderId && !isLoading && !order && (
          <Card className="rounded-2xl border-border/70 p-8 text-center space-y-4 bg-card shadow-sm">
            <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
              <PackageX className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-heading text-foreground">Order Not Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                We couldn't locate package with ID <span className="font-mono font-bold text-foreground">{orderId}</span>. Please verify the ID or check your delivery history.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={() => navigate('/send')} className="text-xs font-bold bg-primary text-white">
                Send a Package
              </Button>
              <Button variant="outline" onClick={() => navigate('/send/history')} className="text-xs font-semibold">
                Past Deliveries
              </Button>
            </div>
          </Card>
        )}

        {/* Live Tracking View */}
        {orderId && order && (
          <RealtimeTrackingView
            order={order}
            riderCoords={riderCoords}
            onRefresh={refetch}
          />
        )}

        <SendSupportModal
          open={supportModalOpen}
          onOpenChange={setSupportModalOpen}
          orderId={orderId}
          orderStatus={order?.status}
        />
      </div>
    </AppLayout>
  );
}
