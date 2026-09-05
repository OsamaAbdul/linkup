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
  CheckCircle2,
  MapPin,
  Route,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { SendOrderFormData } from '../../schemas/sendOrderSchema';
import { useSavedAddresses } from '../../hooks/useSavedAddresses';
import { SavedAddress } from '../../types';
import { AddressAutocompleteInput } from '../AddressAutocompleteInput';
import { LocationPickerMap } from '../LocationPickerMap';
import { useRoadRoute } from '../../hooks/useRoadRoute';
import { calculateHaversineDistance } from '../../hooks/useSendPricing';

interface Step3Props {
  formData: SendOrderFormData;
  onChange: (data: Partial<SendOrderFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3DropoffLocation({ formData, onChange, onNext, onBack }: Step3Props) {
  const { addresses } = useSavedAddresses();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hasDropoffCoords =
    typeof formData.dropoffLat === 'number' && typeof formData.dropoffLng === 'number';

  // Live real road distance calculation from OSRM
  const { data: roadData } = useRoadRoute(
    formData.pickupLat,
    formData.pickupLng,
    formData.dropoffLat,
    formData.dropoffLng
  );

  const distanceKm =
    roadData?.distanceKm ??
    (formData.pickupLat && formData.pickupLng && formData.dropoffLat && formData.dropoffLng
      ? calculateHaversineDistance(
          formData.pickupLat,
          formData.pickupLng,
          formData.dropoffLat,
          formData.dropoffLng
        )
      : null);


  const handleSelectSaved = (addr: SavedAddress) => {
    onChange({
      dropoffAddress: addr.address,
      dropoffLat: addr.latitude,
      dropoffLng: addr.longitude,
      dropoffDirections: addr.directions || '',
      dropoffRecipientName: addr.contact_name || formData.dropoffRecipientName,
      dropoffRecipientPhone: addr.contact_phone || formData.dropoffRecipientPhone,
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.dropoffLat;
      delete next.dropoffAddress;
      return next;
    });
  };

  const handleNext = () => {
    const errs: Record<string, string> = {};
    if (!formData.dropoffAddress.trim()) errs.dropoffAddress = 'Drop-off address is required';
    if (!formData.dropoffRecipientName.trim()) errs.dropoffRecipientName = "Recipient's name is required";
    if (!formData.dropoffRecipientPhone.trim()) errs.dropoffRecipientPhone = "Recipient's phone is required";

    // Compulsory coordinates validation for drop-off
    if (typeof formData.dropoffLat !== 'number' || typeof formData.dropoffLng !== 'number') {
      errs.dropoffLat = 'Please select or pinpoint the destination location on the live map';
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
          Drop-off Location
        </h2>
        <p className="text-xs text-muted-foreground">
          Search the recipient's address or pinpoint the exact drop-off spot on the live map.
        </p>
      </div>

      {/* Live Distance from Pickup Indicator Banner */}
      {distanceKm !== null ? (
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
              <Route className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">
                Calculated Delivery Distance
              </p>
              <p className="text-[11px] text-muted-foreground">
                From Pickup to Destination
              </p>
            </div>
          </div>
          <Badge className="bg-primary text-white font-extrabold font-heading text-sm px-3 py-1 shadow">
            {distanceKm} KM
          </Badge>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2.5">
          <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-[11px] text-muted-foreground">
            Search receiver address or tap on the map to match the exact coordinates and calculate distance in KM.
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

          {/* Drop-off Address Input with Autocomplete & Geocoding */}
          <AddressAutocompleteInput
            label="Drop-off Address / Destination"
            icon={<Navigation className="w-3.5 h-3.5 text-blue-600" />}
            placeholder="e.g. Suite 8, Nicon Plaza, Wuse 2, Abuja"
            value={formData.dropoffAddress}
            latitude={formData.dropoffLat}
            longitude={formData.dropoffLng}
            error={errors.dropoffAddress}
            isRequired
            onChangeAddress={(text) => onChange({ dropoffAddress: text })}
            onSelectLocation={({ address, latitude, longitude }) => {
              onChange({
                dropoffAddress: address,
                dropoffLat: latitude,
                dropoffLng: longitude,
              });
              setErrors((prev) => {
                const next = { ...prev };
                delete next.dropoffLat;
                delete next.dropoffAddress;
                return next;
              });
            }}
          />

          {/* Live Interactive Drop-off Location Picker Map */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-blue-600" /> Live Destination Map & Best-Match Pinpoint
                <span className="text-destructive">*</span>
              </span>
              <span className="text-[10px] text-muted-foreground">Drag pin or tap map</span>
            </Label>
            <LocationPickerMap
              latitude={formData.dropoffLat}
              longitude={formData.dropoffLng}
              address={formData.dropoffAddress}
              mode="dropoff"
              isCompulsory
              onLocationSelect={({ latitude, longitude, address }) => {
                onChange({
                  dropoffLat: latitude,
                  dropoffLng: longitude,
                  ...(address ? { dropoffAddress: address } : {}),
                });
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.dropoffLat;
                  delete next.dropoffAddress;
                  return next;
                });
              }}
            />
            {errors.dropoffLat && (
              <p className="text-[11px] text-destructive flex items-center gap-1 font-semibold pt-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.dropoffLat}
              </p>
            )}
          </div>

          {/* Recipient Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> Recipient's Name{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. John Michael"
                value={formData.dropoffRecipientName}
                onChange={(e) => {
                  onChange({ dropoffRecipientName: e.target.value });
                  if (errors.dropoffRecipientName) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.dropoffRecipientName;
                      return next;
                    });
                  }
                }}
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
                onChange={(e) => {
                  onChange({ dropoffRecipientPhone: e.target.value });
                  if (errors.dropoffRecipientPhone) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.dropoffRecipientPhone;
                      return next;
                    });
                  }
                }}
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
