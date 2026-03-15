import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LiveTrackingMapProps {
  riderCoords: { lat: number; lng: number } | null;
  buyerCoords: { lat: number; lng: number } | null;
}

export function LiveTrackingMap({ riderCoords, buyerCoords }: LiveTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const riderMarker = useRef<L.Marker | null>(null);
  const buyerMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const center = riderCoords
      ? [riderCoords.lat, riderCoords.lng]
      : [9.06, 7.49];

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center as [number, number], 15);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
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

    const riderIcon = L.divIcon({
      html: `<div style="font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🏍️</div>`,
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const buyerIcon = L.divIcon({
      html: `<div style="font-size:20px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">📍</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    if (riderCoords) {
      if (riderMarker.current) {
        riderMarker.current.setLatLng([riderCoords.lat, riderCoords.lng]);
      } else {
        riderMarker.current = L.marker([riderCoords.lat, riderCoords.lng], { icon: riderIcon }).addTo(map);
      }
    }

    if (buyerCoords) {
      if (buyerMarker.current) {
        buyerMarker.current.setLatLng([buyerCoords.lat, buyerCoords.lng]);
      } else {
        buyerMarker.current = L.marker([buyerCoords.lat, buyerCoords.lng], { icon: buyerIcon }).addTo(map);
      }
    }

    const bounds: L.LatLngExpression[] = [];
    if (riderCoords) bounds.push([riderCoords.lat, riderCoords.lng]);
    if (buyerCoords) bounds.push([buyerCoords.lat, buyerCoords.lng]);

    if (bounds.length === 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [riderCoords, buyerCoords]);

  return (
    <div
      ref={mapRef}
      className="w-full h-[200px] rounded-2xl overflow-hidden border border-border/50"
    />
  );
}
