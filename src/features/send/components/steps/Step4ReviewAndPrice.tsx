import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  FileText,
  Clock,
  Wallet,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useSendPricing } from '../../hooks/useSendPricing';

interface Step4Props {
  formData: SendOrderFormData;
  onGoToStep: (stepNumber: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step4ReviewAndPrice({
  formData,
  onGoToStep,
  onNext,
  onBack,
}: Step4Props) {
  const pricing = useSendPricing({
    pickupLat: formData.pickupLat,
    pickupLng: formData.pickupLng,
    dropoffLat: formData.dropoffLat,
    dropoffLng: formData.dropoffLng,
    weightKg: formData.weightKg,
    isFragile: formData.isFragile,
  });

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
          Review your order
        </h2>
        <p className="text-xs text-muted-foreground">
          Please confirm the details before we find a rider
        </p>
      </div>

      {/* 1. TRIP SUMMARY CARD */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-primary/10 text-primary">
              <FileText className="w-3.5 h-3.5" />
            </span>
            <CardTitle className="text-xs font-bold font-heading text-foreground">
              Trip Summary
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Pickup */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-full border-2 border-primary bg-background shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Pickup Location</p>
                <p className="text-muted-foreground mt-0.5">{formData.pickupAddress}</p>
                {formData.pickupDirections && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">
                    "{formData.pickupDirections}"
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-foreground">{formData.senderName}</p>
              <p className="text-[11px] text-muted-foreground">{formData.senderPhone}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onGoToStep(2)}
                className="h-6 px-2 text-[10px] text-primary border-primary/30 mt-1"
              >
                Edit
              </Button>
            </div>
          </div>

          {/* Connecting line */}
          <div className="border-l-2 border-dashed border-muted ml-1.5 h-3 -my-2" />

          {/* Drop-off */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-background shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Drop-off Location</p>
                <p className="text-muted-foreground mt-0.5">{formData.dropoffAddress}</p>
                {formData.dropoffDirections && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">
                    "{formData.dropoffDirections}"
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold text-foreground">{formData.dropoffRecipientName}</p>
              <p className="text-[11px] text-muted-foreground">{formData.dropoffRecipientPhone}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onGoToStep(3)}
                className="h-6 px-2 text-[10px] text-primary border-primary/30 mt-1"
              >
                Edit
              </Button>
            </div>
          </div>

          {/* Package Details */}
          <div className="pt-3 border-t flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5">📦</span>
              <div className="text-xs">
                <p className="font-bold text-foreground">Package Details</p>
                <p className="text-muted-foreground mt-0.5">
                  Send a Package • {formData.weightKg <= 2 ? 'Small • Under 2kg' : `${formData.weightKg}kg`}
                </p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{formData.packageContents}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onGoToStep(1)}
              className="h-6 px-2 text-[10px] text-primary border-primary/30 mt-1"
            >
              Edit
            </Button>
          </div>

          {/* Estimated Delivery */}
          <div className="pt-2 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <div className="text-xs">
                <p className="font-bold text-foreground">Estimated Delivery</p>
                <p className="text-[11px] text-primary font-extrabold">{pricing.estimatedMinutesRange}</p>
                <p className="text-[10px] text-muted-foreground">Depending on traffic and rider availability</p>
              </div>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
              Fast Delivery
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2. DELIVERY FEE BREAKDOWN */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-500/10 text-amber-600">
              <Wallet className="w-3.5 h-3.5" />
            </span>
            <CardTitle className="text-xs font-bold font-heading text-foreground">
              Delivery Fee Breakdown
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Base Delivery Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.baseFee.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Distance Fee ({pricing.distanceKm} km × ₦{pricing.perKmRate}/km)</span>
            <span className="font-semibold text-foreground">₦{pricing.distanceFee.toLocaleString()}</span>
          </div>
          {pricing.packageSurcharge > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Package Weight Surcharge</span>
              <span className="font-semibold text-foreground">+₦{pricing.packageSurcharge.toLocaleString()}</span>
            </div>
          )}
          {pricing.fragileSurcharge > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Fragile Handling</span>
              <span className="font-semibold text-foreground">+₦{pricing.fragileSurcharge.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Service Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.serviceFee.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t flex items-center justify-between font-bold">
            <span className="text-foreground">Total</span>
            <span className="text-base text-primary font-extrabold font-heading">
              ₦{pricing.totalFee.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. PAYMENT METHOD (STRICTLY PAYSTACK) */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 border-b">
          <div className="flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
            <CardTitle className="text-xs font-bold font-heading text-foreground">
              Payment Method
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="w-full p-3.5 rounded-xl border border-primary/40 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full border border-primary flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-primary" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-foreground">Paystack Checkout</p>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold px-1.5 py-0">
                    Default
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Card, Bank Transfer, USSD, Apple Pay
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold">VISA</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-extrabold">MC</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">Verve</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. SAFE & SECURE BANNER */}
      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <div>
          <p className="text-xs font-bold text-foreground">Safe & Secure</p>
          <p className="text-[11px] text-muted-foreground">
            Your package is insured and protected every step of the way.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="h-12 px-4 rounded-xl text-xs font-semibold gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Button>

        <Button
          type="button"
          size="lg"
          onClick={onNext}
          className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md bg-primary hover:bg-primary/95 text-white gap-2"
        >
          <span>Continue to Payment</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </m.div>
  );
}
