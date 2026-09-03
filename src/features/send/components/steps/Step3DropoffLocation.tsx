import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  Navigation,
  User,
  Phone,
  Compass,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useLocationDetector } from '../../hooks/useLocationDetector';
import { useSavedAddresses } from '../../hooks/useSavedAddresses';
import { SavedAddress } from '../../types';

interface Step3Props {
  formData: SendOrderFormData;
  onChange: (data: Partial<SendOrderFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3DropoffLocation({ formData, onChange, onNext, onBack }: Step3Props) {
  const { detectLocation, isDetecting } = useLocationDetector();
  const { addresses } = useSavedAddresses();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDetect = async () => {
    const res = await detectLocation();
    if (res) {
      onChange({
        dropoffAddress: res.address,
        dropoffLat: res.latitude,
        dropoffLng: res.longitude,
      });
    }
  };

  const handleSelectSaved = (addr: SavedAddress) => {
    onChange({
      dropoffAddress: addr.address,
      dropoffLat: addr.latitude,
      dropoffLng: addr.longitude,
      dropoffDirections: addr.directions || '',
      dropoffRecipientName: addr.contact_name || formData.dropoffRecipientName,
      dropoffRecipientPhone: addr.contact_phone || formData.dropoffRecipientPhone,
    });
  };

  const handleNext = () => {
    const errs: Record<string, string> = {};
    if (!formData.dropoffAddress.trim()) errs.dropoffAddress = 'Drop-off address is required';
    if (!formData.dropoffRecipientName.trim()) errs.dropoffRecipientName = "Recipient's name is required";
    if (!formData.dropoffRecipientPhone.trim()) errs.dropoffRecipientPhone = "Recipient's phone is required";

    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onNext();
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-5 pb-16"
    >
      <div className="space-y-1">
        <h2 className="text-base sm:text-lg font-bold font-heading text-foreground">
          Drop-off Location
        </h2>
        <p className="text-xs text-muted-foreground">
          Who is receiving this package and where should it be delivered?
        </p>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm bg-card overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
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
                    onClick={() => handleSelectSaved(a)}
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
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span>Drop-off Address</span> <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDetecting}
                onClick={handleDetect}
                className="h-7 text-xs px-2.5 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                {isDetecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Navigation className="w-3 h-3" />
                )}
                <span>{isDetecting ? 'Detecting...' : 'Detect Location'}</span>
              </Button>
            </div>
            <Input
              placeholder="e.g. Suite 8, Nicon Plaza, Wuse 2, Abuja"
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
                placeholder="e.g. John Michael"
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
                placeholder="e.g. 0807 123 4567"
                type="tel"
                maxLength={15}
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
              placeholder="e.g. Floor 2, opposite main reception. Call recipient upon arrival"
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
                placeholder="Label (e.g. Nicon Office, John Store)"
                value={formData.dropoffAddressLabel || ''}
                onChange={(e) => onChange({ dropoffAddressLabel: e.target.value })}
                className="h-8 text-xs sm:w-48"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3">
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
          onClick={handleNext}
          className="flex-1 h-12 rounded-xl text-sm font-bold shadow-md bg-primary hover:bg-primary/95 text-white gap-2"
        >
          <span>Continue to Review & Price</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </m.div>
  );
}
