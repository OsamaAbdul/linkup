import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface GeoPosition {
  latitude: number;
  longitude: number;
}

export function useGeolocation() {
  const { user, profile, refreshProfile } = useAuth();
  const [position, setPosition] = useState<GeoPosition | null>(
    profile?.latitude && profile?.longitude
      ? { latitude: profile.latitude, longitude: profile.longitude }
      : null
  );

  useEffect(() => {
    if (profile?.latitude && profile?.longitude) {
      setPosition({ latitude: profile.latitude, longitude: profile.longitude });
      return;
    }

    if (!user || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setPosition(coords);
        await supabase
          .from("profiles")
          .update({ latitude: coords.latitude, longitude: coords.longitude })
          .eq("user_id", user.id);
        refreshProfile();
      },
      () => { } // silently fail
    );
  }, [user, profile]);

  return position;
}
