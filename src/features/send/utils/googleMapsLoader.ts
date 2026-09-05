/**
 * Google Maps Dynamic Loader & Helper
 * Seamlessly loads Google Maps Platform JS SDK if VITE_GOOGLE_MAPS_API_KEY is configured.
 */

let loadPromise: Promise<boolean> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || (window as any).__LINKUP_GOOGLE_MAPS_API_KEY;
}

export function isGoogleMapsLoaded(): boolean {
  return Boolean(typeof window !== 'undefined' && (window as any).google?.maps?.places);
}

/**
 * Loads Google Maps JavaScript SDK with Places, Geometry & Routes libraries
 */
export async function loadGoogleMaps(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isGoogleMapsLoaded()) return true;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return false;
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve(true);
    };

    script.onerror = (err) => {
      console.warn('Google Maps SDK failed to load. Falling back to OpenStreetMap / OSRM.', err);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface GooglePlaceSuggestion {
  displayName: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

/**
 * Queries Google Places Autocomplete restricted to Nigeria
 */
export async function searchGooglePlaces(query: string): Promise<GooglePlaceSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  const isLoaded = await loadGoogleMaps();
  if (!isLoaded || !(window as any).google?.maps?.places) return [];

  return new Promise((resolve) => {
    try {
      const autocompleteService = new (window as any).google.maps.places.AutocompleteService();
      autocompleteService.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'ng' }, // Strictly Nigeria
        },
        (predictions: any[], status: any) => {
          if (
            status === (window as any).google.maps.places.PlacesServiceStatus.OK &&
            predictions &&
            predictions.length > 0
          ) {
            resolve(
              predictions.map((p) => ({
                displayName: p.description,
                placeId: p.place_id,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || '',
              }))
            );
          } else {
            resolve([]);
          }
        }
      );
    } catch (err) {
      console.warn('Google Places prediction error:', err);
      resolve([]);
    }
  });
}

/**
 * Resolves a Google Place ID into exact latitude & longitude coordinates
 */
export async function getGooglePlaceDetails(
  placeId: string
): Promise<{ address: string; latitude: number; longitude: number } | null> {
  const isLoaded = await loadGoogleMaps();
  if (!isLoaded || !(window as any).google?.maps?.places) return null;

  return new Promise((resolve) => {
    try {
      const dummyDiv = document.createElement('div');
      const placesService = new (window as any).google.maps.places.PlacesService(dummyDiv);

      placesService.getDetails(
        {
          placeId,
          fields: ['formatted_address', 'geometry', 'name'],
        },
        (place: any, status: any) => {
          if (
            status === (window as any).google.maps.places.PlacesServiceStatus.OK &&
            place?.geometry?.location
          ) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const address = place.formatted_address || place.name || '';
            resolve({
              address,
              latitude: typeof lat === 'function' ? lat() : lat,
              longitude: typeof lng === 'function' ? lng() : lng,
            });
          } else {
            resolve(null);
          }
        }
      );
    } catch (err) {
      console.warn('Google Place details error:', err);
      resolve(null);
    }
  });
}

/**
 * Calculates road route using Google Maps Directions Service
 */
export async function getGoogleDirectionsRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{
  distanceKm: number;
  durationMinutes: number;
  estimatedMinutesRange: string;
  coordinates: [number, number][];
} | null> {
  const isLoaded = await loadGoogleMaps();
  if (!isLoaded || !(window as any).google?.maps) return null;

  return new Promise((resolve) => {
    try {
      const directionsService = new (window as any).google.maps.DirectionsService();

      directionsService.route(
        {
          origin: new (window as any).google.maps.LatLng(origin.lat, origin.lng),
          destination: new (window as any).google.maps.LatLng(destination.lat, destination.lng),
          travelMode: (window as any).google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: 'bestguess',
          },
        },
        (result: any, status: any) => {
          if (status === 'OK' && result?.routes?.[0]?.legs?.[0]) {
            const leg = result.routes[0].legs[0];
            const distanceMeters = leg.distance?.value || 5000;
            const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 900;

            const distanceKm = Math.max(1.0, Math.round((distanceMeters / 1000) * 10) / 10);
            const baseMinutes = Math.round(durationSeconds / 60);
            const minMins = Math.max(15, baseMinutes + 5);
            const maxMins = minMins + 20;

            // Extract polyline path coordinates
            const coordinates: [number, number][] = [];
            const steps = leg.steps || [];
            steps.forEach((step: any) => {
              const path = step.path || [];
              path.forEach((pt: any) => {
                const lat = typeof pt.lat === 'function' ? pt.lat() : pt.lat;
                const lng = typeof pt.lng === 'function' ? pt.lng() : pt.lng;
                coordinates.push([lat, lng]);
              });
            });

            resolve({
              distanceKm,
              durationMinutes: baseMinutes,
              estimatedMinutesRange: `${minMins} - ${maxMins} mins`,
              coordinates: coordinates.length > 0 ? coordinates : [[origin.lat, origin.lng], [destination.lat, destination.lng]],
            });
          } else {
            resolve(null);
          }
        }
      );
    } catch (err) {
      console.warn('Google Directions error:', err);
      resolve(null);
    }
  });
}
