import React, { useState } from 'react';
import {
  Copy,
  Check,
  Clock,
  Package,
  Search,
  Box,
  Truck,
  CheckCircle2,
  Bike,
  Phone,
  MessageSquare,
  Star,
  ShieldCheck,
  ArrowRight,
  Headphones,
  XCircle,
  AlertCircle,
  Info,
  MapPin,
  Navigation,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import defaultRiderImg from '@/assets/default_rider.jpg';
import { SendOrder } from '../../types';
import { TrackingMap } from './TrackingMap';
import { toast } from 'sonner';

interface TrackingViewProps {
  order: SendOrder;
  riderCoords?: { lat: number; lng: number } | null;
  onRefresh?: () => void;
}

export function RealtimeTrackingView({
  order,
  riderCoords,
  onRefresh,
}: TrackingViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    toast.success('Order ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isFindingRider = order.status === 'finding_rider' || order.status === 'pending_payment';
  const isRiderAssigned = order.status === 'assigned_rider' || order.status === 'pickup' || order.status === 'on_the_way';
  const isDelivered = order.status === 'delivered';

  const pickupCoords =
    order.pickup_lat && order.pickup_lng
      ? { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) }
      : null;

  const dropoffCoords =
    order.dropoff_lat && order.dropoff_lng
      ? { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng) }
      : null;

  // Format placed date e.g. "12 May 2025, 10:30 AM"
  const placedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '12 May 2025, 10:30 AM';

  // Fetch latest live rider profile for up-to-date avatar photo and details
  const { data: riderProfile } = useQuery({
    queryKey: ['rider_live_profile', order.rider_id],
    queryFn: async () => {
      if (!order.rider_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, display_name, phone')
        .eq('id', order.rider_id)
        .maybeSingle();
      return data;
    },
    enabled: !!order.rider_id,
  });

  const riderAvatar = riderProfile?.avatar_url || order.rider_avatar || defaultRiderImg;
  const riderName = riderProfile?.display_name || order.rider_name || 'oga rider';
  const riderPhone = riderProfile?.phone || order.rider_phone || '08111111111';
  const riderIdFormatted = order.rider_id ? `RID-${order.rider_id.slice(0, 6).toUpperCase()}` : 'RID-78345';

  const trackingSteps = [
    {
      label: 'Finding a rider',
      state: isFindingRider ? 'In Progress' : 'Completed',
      time: '10:30 AM',
      icon: Search,
    },
    {
      label: 'Rider Assigned',
      state: isFindingRider ? 'Pending' : order.status === 'assigned_rider' ? 'In Progress' : 'Completed',
      time: '',
      icon: Bike,
    },
    {
      label: 'Pick up',
      state: order.status === 'pickup' ? 'In Progress' : ['on_the_way', 'delivered'].includes(order.status) ? 'Completed' : 'Pending',
      time: '',
      icon: Box,
    },
    {
      label: 'On the way',
      state: order.status === 'on_the_way' ? 'In Progress' : order.status === 'delivered' ? 'Completed' : 'Pending',
      time: '',
      icon: Truck,
    },
    {
      label: 'Delivered',
      state: isDelivered ? 'Completed' : 'Pending',
      time: '',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header Card matching screenshots */}
      <Card className="rounded-2xl border-border/70 p-4 bg-card shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Order ID + Placed Date */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Order ID</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Copy Order ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="font-mono text-sm sm:text-base font-extrabold text-foreground tracking-wide select-all">
              {order.id}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Placed on {placedDate}</p>
          </div>

          {/* Right Status Card */}
          {isFindingRider ? (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right sm:text-right">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                Finding a rider
              </Badge>
              <p className="text-[10px] text-muted-foreground mt-1">Estimated Delivery</p>
              <p className="text-xs font-bold text-emerald-700">15 – 45 mins</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 sm:max-w-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Current Status
                </span>
                <p className="text-xs font-extrabold text-emerald-700">Rider Assigned</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  Your rider is on the way to pick up your package.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Bike className="w-5 h-5" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Horizontal 5-Step Stepper matching screenshots */}
      <Card className="rounded-2xl border-border/70 p-4 bg-card shadow-sm overflow-x-auto">
        <div className="min-w-[420px] flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute left-6 right-6 top-4 h-[2px] bg-muted -z-0" />

          {trackingSteps.map((s, idx) => {
            const isCompleted = s.state === 'Completed';
            const isInProgress = s.state === 'In Progress';
            const Icon = s.icon;

            return (
              <div key={s.label} className="flex flex-col items-center relative z-10 w-20 text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    isCompleted
                      ? 'bg-primary text-white border-2 border-primary'
                      : isInProgress
                      ? 'bg-primary/10 text-primary border-2 border-primary ring-4 ring-primary/20 scale-105'
                      : 'bg-background text-muted-foreground border-2 border-muted'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
                </div>

                <div className="mt-1.5 leading-tight">
                  <p
                    className={`text-[10px] font-bold ${
                      isInProgress ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </p>
                  <p
                    className={`text-[9px] mt-0.5 ${
                      isInProgress ? 'text-primary font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    {s.state}
                  </p>
                  {isCompleted && s.time && (
                    <p className="text-[8.5px] text-muted-foreground">{s.time}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* CONDITIONAL BODY: STATE 1 (Finding Rider) VS STATE 2 (Rider Assigned / En Route) */}
      {isFindingRider ? (
        /* ============ FINDING RIDER VIEW (IMAGE 2) ============ */
        <div className="space-y-4">
          {/* Radar Radar Searching Card */}
          <Card className="rounded-2xl border-border/70 p-4 bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Radar pulse thumbnail */}
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 border flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                <span className="absolute w-20 h-20 rounded-full bg-primary/20 animate-ping" />
                <span className="absolute w-14 h-14 rounded-full bg-primary/30" />
                <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-md relative z-10">
                  <Search className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1">
                <h4 className="text-sm font-bold font-heading text-foreground">
                  We're finding the best rider for you
                </h4>
                <p className="text-xs text-muted-foreground">
                  Please sit tight while we connect you with an available rider near you.
                </p>
              </div>
            </div>

            {/* Orange info box */}
            <div className="mt-3 p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2 text-xs text-orange-900 dark:text-orange-200">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span className="text-[11px]">
                You will be notified as soon as a rider accepts your order.
              </span>
            </div>
          </Card>

          {/* Order Details Card */}
          <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="text-xs font-bold font-heading text-foreground">Order Details</h4>
              <span className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer">
                <span>View Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <CardContent className="p-4 space-y-4">
              {/* Pickup */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-3 h-3 rounded-full border-2 border-primary bg-background shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-foreground">Pickup Location</p>
                    <p className="text-muted-foreground mt-0.5">{order.pickup_address}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{order.sender_name}</p>
                  <p className="text-[11px] text-muted-foreground">{order.sender_phone}</p>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-muted ml-1.5 h-2 -my-2" />

              {/* Drop-off */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-background shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-foreground">Drop-off Location</p>
                    <p className="text-muted-foreground mt-0.5">{order.dropoff_address}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{order.dropoff_recipient_name}</p>
                  <p className="text-[11px] text-muted-foreground">{order.dropoff_recipient_phone}</p>
                </div>
              </div>

              {/* Package Details */}
              <div className="pt-3 border-t flex items-start gap-2.5">
                <span className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5">📦</span>
                <div className="text-xs">
                  <p className="font-bold text-foreground">Package Details</p>
                  <p className="text-muted-foreground text-[11px]">
                    Send a Package • {order.package_details?.weight_kg <= 2 ? 'Small • Under 2kg' : `${order.package_details?.weight_kg}kg`}
                  </p>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {order.package_details?.contents || 'Books'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary Card matching Image 2 */}
          <Card className="rounded-2xl border-border/70 p-4 bg-card shadow-sm space-y-2.5 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b font-bold font-heading text-foreground">
              <span className="p-1 rounded-lg bg-orange-500/10 text-primary">💳</span>
              <span>Payment Summary</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total Paid</span>
              <span className="font-bold text-foreground">₦{Number(order.delivery_fee || 2500).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Payment Method</span>
              <span className="font-medium text-foreground">Paystack (Online)</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Payment Status</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                Paid
              </Badge>
            </div>
          </Card>

          {/* Safe & Secure banner */}
          <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-foreground">Safe & Secure</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Your package is insured and protected every step of the way.
              </p>
            </div>
          </div>

          {/* Buttons: Contact Support & Cancel Order */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl text-xs font-semibold gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5 text-primary" />
              <span>Contact Support</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl text-xs font-semibold gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Order</span>
            </Button>
          </div>
        </div>
      ) : (
        /* ============ RIDER ASSIGNED VIEW (IMAGE 1) ============ */
        <div className="space-y-4">
          {/* Rider Card matching Image 1 */}
          <Card className="rounded-2xl border-border/70 p-4 bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14 rounded-full border-2 border-primary/25 shadow-sm shrink-0 overflow-hidden">
                  <AvatarImage
                    src={riderAvatar}
                    alt={riderName}
                    className="w-full h-full object-cover"
                  />
                  <AvatarFallback className="bg-[#FFF7F2] text-[#E96F28] font-black text-sm">
                    {(riderName || 'R').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                    Your Rider
                  </span>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold font-heading text-foreground capitalize">
                      {riderName}
                    </h4>
                    <span className="flex items-center text-amber-500 font-bold text-xs">
                      <Star className="w-3 h-3 fill-amber-500 mr-0.5" /> 4.8
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">{riderIdFormatted}</p>

                  {/* Call & Chat Buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 rounded-lg text-xs gap-1 border-primary/30 text-foreground hover:border-primary"
                    >
                      <a href={`tel:${riderPhone}`}>
                        <Phone className="w-3 h-3 text-primary" />
                        <span>{riderPhone}</span>
                      </a>
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 rounded-lg border-primary/30 text-foreground hover:border-primary"
                    >
                      <a href={`sms:${riderPhone}`}>
                        <MessageSquare className="w-3 h-3 text-primary" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right side ETA */}
              <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0">
                <p className="text-[11px] text-muted-foreground">
                  Rider is on the way to pick up your package
                </p>
                <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                  Estimated arrival
                </p>
                <p className="text-sm font-extrabold text-emerald-600">8 mins</p>
              </div>
            </div>
          </Card>

          {/* Interactive Map with Pickup & Drop-off bubbles matching Image 1 */}
          <TrackingMap
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            riderCoords={riderCoords || { lat: 9.09, lng: 7.42 }}
            status={order.status}
          />

          {/* Order Summary Card */}
          <Card className="rounded-2xl border-border/70 shadow-sm bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="text-xs font-bold font-heading text-foreground">Order Summary</h4>
              <span className="text-xs font-bold text-primary flex items-center gap-1 cursor-pointer">
                <span>View Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <CardContent className="p-4 space-y-4">
              {/* Pickup */}
              <div className="flex items-start gap-2.5">
                <span className="w-3 h-3 rounded-full border-2 border-primary bg-background shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-foreground">Pickup Location</p>
                  <p className="text-muted-foreground mt-0.5">
                    {order.pickup_address || '12 Unity Estate, Lifecamp, Abuja.'}
                  </p>
                </div>
              </div>

              <div className="border-l-2 border-dashed border-muted ml-1.5 h-2 -my-2" />

              {/* Drop-off */}
              <div className="flex items-start gap-2.5">
                <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-background shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-foreground">Drop-off Location</p>
                  <p className="text-muted-foreground mt-0.5">
                    {order.dropoff_address || 'Suite 8, Nicon Plaza, Wuse 2, Abuja.'}
                  </p>
                </div>
              </div>

              {/* Package Details + ETA */}
              <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-2 text-xs">
                  <span className="w-3.5 h-3.5 text-purple-600 shrink-0">📦</span>
                  <div>
                    <p className="font-bold text-foreground">Package Details</p>
                    <p className="text-muted-foreground text-[11px]">
                      Send a Package • {order.package_details?.weight_kg <= 2 ? 'Small • Under 2kg' : `${order.package_details?.weight_kg}kg`}
                    </p>
                    <p className="text-xs font-semibold text-foreground">
                      {order.package_details?.contents || 'Books'}
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3 text-emerald-600" /> Estimated Delivery
                  </span>
                  <span className="text-xs font-bold text-emerald-700">15 - 45 mins</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Need Help? Contact support link */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">Need help? Contact our support team.</span>
            <button
              type="button"
              className="text-primary font-bold flex items-center gap-1 hover:underline"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Contact Support</span>
            </button>
          </div>

          {/* Insured protection banner */}
          <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-foreground">
                Your package is insured and protected
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                We've got you covered every step of the way.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
