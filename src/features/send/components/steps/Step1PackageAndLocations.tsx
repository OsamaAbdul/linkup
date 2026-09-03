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
  Bookmark,
  ShieldCheck,
  Compass,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useLocationDetector } from '../../hooks/useLocationDetector';
import { useSavedAddresses } from '../../hooks/useSavedAddresses';
import { SavedAddress } from '../../types';

interface Step1Props {
  formData: SendOrderFormData;
  onChange: (data: Partial<SendOrderFormData>) => void;
  onNext: () => void;
}

export function Step1PackageAndLocations({ formData, onChange, onNext }: Step1Props) {
  const { detectLocation, isDetecting } = useLocationDetector();
  const { addresses } = useSavedAddresses();
  const [activeDetectTarget, setActiveDetectTarget] = useState<'pickup' | 'dropoff' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDetect = async (target: 'pickup' | 'dropoff') => {
    setActiveDetectTarget(target);
    const result = await detectLocation();
    if (result) {
      if (target === 'pickup') {
        onChange({
          pickupAddress: result.address,
          pickupLat: result.latitude,
          pickupLng: result.longitude,
        });
      } else {
        onChange({
          dropoffAddress: result.address,
          dropoffLat: result.latitude,
          dropoffLng: result.longitude,
        });
      }
    }
    setActiveDetectTarget(null);
  };

  const handleSelectSaved = (target: 'pickup' | 'dropoff', addr: SavedAddress) => {
    if (target === 'pickup') {
      onChange({
        pickupAddress: addr.address,
        pickupLat: addr.latitude,
        pickupLng: addr.longitude,
        pickupDirections: addr.directions || '',
        senderName: addr.contact_name || formData.senderName,
        senderPhone: addr.contact_phone || formData.senderPhone,
      });
    } else {
      onChange({
        dropoffAddress: addr.address,
        dropoffLat: addr.latitude,
        dropoffLng: addr.longitude,
        dropoffDirections: addr.directions || '',
        dropoffRecipientName: addr.contact_name || formData.dropoffRecipientName,
        dropoffRecipientPhone: addr.contact_phone || formData.dropoffRecipientPhone,
      });
    }
  };

  const validateAndProceed = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.senderName.trim()) newErrors.senderName = "Sender's name is required";
    if (!formData.senderPhone.trim()) newErrors.senderPhone = "Sender's phone number is required";
    if (!formData.pickupAddress.trim()) newErrors.pickupAddress = 'Pickup address is required';

    if (!formData.dropoffRecipientName.trim()) newErrors.dropoffRecipientName = "Recipient's name is required";
    if (!formData.dropoffRecipientPhone.trim()) newErrors.dropoffRecipientPhone = "Recipient's phone number is required";
    if (!formData.dropoffAddress.trim()) newErrors.dropoffAddress = 'Drop-off address is required';

    if (!formData.packageContents.trim()) newErrors.packageContents = 'Please describe what you are sending';
    if (!formData.weightKg || formData.weightKg <= 0) newErrors.weightKg = 'Please specify a valid weight';

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    } else {
      // Scroll to top of form smoothly on error
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const weightPresets = [
    { label: 'Under 1 kg', value: 0.8 },
    { label: '1 - 3 kg', value: 2.0 },
    { label: '3 - 7 kg', value: 5.0 },
    { label: '7 - 15 kg', value: 10.0 },
  ];

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      {/* 1. PICKUP & SENDER SECTION */}
      <Card className="border-border/70 shadow-sm overflow-hidden rounded-2xl bg-card">
        <CardHeader className="bg-muted/40 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold font-heading">1. Pickup Location & Sender</CardTitle>
                <CardDescription className="text-xs">Where should our rider collect the package?</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border-emerald-200">
              Pickup
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Saved Addresses quick-pills */}
          {addresses.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-primary" /> Saved Addresses:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectSaved('pickup', a)}
                    className="text-xs px-2.5 py-1 rounded-lg border bg-background hover:bg-muted transition-colors text-left flex items-center gap-1.5"
                  >
                    <span className="font-semibold text-foreground">{a.label}:</span>
                    <span className="text-muted-foreground truncate max-w-[140px]">{a.address}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pickup Address Input & GPS Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Pickup Address <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDetecting}
                onClick={() => handleDetect('pickup')}
                className="h-7 text-xs px-2.5 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                {activeDetectTarget === 'pickup' && isDetecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
                <span>{activeDetectTarget === 'pickup' && isDetecting ? 'Detecting...' : 'Detect My Location'}</span>
              </Button>
            </div>
            <div className="relative">
              <Input
                placeholder="Enter street address, building or landmark"
                value={formData.pickupAddress}
                onChange={(e) => onChange({ pickupAddress: e.target.value })}
                className={errors.pickupAddress ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>
            {errors.pickupAddress && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.pickupAddress}
              </p>
            )}
          </div>

          {/* Sender Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Sender's Name{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Osama Abdul"
                value={formData.senderName}
                onChange={(e) => onChange({ senderName: e.target.value })}
                className={errors.senderName ? 'border-destructive' : ''}
              />
              {errors.senderName && <p className="text-[11px] text-destructive">{errors.senderName}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Sender's Phone{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. 08123456789"
                type="tel"
                maxLength={11}
                value={formData.senderPhone}
                onChange={(e) => onChange({ senderPhone: e.target.value })}
                className={errors.senderPhone ? 'border-destructive' : ''}
              />
              {errors.senderPhone && <p className="text-[11px] text-destructive">{errors.senderPhone}</p>}
            </div>
          </div>

          {/* Optional Directions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Additional Directions / Landmarks (Optional)
            </Label>
            <Textarea
              placeholder="e.g. Second black gate after the pharmacy, call before entering"
              value={formData.pickupDirections || ''}
              onChange={(e) => onChange({ pickupDirections: e.target.value })}
              className="resize-none h-18 text-xs"
            />
          </div>

          {/* Save Address Checkbox */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-pickup"
                checked={formData.savePickupAddress}
                onCheckedChange={(c) => onChange({ savePickupAddress: !!c })}
              />
              <label htmlFor="save-pickup" className="text-xs font-medium cursor-pointer select-none">
                Save pickup address for future packages
              </label>
            </div>
            {formData.savePickupAddress && (
              <Input
                placeholder="Label (e.g. My Office, Home)"
                value={formData.pickupAddressLabel || ''}
                onChange={(e) => onChange({ pickupAddressLabel: e.target.value })}
                className="h-8 text-xs sm:w-48"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. DROP-OFF & RECIPIENT SECTION */}
      <Card className="border-border/70 shadow-sm overflow-hidden rounded-2xl bg-card">
        <CardHeader className="bg-muted/40 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold font-heading">2. Drop-off Location & Recipient</CardTitle>
                <CardDescription className="text-xs">Where is this package being delivered?</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-semibold text-blue-700 bg-blue-50 border-blue-200">
              Drop-off
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Saved Addresses quick-pills */}
          {addresses.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-primary" /> Saved Addresses:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectSaved('dropoff', a)}
                    className="text-xs px-2.5 py-1 rounded-lg border bg-background hover:bg-muted transition-colors text-left flex items-center gap-1.5"
                  >
                    <span className="font-semibold text-foreground">{a.label}:</span>
                    <span className="text-muted-foreground truncate max-w-[140px]">{a.address}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Drop-off Address Input & GPS Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Drop-off Address <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDetecting}
                onClick={() => handleDetect('dropoff')}
                className="h-7 text-xs px-2.5 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                {activeDetectTarget === 'dropoff' && isDetecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
                <span>{activeDetectTarget === 'dropoff' && isDetecting ? 'Detecting...' : 'Detect Location'}</span>
              </Button>
            </div>
            <Input
              placeholder="Enter destination street address, area or house number"
              value={formData.dropoffAddress}
              onChange={(e) => onChange({ dropoffAddress: e.target.value })}
              className={errors.dropoffAddress ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.dropoffAddress && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.dropoffAddress}
              </p>
            )}
          </div>

          {/* Recipient Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Recipient's Name{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. 
                Osama Abdul"
                value={formData.dropoffRecipientName}
                onChange={(e) => onChange({ dropoffRecipientName: e.target.value })}
                className={errors.dropoffRecipientName ? 'border-destructive' : ''}
              />
              {errors.dropoffRecipientName && (
                <p className="text-[11px] text-destructive">{errors.dropoffRecipientName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Recipient's Phone{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. 08123456789"
                type="tel"
                maxLength={11}
                value={formData.dropoffRecipientPhone}
                onChange={(e) => onChange({ dropoffRecipientPhone: e.target.value })}
                className={errors.dropoffRecipientPhone ? 'border-destructive' : ''}
              />
              {errors.dropoffRecipientPhone && (
                <p className="text-[11px] text-destructive">{errors.dropoffRecipientPhone}</p>
              )}
            </div>
          </div>

          {/* Optional Directions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> Additional Directions / Landmarks (Optional)
            </Label>
            <Textarea
              placeholder="e.g. Apartment 4B, ring doorbell or call recipient upon arrival"
              value={formData.dropoffDirections || ''}
              onChange={(e) => onChange({ dropoffDirections: e.target.value })}
              className="resize-none h-18 text-xs"
            />
          </div>

          {/* Save Address Checkbox */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-dropoff"
                checked={formData.saveDropoffAddress}
                onCheckedChange={(c) => onChange({ saveDropoffAddress: !!c })}
              />
              <label htmlFor="save-dropoff" className="text-xs font-medium cursor-pointer select-none">
                Save drop-off address for future packages
              </label>
            </div>
            {formData.saveDropoffAddress && (
              <Input
                placeholder="Label (e.g. Chioma's Store, Branch)"
                value={formData.dropoffAddressLabel || ''}
                onChange={(e) => onChange({ dropoffAddressLabel: e.target.value })}
                className="h-8 text-xs sm:w-48"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. PACKAGE DETAILS SECTION */}
      <Card className="border-border/70 shadow-sm overflow-hidden rounded-2xl bg-card">
        <CardHeader className="bg-muted/40 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold font-heading">3. Package Specifications</CardTitle>
                <CardDescription className="text-xs">Describe what you are sending to ensure safe transit</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-semibold text-amber-700 bg-amber-50 border-amber-200">
              Specs
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Contents */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Package Contents / Description <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Legal documents, iPhone in box, Handbag, Birthday cake"
              value={formData.packageContents}
              onChange={(e) => onChange({ packageContents: e.target.value })}
              className={errors.packageContents ? 'border-destructive' : ''}
            />
            {errors.packageContents && <p className="text-[11px] text-destructive">{errors.packageContents}</p>}
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-muted-foreground" /> Weight Estimate (kg){' '}
                <span className="text-destructive">*</span>
              </Label>
              <span className="text-xs font-bold text-primary">{formData.weightKg || 0} kg</span>
            </div>

            {/* Quick presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {weightPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChange({ weightKg: preset.value })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${formData.weightKg === preset.value
                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                    }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Weight Input */}
            <div className="pt-1">
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Or enter exact weight in kg"
                value={formData.weightKg || ''}
                onChange={(e) => onChange({ weightKg: parseFloat(e.target.value) || 0 })}
                className={`h-9 text-xs ${errors.weightKg ? 'border-destructive' : ''}`}
              />
              {errors.weightKg && <p className="text-[11px] text-destructive mt-1">{errors.weightKg}</p>}
            </div>
          </div>

          {/* Fragile Switch */}
          <div className="pt-2 flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Fragile or Handle with Care</p>
                <p className="text-[11px] text-muted-foreground">Alerts rider to handle with utmost delicacy</p>
              </div>
            </div>
            <Checkbox
              checked={formData.isFragile}
              onCheckedChange={(c) => onChange({ isFragile: !!c })}
              className="h-5 w-5"
            />
          </div>
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="pt-2">
        <Button
          type="button"
          size="lg"
          onClick={validateAndProceed}
          className="w-full h-12 rounded-xl text-sm font-bold shadow-md bg-primary hover:bg-primary/95 text-white gap-2"
        >
          <span>Preview Package & Pricing</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </m.div>
  );
}
