import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { AppLayout } from '@/shared/components/layout/AppLayout';
import { SendOrder } from '../types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Package,
  MapPin,
  Navigation,
  Clock,
  ArrowRight,
  Plus,
  Loader2,
  Copy,
  Check,
  Search,
  Bike,
  ShieldCheck,
  Phone,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SendOrdersHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery<SendOrder[]>({
    queryKey: ['my_send_orders', user?.id],
    queryFn: async () => {
      let remoteOrders: SendOrder[] = [];

      if (user) {
        const { data, error } = await (supabase as any)
          .from('send_orders')
          .select('*')
          .or(`user_id.eq.${user.id},sender_phone.eq.${user.phone || 'none'}`)
          .order('created_at', { ascending: false });

        if (!error && data) {
          remoteOrders = data;
        }
      }

      // Merge with locally cached guest orders
      const localOrders: SendOrder[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('linkup_send_order_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (item?.id && !remoteOrders.some((ro) => ro.id === item.id)) {
              localOrders.push(item);
            }
          } catch {}
        }
      }

      const merged = [...remoteOrders, ...localOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return merged;
    },
  });

  // Realtime subscription to live updates
  useEffect(() => {
    const channel = supabase
      .channel('my-send-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my_send_orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success(`Order ID ${id} copied`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
            Delivered 🎉
          </Badge>
        );
      case 'on_the_way':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold animate-pulse">
            On The Way 🛵
          </Badge>
        );
      case 'pickup':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold animate-pulse">
            Rider at Pickup 📦
          </Badge>
        );
      case 'assigned_rider':
        return (
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
            Rider Assigned 🏍️
          </Badge>
        );
      case 'finding_rider':
        return (
          <Badge className="bg-orange-50 text-[#E96F28] border-orange-200 text-[10px] font-bold animate-pulse">
            Finding Rider 📡
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="text-[10px] font-bold">
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] capitalize">
            {status.replace(/_/g, ' ')}
          </Badge>
        );
    }
  };

  const filteredOrders = orders.filter((order) => {
    // Status filter
    if (statusFilter === 'active') {
      if (['delivered', 'cancelled'].includes(order.status)) return false;
    } else if (statusFilter === 'delivered') {
      if (order.status !== 'delivered') return false;
    } else if (statusFilter === 'cancelled') {
      if (order.status !== 'cancelled') return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = order.id?.toLowerCase().includes(q);
      const matchSender = order.sender_name?.toLowerCase().includes(q);
      const matchRecipient = order.dropoff_recipient_name?.toLowerCase().includes(q);
      const matchPickup = order.pickup_address?.toLowerCase().includes(q);
      const matchDropoff = order.dropoff_address?.toLowerCase().includes(q);
      const matchContents = order.package_details?.contents?.toLowerCase().includes(q);
      return matchId || matchSender || matchRecipient || matchPickup || matchDropoff || matchContents;
    }

    return true;
  });

  const activeCount = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28">
        {/* Header Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-heading text-foreground tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              <span>Package Send History</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              View and track all packages you have sent with LinkUp Send
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-10 rounded-xl text-xs font-bold gap-1.5 border-border/80"
              title="Refresh"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              onClick={() => navigate('/send')}
              size="sm"
              className="h-10 px-4 text-xs font-bold bg-primary hover:bg-primary/95 text-white gap-1.5 rounded-xl shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              <span>Send New Package</span>
            </Button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by LSEND ID, recipient, address, or contents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 h-11 rounded-2xl bg-card border-border/70 text-xs font-medium"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                statusFilter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              All Packages ({orders.length})
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5',
                statusFilter === 'active'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>In Progress ({activeCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('delivered')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                statusFilter === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              Delivered ({deliveredCount})
            </button>
          </div>
        </div>

        {/* Order Cards List */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
              Loading your sent packages...
            </p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="rounded-3xl border-dashed border-2 p-10 text-center space-y-4 bg-card/50">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-inner">
              <Package className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-foreground font-heading">
                {searchTerm ? 'No matching deliveries found' : 'No Packages Sent Yet'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {searchTerm
                  ? 'Try searching for another tracking number, name, or street name.'
                  : 'When you send parcels, documents, or items, you will be able to track every mission live from here.'}
              </p>
            </div>
            <Button
              onClick={() => {
                if (searchTerm) setSearchTerm('');
                else navigate('/send');
              }}
              className="text-xs font-bold bg-primary text-white rounded-xl h-10 px-5 shadow-sm"
            >
              {searchTerm ? 'Clear Search' : 'Send Your First Package 🚀'}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3.5">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                onClick={() => navigate(`/send/track/${order.id}`)}
                className="rounded-3xl border border-border/70 hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-md bg-card overflow-hidden group"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top Bar: LSEND ID, Date, Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {order.id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => copyId(order.id, e)}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy Order ID"
                      >
                        {copiedId === order.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Route Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-2xl bg-muted/30 border border-black/[0.02] space-y-1">
                      <div className="flex items-center gap-1.5 text-orange-700 font-bold text-[10px] uppercase tracking-wider">
                        <MapPin className="w-3 h-3" />
                        <span>Pickup (Sender: {order.sender_name})</span>
                      </div>
                      <p className="text-foreground font-semibold line-clamp-1">
                        {order.pickup_address}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-muted/30 border border-black/[0.02] space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[10px] uppercase tracking-wider">
                        <Navigation className="w-3 h-3" />
                        <span>Drop-off (To: {order.dropoff_recipient_name})</span>
                      </div>
                      <p className="text-foreground font-semibold line-clamp-1">
                        {order.dropoff_address}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Rider Info (if present) */}
                  {order.rider_name && (
                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-orange-500/5 border border-orange-500/10 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                          <Bike className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-xs">{order.rider_name}</p>
                          <p className="text-[10px] text-muted-foreground">{order.rider_vehicle || 'Motorcycle Dispatch'}</p>
                        </div>
                      </div>
                      {order.rider_phone && (
                        <a
                          href={`tel:${order.rider_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline px-2.5 py-1 rounded-xl bg-white border border-orange-200/80 shadow-xs"
                        >
                          <Phone className="w-3 h-3" />
                          <span>Call Rider</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Footer: Package Details, Price, and Track Button */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        📦 {order.package_details?.contents || 'Parcel'}
                      </Badge>
                      <span className="font-black text-foreground">
                        ₦{(order.delivery_fee || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-primary font-bold group-hover:translate-x-1 transition-transform">
                      <span>Live Tracking</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
