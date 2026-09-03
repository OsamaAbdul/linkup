import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  MapPin,
  Navigation,
  User,
  Phone,
  Package,
  Scale,
  Sparkles,
  ArrowLeft,
  CreditCard,
  Lock,
  Clock,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useSendPricing } from '../../hooks/useSendPricing';
import { usePaystackInline } from '@/features/marketplace/hooks/usePaystackInline';
import { useSavedAddresses } from '../../hooks/useSavedAddresses';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { generateSendOrderId } from '../../utils/orderId';
import { toast } from 'sonner';

interface Step2Props {
  formData: SendOrderFormData;
  onEdit: () => void;
  onPaymentSuccess: (orderId: string) => void;
}

export function Step2OrderPreview({ formData, onEdit, onPaymentSuccess }: Step2Props) {
  const { user, profile } = useAuth();
  const { pay } = usePaystackInline();
  const { saveAddress } = useSavedAddresses();
  const [isProcessing, setIsProcessing] = useState(false);

  const pricing = useSendPricing({
    pickupLat: formData.pickupLat,
    pickupLng: formData.pickupLng,
    dropoffLat: formData.dropoffLat,
    dropoffLng: formData.dropoffLng,
    weightKg: formData.weightKg,
    isFragile: formData.isFragile,
  });

  const handlePayAndCreateOrder = async () => {
    setIsProcessing(true);

    try {
      // 1. Optionally save addresses if user checked the box
      if (formData.savePickupAddress) {
        await saveAddress({
          label: formData.pickupAddressLabel || 'Pickup Location',
          type: 'pickup',
          contact_name: formData.senderName,
          contact_phone: formData.senderPhone,
          address: formData.pickupAddress,
          directions: formData.pickupDirections,
          latitude: formData.pickupLat,
          longitude: formData.pickupLng,
        }).catch((err) => console.warn('Could not save pickup address:', err));
      }

      if (formData.saveDropoffAddress) {
        await saveAddress({
          label: formData.dropoffAddressLabel || 'Drop-off Location',
          type: 'dropoff',
          contact_name: formData.dropoffRecipientName,
          contact_phone: formData.dropoffRecipientPhone,
          address: formData.dropoffAddress,
          directions: formData.dropoffDirections,
          latitude: formData.dropoffLat,
          longitude: formData.dropoffLng,
        }).catch((err) => console.warn('Could not save dropoff address:', err));
      }

      // 2. Generate unique Send Order ID
      const orderId = generateSendOrderId();
      const clientReference = `ref_${orderId}_${Date.now()}`;

      // 3. Resolve Paystack Public Key
      let publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        try {
          const { data: pkData } = await supabase.functions.invoke('paystack-public-key');
          publicKey = (pkData as any)?.publicKey;
        } catch {
          // fallback
        }
      }

      if (!publicKey) {
        throw new Error('Paystack payment gateway is currently unavailable. Please check your network or try again.');
      }

      const email =
        user?.email ||
        `${formData.senderPhone.replace(/\D/g, '') || 'customer'}@linkup.delivery`;

      const amountKobo = Math.round(pricing.totalFee * 100);

      // 4. Pre-create the order record in database or localStorage
      const orderRecord = {
        id: orderId,
        user_id: user?.id || 'guest',
        status: 'pending_payment',
        sender_name: formData.senderName,
        sender_phone: formData.senderPhone,
        pickup_address: formData.pickupAddress,
        pickup_lat: formData.pickupLat || null,
        pickup_lng: formData.pickupLng || null,
        pickup_directions: formData.pickupDirections || null,
        dropoff_recipient_name: formData.dropoffRecipientName,
        dropoff_recipient_phone: formData.dropoffRecipientPhone,
        dropoff_address: formData.dropoffAddress,
        dropoff_lat: formData.dropoffLat || null,
        dropoff_lng: formData.dropoffLng || null,
        dropoff_directions: formData.dropoffDirections || null,
        package_details: {
          weight_kg: formData.weightKg,
          contents: formData.packageContents,
          is_fragile: formData.isFragile,
          declared_value: formData.declaredValue || 0,
        },
        delivery_fee: pricing.totalFee,
        currency: 'NGN',
        payment_status: 'pending',
        payment_ref: clientReference,
        estimated_delivery_time: new Date(Date.now() + 45 * 60000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Try inserting into Supabase
      if (user) {
        const { error: insertErr } = await (supabase as any).from('send_orders').insert(orderRecord);
        if (insertErr) {
          console.warn('Could not insert to Supabase send_orders directly (RLS or table pending), storing locally:', insertErr);
        }
      }

      // Always save to localStorage so the client can retrieve even before webhook
      localStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(orderRecord));

      // 5. Open Paystack Inline Checkout
      const paid = await pay({
        publicKey,
        email,
        amountKobo,
        reference: clientReference,
        metadata: {
          order_id: orderId,
          order_type: 'send_order',
          sender_name: formData.senderName,
          sender_phone: formData.senderPhone,
          recipient_phone: formData.dropoffRecipientPhone,
          delivery_fee: pricing.totalFee,
        },
      });

      // 6. On Successful payment
      const confirmedOrder = {
        ...orderRecord,
        status: 'finding_rider',
        payment_status: 'paid',
        payment_ref: paid.reference || clientReference,
        paid_at: new Date().toISOString(),
      };

      if (user) {
        await (supabase as any)
          .from('send_orders')
          .update({
            status: 'finding_rider',
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            payment_ref: paid.reference || clientReference,
          })
          .eq('id', orderId);
      }

      localStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(confirmedOrder));

      toast.success('Payment verified! Order placed successfully.');
      onPaymentSuccess(orderId);
    } catch (err: any) {
      if (err?.message === 'Payment cancelled') {
        toast.info('Payment was cancelled. You can retry whenever you are ready.');
      } else {
        toast.error(err?.message || 'Payment processing failed. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-16"
    >
      {/* Header Notice */}
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-foreground font-heading">Review Delivery Details</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Please double-check your pickup, destination, and package information before completing payment.
          </p>
        </div>
      </div>

      {/* 1. PICKUP PREVIEW */}
      <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold font-heading text-foreground">Pickup Details</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </Button>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">{formData.pickupAddress}</p>
              {formData.pickupDirections && (
                <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                  Note: "{formData.pickupDirections}"
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">{formData.senderName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{formData.senderPhone}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. DROP-OFF PREVIEW */}
      <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-bold font-heading text-foreground">Drop-off Destination</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </Button>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <Navigation className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">{formData.dropoffAddress}</p>
              {formData.dropoffDirections && (
                <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                  Note: "{formData.dropoffDirections}"
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground">{formData.dropoffRecipientName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>{formData.dropoffRecipientPhone}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. PACKAGE SPECS PREVIEW */}
      <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold font-heading text-foreground">Package Summary</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-7 text-xs px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </Button>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-muted/30 border">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Contents</p>
              <p className="text-xs font-bold text-foreground mt-0.5 truncate">{formData.packageContents}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30 border">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Weight</p>
              <p className="text-xs font-bold text-foreground mt-0.5">{formData.weightKg} kg</p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/30 border">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Handling</p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {formData.isFragile ? '⚠️ Fragile' : 'Standard'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. PRICING & ESTIMATED TIME BREAKDOWN */}
      <Card className="border-primary/30 shadow-md rounded-2xl overflow-hidden bg-card">
        <CardHeader className="bg-primary/5 border-b pb-3.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold font-heading">Payment & Delivery Fee</CardTitle>
            <Badge className="bg-primary text-white text-[11px] font-bold">
              Est. ~{pricing.distanceKm} km
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Base Pickup & Dispatch Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.baseFee.toLocaleString()}</span>
          </div>

          {pricing.distanceFee > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Distance Surcharge ({pricing.distanceKm} km)</span>
              <span className="font-semibold text-foreground">₦{pricing.distanceFee.toLocaleString()}</span>
            </div>
          )}

          {pricing.weightFee > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Heavy Weight Surcharge</span>
              <span className="font-semibold text-foreground">₦{pricing.weightFee.toLocaleString()}</span>
            </div>
          )}

          {pricing.fragileFee > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Fragile Package Insurance</span>
              <span className="font-semibold text-foreground">₦{pricing.fragileFee.toLocaleString()}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5" /> Estimated Delivery Time:
            </span>
            <span className="font-bold">{pricing.estimatedMinutesRange}</span>
          </div>

          <Separator className="my-2" />

          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-xs text-muted-foreground block font-medium">Total Amount Due</span>
              <span className="text-xl font-extrabold font-heading text-primary">
                ₦{pricing.totalFee.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Secured by Paystack</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          size="lg"
          disabled={isProcessing}
          onClick={handlePayAndCreateOrder}
          className="w-full h-13 rounded-2xl text-base font-bold shadow-lg bg-primary hover:bg-primary/95 text-white gap-2 transition-all active:scale-[0.99]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Initializing Secure Checkout...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              <span>Pay ₦{pricing.totalFee.toLocaleString()} & Send Package</span>
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          disabled={isProcessing}
          className="w-full h-11 rounded-xl text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Edit Information</span>
        </Button>
      </div>
    </m.div>
  );
}
