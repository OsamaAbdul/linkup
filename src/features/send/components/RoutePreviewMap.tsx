import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, Route, CheckCircle2 } from 'lucide-react';
import { useRoadRoute } from '../hooks/useRoadRoute';

interface RoutePreviewMapProps {
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  distanceKm?: number;
  estimatedMinutes?: string;
  className?: string;
}

export function RoutePreviewMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  distanceKm,
  estimatedMinutes,
  className = '',
}: RoutePreviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const pickupMarker = useRef<L.Marker | null>(null);
  const dropoffMarker = useRef<L.Marker | null>(null);
  const routePolyline = useRef<L.Polyline | null>(null);
  const glowPolyline = useRef<L.Polyline | null>(null);

  // Fetch real road route geometry & metrics from OSRM
  const { data: roadData } = useRoadRoute(pickupLat, pickupLng, dropoffLat, dropoffLng);

  const finalDistanceKm = typeof distanceKm === 'number' ? distanceKm : roadData?.distanceKm || 5.0;
  const finalEta = estimatedMinutes || roadData?.estimatedMinutesRange || '15 - 35 mins';

  useEffect(() => {
    if (!mapContainerRef.current || mapInstance.current) return;

    const initialCenter: [number, number] =
      pickupLat && pickupLng ? [pickupLat, pickupLng] : [9.0765, 7.3986];

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    }).setView(initialCenter, 13);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY;
    const tileUrl = cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Pickup Icon
    const pickupIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full">
          <div class="w-8 h-8 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">
            🟢
          </div>
          <span class="absolute -bottom-5 px-1.5 py-0.5 rounded-full bg-emerald-950/90 text-[9px] text-white font-bold whitespace-nowrap shadow border border-emerald-500/30">
            Pickup
          </span>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [0, 0],
    });

    // Dropoff Icon
    const dropoffIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-full">
          <div class="w-8 h-8 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">
            🏁
          </div>
          <span class="absolute -bottom-5 px-1.5 py-0.5 rounded-full bg-blue-950/90 text-[9px] text-white font-bold whitespace-nowrap shadow border border-blue-500/30">
            Drop-off
          </span>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [0, 0],
    });

    const boundsPoints: L.LatLngExpression[] = [];

    // Pickup Marker
    if (pickupLat && pickupLng) {
      const latLng: [number, number] = [pickupLat, pickupLng];
      boundsPoints.push(latLng);
      if (pickupMarker.current) {
        pickupMarker.current.setLatLng(latLng);
      } else {
        pickupMarker.current = L.marker(latLng, { icon: pickupIcon }).addTo(map);
      }
    }

    // Dropoff Marker
    if (dropoffLat && dropoffLng) {
      const latLng: [number, number] = [dropoffLat, dropoffLng];
      boundsPoints.push(latLng);
      if (dropoffMarker.current) {
        dropoffMarker.current.setLatLng(latLng);
      } else {
        dropoffMarker.current = L.marker(latLng, { icon: dropoffIcon }).addTo(map);
      }
    }

    // Street Road Polyline
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      const routePoints: [number, number][] =
        roadData?.coordinates && roadData.coordinates.length > 0
          ? roadData.coordinates
          : [
              [pickupLat, pickupLng],
              [dropoffLat, dropoffLng],
            ];

      // Outer glow polyline
      if (glowPolyline.current) {
        glowPolyline.current.setLatLngs(routePoints);
      } else {
        glowPolyline.current = L.polyline(routePoints, {
          color: '#ea580c',
          weight: 7,
          opacity: 0.3,
          lineCap: 'round',
        }).addTo(map);
      }

      // Inner crisp street line
      if (routePolyline.current) {
        routePolyline.current.setLatLngs(routePoints);
      } else {
        routePolyline.current = L.polyline(routePoints, {
          color: '#f97316', // LinkUp primary orange
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
        }).addTo(map);
      }

      routePoints.forEach((pt) => boundsPoints.push(pt));
    }

    // Fit Bounds so the entire street path and markers are framed
    if (boundsPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsPoints), {
        padding: [45, 45],
        maxZoom: 15,
        animate: true,
      });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, roadData]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-border/80 shadow-md bg-muted/20 ${className}`}
    >
      {/* Top Floating Distance & ETA Chip */}
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 pointer-events-none">
        <Badge className="bg-background/95 backdrop-blur-md text-foreground border shadow-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 pointer-events-auto">
          <Route className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-primary font-extrabold font-heading text-sm">
            {finalDistanceKm} km
          </span>
          <span className="text-muted-foreground font-medium">road route</span>
        </Badge>
      </div>

      <div className="absolute top-3 right-12 z-[400] pointer-events-none hidden sm:block">
        <Badge className="bg-emerald-600/95 backdrop-blur-md text-white border-none shadow-md px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 pointer-events-auto">
          <Clock className="w-3 h-3" />
          <span>Est. {finalEta}</span>
        </Badge>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-[200px] sm:h-[240px] z-0 focus:outline-none" />

      {/* Bottom Route Indicator */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border shadow-sm text-[11px] font-medium text-foreground pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Pickup</span>
          </span>
          <span className="text-muted-foreground">➔</span>
          <span className="flex items-center gap-1 text-blue-700">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Drop-off</span>
          </span>
        </div>
        <span className="font-bold text-primary flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>{finalDistanceKm} KM Street Route</span>
        </span>
      </div>
    </div>
  );
}
