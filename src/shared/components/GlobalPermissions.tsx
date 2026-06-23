import { useEffect, useState } from "react";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { useAuth } from "@/features/auth/context/AuthContext";

export function GlobalPermissions() {
  const { user } = useAuth();
  const { isSupported, permission, subscribe } = usePushNotifications();
  const { position, loading, error, refresh } = useGeolocation();
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    if (hasPrompted || !user) return;
    
    const requestPermissions = async () => {
      // 1. Request notifications if supported and not yet decided
      if (isSupported && permission === 'default') {
        try {
           await subscribe();
        } catch (e) {
           console.error("Auto-subscribe notification error:", e);
        }
      }

      // 2. Request location if not already available or previously denied
      // (useGeolocation already tries this, but calling refresh ensures it triggers the prompt if needed)
      if (!position && !error && !loading) {
         try {
           refresh();
         } catch(e) {
           console.error("Auto-location error:", e);
         }
      }
      
      setHasPrompted(true);
    };

    // Delay by a few seconds to let the user see the page first before bombarding them
    const timer = setTimeout(() => {
      requestPermissions();
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasPrompted, user, isSupported, permission, position, error, loading, subscribe, refresh]);

  return null;
}
