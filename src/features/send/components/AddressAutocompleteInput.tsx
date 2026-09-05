import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Loader2,
  CheckCircle2,
  Search,
  Compass,
} from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  searchNigerianAddresses,
  forwardGeocode,
  useLocationDetector,
  GeocodeResult,
} from '../hooks/useLocationDetector';
import {
  searchGooglePlaces,
  getGooglePlaceDetails,
  GooglePlaceSuggestion,
} from '../utils/googleMapsLoader';

interface AddressAutocompleteInputProps {
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  value: string;
  latitude?: number | null;
  longitude?: number | null;
  error?: string;
  isRequired?: boolean;
  onChangeAddress: (address: string) => void;
  onSelectLocation: (data: { address: string; latitude: number; longitude: number }) => void;
}

export function AddressAutocompleteInput({
  label,
  icon,
  placeholder = 'Enter address, area or landmark',
  value,
  latitude,
  longitude,
  error,
  isRequired = true,
  onChangeAddress,
  onSelectLocation,
}: AddressAutocompleteInputProps) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<
    Array<{ displayName: string; primaryTitle: string; subtitle: string; placeId?: string; geocode?: GeocodeResult }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasManuallySelected, setHasManuallySelected] = useState(Boolean(latitude && longitude));
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const { detectLocation, isDetecting } = useLocationDetector();

  // Keep query in sync if parent changes value (e.g. from saved address pill)
  useEffect(() => {
    setQuery(value || '');
    if (latitude && longitude) {
      setHasManuallySelected(true);
    }
  }, [value, latitude, longitude]);

  // Click outside listener to close suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    onChangeAddress(text);
    setHasManuallySelected(false);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (text.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);

      // 1. Try Google Places Autocomplete first
      try {
        const googleResults = await searchGooglePlaces(text);
        if (googleResults.length > 0) {
          setSuggestions(
            googleResults.map((g) => ({
              displayName: g.displayName,
              primaryTitle: g.mainText,
              subtitle: g.secondaryText,
              placeId: g.placeId,
            }))
          );
          setIsOpen(true);
          setIsLoading(false);
          return;
        }
      } catch {}

      // 2. Fallback to OpenStreetMap / Nominatim search
      const results = await searchNigerianAddresses(text);
      setSuggestions(
        results.map((item) => {
          const parts = item.displayName.split(',');
          return {
            displayName: item.displayName,
            primaryTitle: parts.slice(0, 2).join(',').trim(),
            subtitle: parts.slice(2).join(',').trim(),
            geocode: item,
          };
        })
      );
      setIsOpen(results.length > 0);
      setIsLoading(false);
    }, 300);
  };

  const handleSelectSuggestion = async (item: typeof suggestions[0]) => {
    setQuery(item.primaryTitle || item.displayName);
    setSuggestions([]);
    setIsOpen(false);
    setHasManuallySelected(true);

    // If suggestion came from Google Places, resolve exact coordinates via placeId
    if (item.placeId) {
      const details = await getGooglePlaceDetails(item.placeId);
      if (details) {
        onSelectLocation({
          address: details.address || item.displayName,
          latitude: details.latitude,
          longitude: details.longitude,
        });
        return;
      }
    }

    // If suggestion came from Nominatim geocode
    if (item.geocode) {
      const shortAddress = item.geocode.displayName.split(',').slice(0, 3).join(',').trim();
      onSelectLocation({
        address: shortAddress,
        latitude: item.geocode.latitude,
        longitude: item.geocode.longitude,
      });
      return;
    }

    // Forward geocode fallback
    const bestMatch = await forwardGeocode(item.displayName);
    if (bestMatch) {
      onSelectLocation({
        address: item.displayName,
        latitude: bestMatch.latitude,
        longitude: bestMatch.longitude,
      });
    }
  };


  const handleBlur = async () => {
    // If user typed an address but didn't click dropdown and no coords set yet, auto-geocode!
    if (query.trim().length >= 3 && (!latitude || !longitude || !hasManuallySelected)) {
      const bestMatch = await forwardGeocode(query);
      if (bestMatch) {
        setHasManuallySelected(true);
        onSelectLocation({
          address: query.trim(),
          latitude: bestMatch.latitude,
          longitude: bestMatch.longitude,
        });
      }
    }
  };

  const handleDetectGPS = async () => {
    const res = await detectLocation();
    if (res) {
      setQuery(res.address);
      setHasManuallySelected(true);
      setIsOpen(false);
      onSelectLocation({
        address: res.address,
        latitude: res.latitude,
        longitude: res.longitude,
      });
    }
  };

  const hasCoordinates = Boolean(latitude && longitude);

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
          {icon || <MapPin className="w-3.5 h-3.5 text-primary" />}
          <span>{label}</span>
          {isRequired && <span className="text-destructive">*</span>}
        </Label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDetecting}
          onClick={handleDetectGPS}
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

      <div className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className={`pr-8 ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-muted-foreground">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : hasCoordinates ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Search className="w-3.5 h-3.5 opacity-40" />
          )}
        </div>
      </div>

      {/* Verified Coordinates Pill */}
      {hasCoordinates && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium px-1">
          <Compass size={11} className="text-emerald-600" />
          <span>Coordinates verified: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</span>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1">
          {error}
        </p>
      )}

      {/* Suggestions Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-card border border-black/[0.08] dark:border-border rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-black/[0.04] max-h-56 overflow-y-auto">
          {suggestions.map((item, idx) => {
            const parts = item.displayName.split(',');
            const primaryTitle = parts.slice(0, 2).join(',').trim();
            const subtitle = parts.slice(2).join(',').trim();

            return (
              <button
                key={idx}
                type="button"
                onMouseDown={() => handleSelectSuggestion(item)}
                className="w-full text-left p-3 hover:bg-orange-50/60 transition-colors flex items-start gap-2.5 group"
              >
                <div className="w-7 h-7 rounded-lg bg-orange-100/60 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                  <MapPin size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                    {primaryTitle}
                  </p>
                  {subtitle && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
