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
  Route,
  MapPin,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useSendPricing } from '../../hooks/useSendPricing';
import { RoutePreviewMap } from '../RoutePreviewMap';

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
          Verified GPS coordinates and calculated delivery distance.
        </p>
      </div>

      {/* LIVE ROUTE MAP */}
      <RoutePreviewMap
        pickupLat={formData.pickupLat}
        pickupLng={formData.pickupLng}
        dropoffLat={formData.dropoffLat}
        dropoffLng={formData.dropoffLng}
        distanceKm={pricing.distanceKm}
        estimatedMinutes={pricing.estimatedMinutesRange}
      />

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
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
            {pricing.distanceKm} KM Route
          </Badge>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Pickup */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-background shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-foreground">Pickup Location</p>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200">
                    {formData.pickupLat?.toFixed(4)}, {formData.pickupLng?.toFixed(4)}
                  </span>
                </div>
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

          {/* Connecting line with distance */}
          <div className="flex items-center gap-2 ml-1.5 -my-1">
            <div className="border-l-2 border-dashed border-primary h-5 ml-[2px]" />
            <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/20">
              {pricing.distanceKm} KM
            </span>
          </div>

          {/* Drop-off */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <span className="w-3 h-3 rounded-full border-2 border-blue-600 bg-background shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-foreground">Drop-off Location</p>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded border border-blue-200">
                    {formData.dropoffLat?.toFixed(4)}, {formData.dropoffLng?.toFixed(4)}
                  </span>
                </div>
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
                  {formData.isFragile && ' • Fragile'}
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
                <p className="font-bold text-foreground">Estimated Delivery Time</p>
                <p className="text-[11px] text-primary font-extrabold">{pricing.estimatedMinutesRange}</p>
                <p className="text-[10px] text-muted-foreground">Calculated for {pricing.distanceKm} km route</p>
              </div>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
              Fast Delivery
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2. DELIVERY FEE BREAKDOWN (EXPLICIT KM FORMULA) */}
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
          <span className="text-[11px] font-semibold text-muted-foreground">
            Base + ({pricing.distanceKm} km × ₦{pricing.perKmRate})
          </span>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Base Delivery Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.baseFee.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <Route className="w-3 h-3 text-primary" />
              <span>Distance Fee ({pricing.distanceKm} km × ₦{pricing.perKmRate}/km)</span>
            </span>
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
              <span>Fragile Handling Surcharge</span>
              <span className="font-semibold text-foreground">+₦{pricing.fragileSurcharge.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Platform Service Fee</span>
            <span className="font-semibold text-foreground">₦{pricing.serviceFee.toLocaleString()}</span>
          </div>
          <div className="pt-2 border-t flex items-center justify-between font-bold">
            <span className="text-foreground">Total Delivery Fee</span>
            <span className="text-base text-primary font-extrabold font-heading">
              ₦{pricing.totalFee.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. SAFE & SECURE BANNER */}
      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 flex items-center gap-2.5">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <div>
          <p className="text-xs font-bold text-foreground">Safe & Insured Delivery</p>
          <p className="text-[11px] text-muted-foreground">
            Accurate GPS routing ensures smooth rider pickup and doorstep drop-off.
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
