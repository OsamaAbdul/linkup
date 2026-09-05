import { useState } from 'react';
import { toast } from 'sonner';

export interface DetectedLocation {
  address: string;
  latitude: number;
  longitude: number;
  city?: string;
}

export function useLocationDetector() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectLocation = async (): Promise<DetectedLocation | null> => {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      setError(msg);
      toast.error(msg);
      return null;
    }

    setIsDetecting(true);
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
              {
                headers: {
                  'Accept-Language': 'en',
                },
              }
            );

            if (!res.ok) throw new Error('Reverse geocoding failed');
            const data = await res.json();
            const displayName = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.suburb ||
              data.address?.state ||
              '';

            toast.success('Location detected successfully');
            resolve({
              address: displayName,
              latitude,
              longitude,
              city,
            });
          } catch (err: any) {
            console.error('Reverse geocode error:', err);
            toast.error("Detected GPS coords, but couldn't resolve address text. Please verify address.");
            resolve({
              address: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          } finally {
            setIsDetecting(false);
          }
        },
        (err) => {
          setIsDetecting(false);
          let msg = 'Could not detect your location';
          if (err.code === err.PERMISSION_DENIED) {
            msg = 'Location permission was denied. Please allow location access or type manually.';
          } else if (err.code === err.TIMEOUT) {
            msg = 'Location detection timed out. Please enter manually.';
          }
          setError(msg);
          toast.error(msg);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  };

  return { detectLocation, isDetecting, error };
}

export interface GeocodeResult {
  displayName: string;
  latitude: number;
  longitude: number;
  city?: string;
  suburb?: string;
  state?: string;
}

/**
 * Infers approximate city name from Nigerian coordinates when network is offline
 */
function inferNigerianCityFromCoords(lat: number, lng: number): string {
  // Abuja: ~9.0765, 7.3986
  if (lat >= 8.8 && lat <= 9.3 && lng >= 7.1 && lng <= 7.6) return 'Abuja';
  // Lagos: ~6.5244, 3.3792
  if (lat >= 6.3 && lat <= 6.7 && lng >= 3.1 && lng <= 3.6) return 'Lagos';
  // Port Harcourt: ~4.8156, 7.0498
  if (lat >= 4.6 && lat <= 5.1 && lng >= 6.8 && lng <= 7.3) return 'Port Harcourt';
  // Ibadan: ~7.3775, 3.9470
  if (lat >= 7.2 && lat <= 7.6 && lng >= 3.7 && lng <= 4.2) return 'Ibadan';
  // Kano: ~12.0022, 8.5920
  if (lat >= 11.8 && lat <= 12.2 && lng >= 8.4 && lng <= 8.8) return 'Kano';
  // Enugu: ~6.4584, 7.5464
  if (lat >= 6.3 && lat <= 6.7 && lng >= 7.3 && lng <= 7.8) return 'Enugu';
  // Kaduna: ~10.5105, 7.4165
  if (lat >= 10.3 && lat <= 10.7 && lng >= 7.2 && lng <= 7.6) return 'Kaduna';
  // Benin City: ~6.3350, 5.6037
  if (lat >= 6.1 && lat <= 6.6 && lng >= 5.4 && lng <= 5.8) return 'Benin City';

  return 'Nigeria';
}

/**
 * Reverse geocodes coordinates (lat, lon) into a clean, human-readable address
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ address: string; city?: string; state?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Reverse geocoding failed');
    const data = await res.json();
    const city =
      data.address?.city ||
      data.address?.town ||
      data.address?.suburb ||
      data.address?.municipality ||
      data.address?.state ||
      inferNigerianCityFromCoords(latitude, longitude);
    const state = data.address?.state || '';
    const displayName = data.display_name || `${city}, Nigeria (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

    return {
      address: displayName,
      city,
      state,
    };
  } catch (err) {
    const fallbackCity = inferNigerianCityFromCoords(latitude, longitude);
    return {
      address: `${fallbackCity}, Nigeria (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      city: fallbackCity,
      state: fallbackCity,
    };
  }
}

/**
 * Searches Nominatim OpenStreetMap for location matches across Nigeria
 */
export async function searchNigerianAddresses(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&countrycodes=ng&addressdetails=1&limit=6`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();

    return (data || []).map((item: any) => ({
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      city: item.address?.city || item.address?.town || item.address?.municipality || '',
      suburb: item.address?.suburb || item.address?.neighbourhood || item.address?.residential || '',
      state: item.address?.state || '',
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Forward geocodes a single text address query into latitude & longitude
 */
export async function forwardGeocode(query: string): Promise<GeocodeResult | null> {
  const results = await searchNigerianAddresses(query);
  return results.length > 0 ? results[0] : null;
}


