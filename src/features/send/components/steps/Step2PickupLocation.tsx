import React, { useState } from 'react';
import { motion as m } from 'framer-motion';
import {
  MapPin,
  Navigation,
  User,
  Phone,
  Compass,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
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
import { AddressAutocompleteInput } from '../AddressAutocompleteInput';
import { LocationPickerMap } from '../LocationPickerMap';

interface Step2Props {
  formData: SendOrderFormData;
  onChange: (data: Partial<SendOrderFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2PickupLocation({ formData, onChange, onNext, onBack }: Step2Props) {
  const { detectLocation, isDetecting } = useLocationDetector();
  const { addresses } = useSavedAddresses();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasCoords = typeof formData.pickupLat === 'number' && typeof formData.pickupLng === 'number';

  const handleDetect = async () => {
    const res = await detectLocation();
    if (res) {
      onChange({
        pickupAddress: res.address,
        pickupLat: res.latitude,
        pickupLng: res.longitude,
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.pickupLat;
        delete next.pickupAddress;
        return next;
      });
    }
  };

  const handleSelectSaved = (addr: SavedAddress) => {
    onChange({
      pickupAddress: addr.address,
      pickupLat: addr.latitude,
      pickupLng: addr.longitude,
      pickupDirections: addr.directions || '',
      senderName: addr.contact_name || formData.senderName,
      senderPhone: addr.contact_phone || formData.senderPhone,
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.pickupLat;
      delete next.pickupAddress;
      return next;
    });
  };

  const handleNext = () => {
    const errs: Record<string, string> = {};
    if (!formData.pickupAddress.trim()) errs.pickupAddress = 'Pickup address is required';
    if (!formData.senderName.trim()) errs.senderName = "Sender's name is required";
    if (!formData.senderPhone.trim()) errs.senderPhone = "Sender's phone is required";

    // Compulsory coordinates validation
    if (typeof formData.pickupLat !== 'number' || typeof formData.pickupLng !== 'number') {
      errs.pickupLat = 'Compulsory: Please detect or pinpoint your exact pickup coordinates on the live map';
    }

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
          Pickup Location
        </h2>
        <p className="text-xs text-muted-foreground">
          Accurate GPS location detection is compulsory so the nearest rider can locate you instantly.
        </p>
      </div>

      {/* Compulsory GPS Detection Prompt Banner */}
      {!hasCoords ? (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Accurate Coordinates Required</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click <strong>"Detect My GPS"</strong> or tap on the live map below to lock your precise pickup coordinates.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isDetecting}
            onClick={handleDetect}
            className="h-8 px-3 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shrink-0 gap-1.5 shadow"
          >
            {isDetecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5" />
            )}
            <span>{isDetecting ? 'Detecting...' : 'Detect GPS'}</span>
          </Button>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              Sender GPS Location Verified
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-300">
            {formData.pickupLat?.toFixed(4)}, {formData.pickupLng?.toFixed(4)}
          </span>
        </div>
      )}

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

          {/* Pickup Address Input with Autocomplete & Geocoding */}
          <AddressAutocompleteInput
            label="Pickup Address / Street Landmark"
            icon={<MapPin className="w-3.5 h-3.5 text-primary" />}
            placeholder="e.g. Lifecamp, Abuja or search street..."
            value={formData.pickupAddress}
            latitude={formData.pickupLat}
            longitude={formData.pickupLng}
            error={errors.pickupAddress}
            isRequired
            onChangeAddress={(text) => onChange({ pickupAddress: text })}
            onSelectLocation={({ address, latitude, longitude }) => {
              onChange({
                pickupAddress: address,
                pickupLat: latitude,
                pickupLng: longitude,
              });
              setErrors((prev) => {
                const next = { ...prev };
                delete next.pickupLat;
                delete next.pickupAddress;
                return next;
              });
            }}
          />

          {/* Live Interactive Location Picker Map */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-primary" /> Live Pickup Map & Accurate Pinpoint
                <span className="text-destructive">*</span>
              </span>
              <span className="text-[10px] text-muted-foreground">Drag pin or tap map</span>
            </Label>
            <LocationPickerMap
              latitude={formData.pickupLat}
              longitude={formData.pickupLng}
              address={formData.pickupAddress}
              mode="pickup"
              isCompulsory
              onLocationSelect={({ latitude, longitude, address }) => {
                onChange({
                  pickupLat: latitude,
                  pickupLng: longitude,
                  ...(address ? { pickupAddress: address } : {}),
                });
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.pickupLat;
                  delete next.pickupAddress;
                  return next;
                });
              }}
            />
            {errors.pickupLat && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-semibold pt-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.pickupLat}
              </p>
            )}
          </div>

          {/* Sender Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Sender's Name{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Osama Abdullahi"
                value={formData.senderName}
                onChange={(e) => {
                  onChange({ senderName: e.target.value });
                  if (errors.senderName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.senderName;
                      return next;
                    });
                  }
                }}
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
                placeholder="e.g. +2348123456789"
                type="tel"
                maxLength={15}
                value={formData.senderPhone}
                onChange={(e) => {
                  onChange({ senderPhone: e.target.value });
                  if (errors.senderPhone) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.senderPhone;
                      return next;
                    });
                  }
                }}
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
              placeholder="e.g. Second gate after the roundabout, call when arriving"
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
                placeholder="Label (e.g. My Home, Office)"
                value={formData.pickupAddressLabel || ''}
                onChange={(e) => onChange({ pickupAddressLabel: e.target.value })}
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
          <span>Continue to Drop-off Location</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </m.div>
  );
}
