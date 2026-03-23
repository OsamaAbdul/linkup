import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/context/AuthContext";

export function useRiderLocation(isEnabled: boolean) {
    const { user } = useAuth();

    useEffect(() => {
        if (!user || !isEnabled || !navigator.geolocation) return;

        console.log("Starting high-accuracy mission tracking...");

        const watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // Sync coordinates to profile for real-time buyer tracking
                const { error } = await supabase
                    .from("profiles")
                    .update({
                        latitude,
                        longitude,
                        updated_at: new Date().toISOString()
                    })
                    .eq("user_id", user.id);

                if (error) console.error("Coordinates telemetry error:", error);
            },
            (err) => console.error("GPS Signal Offline:", err),
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000
            }
        );

        return () => {
            console.log("Ceasing mission tracking.");
            navigator.geolocation.clearWatch(watchId);
        };
    }, [user, isEnabled]);
}
