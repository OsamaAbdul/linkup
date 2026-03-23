import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";
import { toast } from "sonner";

interface GeoPosition {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

export function useGeolocation() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<GeoPosition | null>(
    profile?.latitude && profile?.longitude
      ? { latitude: profile.latitude, longitude: profile.longitude, timestamp: Date.now() }
      : null
  );

  const getPreciseLocation = useCallback(async (force = false) => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    // If we already have a position and not forcing, don't re-fetch
    if (position && !force) return;

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { 
          latitude: pos.coords.latitude, 
          longitude: pos.coords.longitude,
          timestamp: Date.now()
        };
        
        setPosition(coords);
        setLoading(false);

        if (user) {
          try {
            const { error: updateError } = await supabase
              .from("profiles")
              .update({ 
                latitude: coords.latitude, 
                longitude: coords.longitude,
                updated_at: new Date().toISOString()
              })
              .eq("user_id", user.id);
            
            if (updateError) throw updateError;
            refreshProfile();
          } catch (err: any) {
            console.error("Error updating profile location:", err);
          }
        }
      },
      (err) => {
        setLoading(false);
        let msg = "Could not detect your location";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Location access was denied. Please enable it in your browser settings.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location detection timed out.";
        }
        setError(msg);
        if (force) toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [user, position, refreshProfile]);

  useEffect(() => {
    // Initial detection if profile is missing coordinates
    if (user && !profile?.latitude && !profile?.longitude && !position && !loading && !error) {
      getPreciseLocation();
    }
  }, [user, profile, position, loading, error, getPreciseLocation]);

  return {
    position,
    loading,
    error,
    refresh: () => getPreciseLocation(true)
  };
}
