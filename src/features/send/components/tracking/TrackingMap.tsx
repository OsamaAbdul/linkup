import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/shared/components/ui/card';

interface TrackingMapProps {
  pickupCoords?: { lat: number; lng: number } | null;
  dropoffCoords?: { lat: number; lng: number } | null;
  riderCoords?: { lat: number; lng: number } | null;
  status: string;
}

export function TrackingMap({
  pickupCoords,
  dropoffCoords,
  riderCoords,
  status,
}: TrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const pickupMarker = useRef<L.Marker | null>(null);
  const dropoffMarker = useRef<L.Marker | null>(null);
  const riderMarker = useRef<L.Marker | null>(null);
  const routePolyline = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstance.current) return;

    const initialCenter = pickupCoords
      ? [pickupCoords.lat, pickupCoords.lng]
      : [9.0765, 7.3986]; // Abuja default fallback

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(initialCenter as [number, number], 13);

    const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY;
    const tileUrl = cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    // High quality modern map tiles (Carto Voyager with API key authentication)
    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">
            🟢
          </div>
          <span class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-bold whitespace-nowrap shadow">
            Pickup
          </span>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Dropoff Icon
    const dropoffIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">
            🏁
          </div>
          <span class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-bold whitespace-nowrap shadow">
            Drop-off
          </span>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Live Rider Icon
    const riderIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-10 h-10 rounded-full bg-primary/30 animate-ping"></span>
          <div class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-xl border-2 border-white text-base">
            🏍️
          </div>
          <span class="absolute -bottom-5 px-1.5 py-0.5 rounded bg-primary text-[10px] text-white font-bold whitespace-nowrap shadow">
            Rider Live
          </span>
        </div>
      `,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const boundsPoints: L.LatLngExpression[] = [];

    // Update Pickup Marker
    if (pickupCoords) {
      const latLng: [number, number] = [pickupCoords.lat, pickupCoords.lng];
      boundsPoints.push(latLng);
      if (pickupMarker.current) {
        pickupMarker.current.setLatLng(latLng);
      } else {
        pickupMarker.current = L.marker(latLng, { icon: pickupIcon }).addTo(map);
      }
    }

    // Update Drop-off Marker
    if (dropoffCoords) {
      const latLng: [number, number] = [dropoffCoords.lat, dropoffCoords.lng];
      boundsPoints.push(latLng);
      if (dropoffMarker.current) {
        dropoffMarker.current.setLatLng(latLng);
      } else {
        dropoffMarker.current = L.marker(latLng, { icon: dropoffIcon }).addTo(map);
      }
    }

    // Update Rider Marker
    if (riderCoords) {
      const latLng: [number, number] = [riderCoords.lat, riderCoords.lng];
      boundsPoints.push(latLng);
      if (riderMarker.current) {
        riderMarker.current.setLatLng(latLng);
      } else {
        riderMarker.current = L.marker(latLng, { icon: riderIcon }).addTo(map);
      }
    }

    // Draw / Update Connecting Route Polyline
    if (pickupCoords && dropoffCoords) {
      const lineCoords: [number, number][] = [
        [pickupCoords.lat, pickupCoords.lng],
      ];

      if (riderCoords && status === 'on_the_way') {
        lineCoords.push([riderCoords.lat, riderCoords.lng]);
      }

      lineCoords.push([dropoffCoords.lat, dropoffCoords.lng]);

      if (routePolyline.current) {
        routePolyline.current.setLatLngs(lineCoords);
      } else {
        routePolyline.current = L.polyline(lineCoords, {
          color: '#f97316', // LinkUp primary orange
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }).addTo(map);
      }
    }

    // Fit Bounds so all points are visible comfortably
    if (boundsPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(boundsPoints), {
        padding: [50, 50],
        maxZoom: 15,
        animate: true,
      });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    }
  }, [pickupCoords, dropoffCoords, riderCoords, status]);

  return (
    <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-md relative bg-card">
      <div ref={mapContainerRef} className="w-full h-[320px] sm:h-[400px] z-0" />
      <div className="absolute top-3 right-3 z-10 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border shadow-sm text-xs font-bold flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="capitalize">{status.replace('_', ' ')}</span>
      </div>
    </Card>
  );
}
