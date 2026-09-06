import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Loader2,
  CheckCircle2,
  Search,
  Compass,
  Building,
  Store,
  Home,
  Bookmark,
  Sparkles,
  X,
} from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { useLocationDetector } from '../hooks/useLocationDetector';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import {
  searchAddresses,
  resolveSuggestionCoordinates,
  findBestCoordinatesForAddress,
  getPopularQuickPicks,
  AddressSuggestion,
} from '../services/addressSearchService';

interface AddressAutocompleteInputProps {
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  value: string;
  latitude?: number | null;
  longitude?: number | null;
  error?: string;
  isRequired?: boolean;
  mode?: 'pickup' | 'dropoff';
  showQuickPills?: boolean;
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
  mode = 'dropoff',
  showQuickPills = true,
  onChangeAddress,
  onSelectLocation,
}: AddressAutocompleteInputProps) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [resolvedAreaName, setResolvedAreaName] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const { detectLocation, isDetecting } = useLocationDetector();
  const { addresses: savedAddresses } = useSavedAddresses();

  // Sync internal query when parent changes value
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = async (text: string) => {
    setIsLoading(true);
    try {
      const results = await searchAddresses(text, savedAddresses);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setQuery(text);
    onChangeAddress(text);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!text.trim()) {
      // If cleared, show quick picks
      const picks = getPopularQuickPicks(savedAddresses);
      setSuggestions(picks);
      setIsOpen(true);
      return;
    }

    // Fast search with short debounce for responsive feel
    debounceTimer.current = setTimeout(() => {
      executeSearch(text);
    }, 150);
  };

  const handleSelectSuggestion = async (item: AddressSuggestion) => {
    const chosenAddress = item.displayName || item.primaryTitle;
    setQuery(chosenAddress);
    onChangeAddress(chosenAddress);
    setIsOpen(false);

    // Resolve coordinates guaranteed
    const resolved = await resolveSuggestionCoordinates(item);
    if (resolved) {
      setResolvedAreaName(item.primaryTitle);
      onSelectLocation({
        address: chosenAddress,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
    } else {
      // Fallback best effort
      const fallback = findBestCoordinatesForAddress(chosenAddress);
      if (fallback) {
        setResolvedAreaName(fallback.matchedArea || item.primaryTitle);
        onSelectLocation({
          address: chosenAddress,
          latitude: fallback.latitude,
          longitude: fallback.longitude,
        });
      }
    }
  };

  const handleBlur = () => {
    // Slight timeout so click on suggestion dropdown fires first
    setTimeout(() => {
      if (query.trim().length >= 3 && (!latitude || !longitude)) {
        const match = findBestCoordinatesForAddress(query);
        if (match) {
          setResolvedAreaName(match.matchedArea || '');
          onSelectLocation({
            address: query.trim(),
            latitude: match.latitude,
            longitude: match.longitude,
          });
        }
      }
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleDetectGPS = async () => {
    const res = await detectLocation();
    if (res) {
      setQuery(res.address);
      onChangeAddress(res.address);
      setIsOpen(false);
      setResolvedAreaName(res.city || 'GPS Location');
      onSelectLocation({
        address: res.address,
        latitude: res.latitude,
        longitude: res.longitude,
      });
    }
  };

  const handleQuickPillClick = (item: AddressSuggestion) => {
    handleSelectSuggestion(item);
  };

  const hasCoordinates = Boolean(typeof latitude === 'number' && typeof longitude === 'number');

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'saved':
        return <Bookmark className="w-3.5 h-3.5 text-amber-600" />;
      case 'mall':
      case 'plaza':
        return <Store className="w-3.5 h-3.5 text-purple-600" />;
      case 'estate':
        return <Home className="w-3.5 h-3.5 text-emerald-600" />;
      case 'district':
        return <Building className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getCategoryBadge = (category?: string) => {
    switch (category) {
      case 'saved':
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-700 bg-amber-50">Saved</Badge>;
      case 'mall':
      case 'plaza':
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-300 text-purple-700 bg-purple-50">Mall / Plaza</Badge>;
      case 'estate':
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50">Estate</Badge>;
      case 'district':
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 text-blue-700 bg-blue-50">District</Badge>;
      default:
        return null;
    }
  };

  // Popular Quick-Pills for 1-tap select
  const quickPillItems = [
    { label: 'Wuse 2', query: 'Wuse 2, Abuja', lat: 9.0782, lng: 7.4725 },
    { label: 'Banex Plaza', query: 'Banex Plaza, Aminu Kano Crescent, Wuse 2, Abuja', lat: 9.0837, lng: 7.4746 },
    { label: 'Maitama', query: 'Maitama, Abuja', lat: 9.0882, lng: 7.4983 },
    { label: 'Gwarinpa', query: 'Gwarinpa Estate, Abuja', lat: 9.1124, lng: 7.4101 },
    { label: 'Jabi Lake Mall', query: 'Jabi Lake Mall, Bala Sokoto Way, Jabi, Abuja', lat: 9.0772, lng: 7.4287 },
    { label: 'Lekki Phase 1', query: 'Lekki Phase 1, Lekki, Lagos', lat: 6.4474, lng: 3.4735 },
    { label: 'Ikeja Mall', query: 'Ikeja City Mall (ICM), Alausa, Ikeja, Lagos', lat: 6.6186, lng: 3.3582 },
  ];

  return (
    <div ref={containerRef} className="space-y-2 relative">
      {/* Top Header / Label Bar */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {icon || <MapPin className="w-3.5 h-3.5 text-primary" />}
          <span>{label}</span>
          {isRequired && <span className="text-destructive">*</span>}
        </Label>

        {mode === 'pickup' ? (
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
            <span>{isDetecting ? 'Detecting...' : 'Detect GPS'}</span>
          </Button>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Sparkles className="w-3 h-3 text-primary animate-pulse" />
            <span>Auto-suggest active</span>
          </div>
        )}
      </div>

      {/* Main Input Field */}
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length === 0) {
              const picks = getPopularQuickPicks(savedAddresses);
              setSuggestions(picks);
            }
            setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`pr-16 text-xs h-10 ${
            error ? 'border-destructive focus-visible:ring-destructive' : ''
          } ${hasCoordinates ? 'border-emerald-500/40 focus-visible:ring-emerald-500/30' : ''}`}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                onChangeAddress('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : hasCoordinates ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Search className="w-3.5 h-3.5 opacity-40" />
          )}
        </div>
      </div>

      {/* 1-Tap Quick Suggestions Pills */}
      {showQuickPills && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-0.5">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1 font-medium pl-0.5">
            Quick picks:
          </span>
          {quickPillItems.map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() =>
                handleQuickPillClick({
                  id: pill.label,
                  displayName: pill.query,
                  primaryTitle: pill.label,
                  subtitle: pill.query,
                  latitude: pill.lat,
                  longitude: pill.lng,
                })
              }
              className="text-[10px] px-2 py-0.5 rounded-lg border border-border/80 bg-muted/30 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap font-medium text-foreground"
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {/* Verified Coordinates & Matched Area Pill */}
      {hasCoordinates && (
        <div className="flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
          <div className="flex items-center gap-1.5 font-medium">
            <Compass size={12} className="text-emerald-600" />
            <span>
              {resolvedAreaName ? `Matched to ${resolvedAreaName}` : 'GPS Location Locked'}
            </span>
          </div>
          <span className="font-mono text-[9px] opacity-80">
            {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-[11px] text-destructive flex items-center gap-1 font-medium">
          {error}
        </p>
      )}

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-border/40 max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Suggested Locations ({suggestions.length})</span>
            <span className="text-[9px] lowercase font-normal">Click or press enter</span>
          </div>

          {suggestions.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={item.id || idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(item);
                }}
                className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 group ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-primary/5'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {item.primaryTitle}
                    </p>
                    {getCategoryBadge(item.category)}
                  </div>
                  {item.subtitle && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {item.subtitle}
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
