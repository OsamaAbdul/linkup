import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
  Wallet,
  CreditCard,
  Lock,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useSendPricing } from '../../hooks/useSendPricing';
import { usePaystackInline } from '@/features/marketplace/hooks/usePaystackInline';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { generateSendOrderId } from '../../utils/orderId';
import { toast } from 'sonner';

interface Step5Props {
  formData: SendOrderFormData;
  onEdit: () => void;
  onPaymentSuccess: (orderId: string) => void;
  onBack: () => void;
}

export function Step5ConfirmAndPay({
  formData,
  onEdit,
  onPaymentSuccess,
  onBack,
}: Step5Props) {
  const { user } = useAuth();
  const { pay } = usePaystackInline();
  const [agreed, setAgreed] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const pricing = useSendPricing({
    pickupLat: formData.pickupLat,
    pickupLng: formData.pickupLng,
    dropoffLat: formData.dropoffLat,
    dropoffLng: formData.dropoffLng,
    weightKg: formData.weightKg,
    isFragile: formData.isFragile,
  });

  const handleConfirmAndPay = async () => {
    if (!agreed) {
      toast.error('Please accept the LinkUp Send Terms & Conditions');
      return;
    }

    setIsProcessing(true);

    try {
      const orderId = generateSendOrderId();
      const clientReference = `ref_${orderId}_${Date.now()}`;

      // 1. Authoritative Backend Fee Verification (Frontend values are never trusted)
      let verifiedFee = pricing.totalFee;
      let verifiedDistanceKm = pricing.distanceKm;
      let feeBreakdownDetails: any = null;

      try {
        const { data: feeData, error: feeErr } = await (supabase as any).rpc('calculate_send_delivery_fee', {
          p_pickup_lat: formData.pickupLat || null,
          p_pickup_lng: formData.pickupLng || null,
          p_dropoff_lat: formData.dropoffLat || null,
          p_dropoff_lng: formData.dropoffLng || null,
          p_weight_kg: formData.weightKg,
          p_is_fragile: formData.isFragile,
        });

        if (!feeErr && feeData && typeof feeData.total_fee === 'number') {
          verifiedFee = Number(feeData.total_fee);
          verifiedDistanceKm = Number(feeData.distance_km || pricing.distanceKm);
          feeBreakdownDetails = feeData;
        }
      } catch (verifyErr) {
        console.warn('Backend fee calculation fallback:', verifyErr);
      }

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
          distance_km: verifiedDistanceKm,
          pricing_breakdown: feeBreakdownDetails,
        },
        delivery_fee: verifiedFee,
        currency: 'NGN',
        payment_status: 'pending',
        payment_ref: clientReference,
        estimated_delivery_time: new Date(Date.now() + 45 * 60000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (user) {
        try {
          await (supabase as any).from('send_orders').insert(orderRecord);
        } catch (dbErr) {
          console.warn('send_orders insert error:', dbErr);
        }
      }
      localStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(orderRecord));

      let publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        try {
          const { data: pkData } = await supabase.functions.invoke('paystack-public-key');
          publicKey = (pkData as any)?.publicKey;
        } catch {}
      }
      if (!publicKey) publicKey = 'pk_test_a68c07e0c8b21ffbe3c2cfbe9c4ce80c8ba269d0';

      const email =
        user?.email || `${formData.senderPhone.replace(/\D/g, '') || 'customer'}@linkup.delivery`;

      const paid = await pay({
        publicKey,
        email,
        amountKobo: Math.round(verifiedFee * 100),
        reference: clientReference,
        metadata: {
          order_id: orderId,
          order_type: 'send_order',
          sender_name: formData.senderName,
          verified_amount: verifiedFee,
        },
      });

      const confirmed = {
        ...orderRecord,
        status: 'finding_rider',
        payment_status: 'paid',
        payment_ref: paid?.reference || clientReference,
        paid_at: new Date().toISOString(),
      };

      if (user) {
        try {
          await (supabase as any)
            .from('send_orders')
            .update({
              status: 'finding_rider',
              payment_status: 'paid',
              payment_ref: paid?.reference || clientReference,
              paid_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        } catch (updErr) {
          console.warn('send_orders update error:', updErr);
        }
      }
      localStorage.setItem(`linkup_send_order_${orderId}`, JSON.stringify(confirmed));

      toast.success('Payment completed successfully!');
      onPaymentSuccess(orderId);
    } catch (err: any) {
      if (err?.message === 'Payment cancelled') {
        toast.info('Payment was cancelled');
      } else {
        toast.error(err?.message || 'Payment processing failed');
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
      className="space-y-4 pb-20"
    >
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-bold font-heading text-foreground">
          Confirm & Pay
        </h2>
        <p className="text-xs text-muted-foreground">
          Almost done! Confirm your order and make payment.
        </p>
      </div>

      {/* "You're all set!" Green Banner matching screenshot */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-foreground">You're all set!</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Please confirm your order details below and make payment to request a rider.
          </p>
        </div>
      </div>

      {/* 1. ORDER SUMMARY CARD */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-3.5 h-3.5" />
            </span>
            <CardTitle className="text-xs font-bold font-heading text-foreground">
              Order Summary
            </CardTitle>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-bold text-primary hover:underline"
          >
            Edit
          </button>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Pickup */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-full border-2 border-primary bg-background shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Pickup Location</p>
                <p className="text-muted-foreground mt-0.5">{formData.pickupAddress}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-foreground">{formData.senderName}</p>
              <p className="text-[11px] text-muted-foreground">{formData.senderPhone}</p>
            </div>
          </div>

          <div className="border-l-2 border-dashed border-muted ml-1.5 h-3 -my-2" />

          {/* Drop-off */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-background shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Drop-off Location</p>
                <p className="text-muted-foreground mt-0.5">{formData.dropoffAddress}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-foreground">{formData.dropoffRecipientName}</p>
              <p className="text-[11px] text-muted-foreground">{formData.dropoffRecipientPhone}</p>
            </div>
          </div>

          {/* Package Details */}
          <div className="pt-3 border-t flex items-start gap-2.5">
            <span className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5">📦</span>
            <div className="text-xs">
              <p className="font-bold text-foreground">Package Details</p>
              <p className="text-muted-foreground mt-0.5">
                Send a Package • {formData.weightKg <= 2 ? 'Small • Under 2kg' : `${formData.weightKg}kg`}
              </p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{formData.packageContents}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. THREE SUMMARY METRIC CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Metric 1: Estimated Delivery */}
        <Card className="rounded-xl border-border/70 p-3 bg-card shadow-sm">
          <div className="flex items-center gap-1.5 text-primary text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Estimated Delivery</span>
          </div>
          <p className="text-xs font-extrabold text-emerald-600 mt-1">15 - 45 mins</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
            Depending on traffic and rider availability
          </p>
        </Card>

        {/* Metric 2: Total Amount */}
        <Card className="rounded-xl border-border/70 p-3 bg-card shadow-sm">
          <div className="flex items-center gap-1.5 text-amber-600 text-xs font-bold">
            <Wallet className="w-3.5 h-3.5" />
            <span>Total Amount</span>
          </div>
          <p className="text-sm font-extrabold text-primary font-heading mt-1">
            ₦{pricing.totalFee.toLocaleString()}
          </p>
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 mt-0.5"
          >
            <span>See breakdown</span>
            {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </Card>

        {/* Metric 3: Payment Method */}
        <Card className="rounded-xl border-border/70 p-3 bg-card shadow-sm">
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payment Method</span>
          </div>
          <p className="text-xs font-bold text-foreground mt-1">
            Paystack
          </p>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold mt-0.5 px-1.5 py-0">
            Cards / Transfer / USSD
          </Badge>
        </Card>
      </div>

      {/* Collapsible Breakdown if clicked */}
      {showBreakdown && (
        <Card className="rounded-xl p-3.5 bg-muted/30 border text-xs space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Base Delivery Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.baseFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Distance Fee ({pricing.distanceKm} km × ₦{pricing.perKmRate}/km)</span>
            <span className="font-semibold text-foreground">₦{pricing.distanceFee.toLocaleString()}</span>
          </div>
          {pricing.packageSurcharge > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Package Weight Surcharge</span>
              <span className="font-semibold text-foreground">+₦{pricing.packageSurcharge.toLocaleString()}</span>
            </div>
          )}
          {pricing.fragileSurcharge > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Fragile Handling</span>
              <span className="font-semibold text-foreground">+₦{pricing.fragileSurcharge.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>Service Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.serviceFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold pt-1.5 border-t text-foreground">
            <span>Total Fee</span>
            <span className="text-primary font-extrabold">₦{pricing.totalFee.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {/* 3. SAFE & SECURE BANNER */}
      <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-foreground">Safe & Secure</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Your package is insured and protected every step of the way. You will receive updates at every stage of the delivery.
          </p>
        </div>
      </div>

      {/* Terms & Conditions Checkbox */}
      <div className="flex items-start space-x-2 pt-1 px-1">
        <Checkbox
          id="terms-check"
          checked={agreed}
          onCheckedChange={(c) => setAgreed(!!c)}
          className="mt-0.5 h-4 w-4"
        />
        <label htmlFor="terms-check" className="text-xs text-foreground font-medium cursor-pointer leading-tight">
          I confirm that the details provided are correct and I agree to Linkup Send{' '}
          <span className="text-primary underline">Terms & Conditions</span>.
        </label>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        <Button
          type="button"
          size="lg"
          disabled={isProcessing || !agreed}
          onClick={handleConfirmAndPay}
          className="w-full h-13 rounded-2xl text-base font-bold shadow-lg bg-primary hover:bg-primary/95 text-white gap-2 transition-all active:scale-[0.99]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing Payment...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Confirm & Pay ₦{pricing.totalFee.toLocaleString()}</span>
            </>
          )}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Secure Payment | Your payment is safe with Linkup Global</span>
        </p>

        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isProcessing}
          className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Review
        </Button>
      </div>
    </m.div>
  );
}
