import { useQuery } from '@tanstack/react-query';
import { calculateHaversineDistance } from './useSendPricing';
import { getGoogleDirectionsRoute } from '../utils/googleMapsLoader';

export interface RoadRouteResult {
  distanceKm: number;
  durationMinutes: number;
  estimatedMinutesRange: string;
  coordinates: [number, number][]; // Leaflet lat,lng array
  isRoadMatched: boolean;
  engine?: 'google' | 'osrm' | 'haversine';
}

/**
 * Calculates the real road driving route, true distance in KM, realistic ETA,
 * and turn-by-turn road polyline using Google Directions (if available) or OSRM.
 */
export async function fetchRoadRoute(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): Promise<RoadRouteResult> {
  // If points are identical
  if (pickupLat === dropoffLat && pickupLng === dropoffLng) {
    return {
      distanceKm: 1.0,
      durationMinutes: 15,
      estimatedMinutesRange: '15 - 25 mins',
      coordinates: [[pickupLat, pickupLng]],
      isRoadMatched: true,
      engine: 'osrm',
    };
  }

  // 1. Try Google Directions Service if Google Maps is available
  try {
    const googleRoute = await getGoogleDirectionsRoute(
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng }
    );
    if (googleRoute && googleRoute.distanceKm > 0) {
      return {
        ...googleRoute,
        isRoadMatched: true,
        engine: 'google',
      };
    }
  } catch (gErr) {
    console.warn('Google Directions failed, using OSRM fallback:', gErr);
  }

  // 2. Try OSRM (Open Source Routing Machine)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout


    // OSRM expects coordinates in lng,lat order
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`OSRM routing failed: ${res.statusText}`);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distance;
      const durationSeconds = primaryRoute.duration;

      // Exact road distance in KM rounded to 1 decimal place
      const distanceKm = Math.max(1.0, Math.round((distanceMeters / 1000) * 10) / 10);
      
      // Duration in minutes (add 10-15 mins for Nigerian urban traffic buffers & pickup time)
      const baseMinutes = Math.round(durationSeconds / 60);
      const minMins = Math.max(15, baseMinutes + 5);
      const maxMins = minMins + 20;

      // GeoJSON coordinates are [lng, lat] -> convert to Leaflet [lat, lng]
      const coordinates: [number, number][] = (primaryRoute.geometry.coordinates || []).map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      return {
        distanceKm,
        durationMinutes: baseMinutes,
        estimatedMinutesRange: `${minMins} - ${maxMins} mins`,
        coordinates: coordinates.length > 0 ? coordinates : [[pickupLat, pickupLng], [dropoffLat, dropoffLng]],
        isRoadMatched: true,
      };
    }

    throw new Error('No valid road route found');
  } catch (err) {
    console.warn('Road routing engine fallback to haversine calculation:', err);

    // Fallback: Haversine distance with 1.25x road tortuosity factor for real-world road networks
    const rawHaversine = calculateHaversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const roadEstimatedKm = Math.max(1.0, Math.round(rawHaversine * 1.25 * 10) / 10);
    const minMins = Math.round(15 + roadEstimatedKm * 2.5);
    const maxMins = minMins + 20;

    return {
      distanceKm: roadEstimatedKm,
      durationMinutes: Math.round(roadEstimatedKm * 3),
      estimatedMinutesRange: `${minMins} - ${maxMins} mins`,
      coordinates: [
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
      ],
      isRoadMatched: false,
    };
  }
}

/**
 * React Query hook for fetching and caching real road routes
 */
export function useRoadRoute(
  pickupLat?: number | null,
  pickupLng?: number | null,
  dropoffLat?: number | null,
  dropoffLng?: number | null
) {
  const hasBothCoords =
    typeof pickupLat === 'number' &&
    typeof pickupLng === 'number' &&
    typeof dropoffLat === 'number' &&
    typeof dropoffLng === 'number';

  return useQuery({
    queryKey: ['road_route', pickupLat, pickupLng, dropoffLat, dropoffLng],
    queryFn: () => fetchRoadRoute(pickupLat!, pickupLng!, dropoffLat!, dropoffLng!),
    enabled: hasBothCoords,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
    retry: 1,
  });
}
