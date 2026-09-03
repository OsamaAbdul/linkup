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
 * Searches Nominatim OpenStreetMap for location matches across Nigeria
 */
export async function searchNigerianAddresses(query: string): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&countrycodes=ng&addressdetails=1&limit=5`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

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
    console.warn('Address search error:', err);
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
