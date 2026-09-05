import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Loader2,
  CheckCircle2,
  Crosshair,
  Compass,
  AlertCircle,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { reverseGeocode, useLocationDetector } from '../hooks/useLocationDetector';

interface LocationPickerMapProps {
  latitude: number | null;
  longitude: number | null;
  address?: string;
  mode: 'pickup' | 'dropoff';
  onLocationSelect: (data: { latitude: number; longitude: number; address?: string }) => void;
  isCompulsory?: boolean;
}

export function LocationPickerMap({
  latitude,
  longitude,
  address,
  mode,
  onLocationSelect,
  isCompulsory = true,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const pulseCircleRef = useRef<L.CircleMarker | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const { detectLocation, isDetecting } = useLocationDetector();

  const isPickup = mode === 'pickup';
  const hasCoordinates = typeof latitude === 'number' && typeof longitude === 'number';

  // Create custom marker icon
  const createMarkerIcon = useCallback(() => {
    if (isPickup) {
      return L.divIcon({
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full cursor-grab active:cursor-grabbing">
            <span class="absolute w-12 h-12 rounded-full bg-emerald-500/20 animate-ping"></span>
            <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white text-base font-bold transform transition-transform hover:scale-110">
              🟢
            </div>
            <div class="absolute -bottom-6 px-2 py-0.5 rounded-full bg-emerald-950/90 text-[10px] text-white font-bold whitespace-nowrap shadow-md border border-emerald-500/30 flex items-center gap-1">
              <span>Pickup Point</span>
            </div>
          </div>
        `,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [0, 0],
      });
    }

    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full cursor-grab active:cursor-grabbing">
          <span class="absolute w-12 h-12 rounded-full bg-blue-500/20 animate-ping"></span>
          <div class="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl border-2 border-white text-base font-bold transform transition-transform hover:scale-110">
            🏁
          </div>
          <div class="absolute -bottom-6 px-2 py-0.5 rounded-full bg-blue-950/90 text-[10px] text-white font-bold whitespace-nowrap shadow-md border border-blue-500/30 flex items-center gap-1">
            <span>Drop-off Point</span>
          </div>
        </div>
      `,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [0, 0],
    });
  }, [isPickup]);

  // Handle position change & reverse geocoding
  const handlePositionChange = useCallback(
    async (lat: number, lng: number) => {
      setIsResolvingAddress(true);
      try {
        const res = await reverseGeocode(lat, lng);
        onLocationSelect({
          latitude: lat,
          longitude: lng,
          address: res.address,
        });
      } catch {
        onLocationSelect({
          latitude: lat,
          longitude: lng,
        });
      } finally {
        setIsResolvingAddress(false);
      }
    },
    [onLocationSelect]
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstance.current) return;

    // Default center: coordinates if available, otherwise Abuja central (9.0765, 7.3986)
    const initialCenter: [number, number] = hasCoordinates
      ? [latitude as number, longitude as number]
      : [9.0765, 7.3986];

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(initialCenter, hasCoordinates ? 16 : 12);

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY;
    const tileUrl = cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Map click handler to place / reposition marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      handlePositionChange(lat, lng);
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update Marker when latitude/longitude changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (hasCoordinates) {
      const latLng: [number, number] = [latitude as number, longitude as number];

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng(latLng);
      } else {
        const marker = L.marker(latLng, {
          icon: createMarkerIcon(),
          draggable: true,
          autoPan: true,
        }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          handlePositionChange(pos.lat, pos.lng);
        });

        markerRef.current = marker;
      }

      // Add soft accuracy circle
      if (pulseCircleRef.current) {
        pulseCircleRef.current.setLatLng(latLng);
      } else {
        pulseCircleRef.current = L.circleMarker(latLng, {
          radius: 18,
          fillColor: isPickup ? '#10b981' : '#2563eb',
          fillOpacity: 0.15,
          color: isPickup ? '#059669' : '#1d4ed8',
          weight: 1.5,
        }).addTo(map);
      }

      map.panTo(latLng, { animate: true, duration: 0.6 });
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (pulseCircleRef.current) {
        pulseCircleRef.current.remove();
        pulseCircleRef.current = null;
      }
    }
  }, [latitude, longitude, hasCoordinates, isPickup, createMarkerIcon, handlePositionChange]);

  // Quick GPS detection trigger
  const handleDetectGPS = async () => {
    const res = await detectLocation();
    if (res) {
      onLocationSelect({
        latitude: res.latitude,
        longitude: res.longitude,
        address: res.address,
      });

      if (mapInstance.current) {
        mapInstance.current.setView([res.latitude, res.longitude], 16, { animate: true });
      }
    }
  };

  // Recenter map on current marker
  const handleRecenter = () => {
    if (hasCoordinates && mapInstance.current) {
      mapInstance.current.setView([latitude as number, longitude as number], 16, {
        animate: true,
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden border border-border/80 shadow-md bg-muted/20">
        {/* Top Floating Map Controls */}
        <div className="absolute top-2.5 left-2.5 right-12 z-[400] flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5">
            {hasCoordinates ? (
              <Badge className="bg-emerald-600/90 hover:bg-emerald-600 text-white text-[10px] font-bold shadow-md backdrop-blur-md px-2.5 py-1 flex items-center gap-1 border border-emerald-400/40">
                <CheckCircle2 className="w-3 h-3" />
                <span>Live GPS Verified</span>
              </Badge>
            ) : (
              <Badge className="bg-amber-600/90 text-white text-[10px] font-bold shadow-md backdrop-blur-md px-2.5 py-1 flex items-center gap-1 border border-amber-400/40">
                <AlertCircle className="w-3 h-3" />
                <span>{isCompulsory ? 'Location Required' : 'Select on map'}</span>
              </Badge>
            )}

            {isResolvingAddress && (
              <Badge className="bg-black/70 text-white text-[10px] backdrop-blur shadow px-2 py-0.5 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />
                <span>Updating address...</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Live Map Canvas */}
        <div
          ref={mapContainerRef}
          className="w-full h-[240px] sm:h-[280px] z-0 focus:outline-none"
        />

        {/* Bottom Floating Action Bar */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto bg-background/95 backdrop-blur-md px-2.5 py-1 rounded-xl border shadow-sm text-[11px] text-muted-foreground flex items-center gap-1">
            <Crosshair className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate max-w-[200px] sm:max-w-xs font-medium">
              Tap or drag pin to adjust
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {hasCoordinates && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRecenter}
                title="Recenter Pin"
                className="h-8 w-8 p-0 rounded-xl bg-background/95 backdrop-blur-md shadow-sm border text-foreground hover:bg-muted"
              >
                <Compass className="w-3.5 h-3.5 text-primary" />
              </Button>
            )}

            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isDetecting}
              onClick={handleDetectGPS}
              className="h-8 px-2.5 rounded-xl text-xs font-bold shadow-md bg-primary hover:bg-primary/95 text-white gap-1.5 transition-all active:scale-95"
            >
              {isDetecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>{isDetecting ? 'Detecting...' : 'Detect GPS'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Coordinate Display & Accuracy pill */}
      {hasCoordinates && (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-600" />
            <span>
              Coordinates: <strong className="text-foreground">{latitude?.toFixed(5)}, {longitude?.toFixed(5)}</strong>
            </span>
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            Accurate GPS
          </span>
        </div>
      )}
    </div>
  );
}
