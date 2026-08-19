import { useEffect, useState } from "react";
import { useGeolocation } from "@/features/logistics/hooks/useGeolocation";
import { useAuth } from "@/features/auth/context/AuthContext";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import React from "react";

export function GlobalPermissions() {
  const { user } = useAuth();
  const { position, loading, error, refresh } = useGeolocation();
  const { isSupported, permission, subscribe } = usePushNotifications();
  const [hasPrompted, setHasPrompted] = useState(false);

  useEffect(() => {
    if (hasPrompted || !user) return;
    
    const requestPermissions = async () => {
      // Request location if not already available or previously denied
      if (!position && !error && !loading) {
         try {
           refresh();
         } catch(e) {
           console.error("Auto-location error:", e);
         }
      }
      
      // Prompt for Push Notifications if they haven't decided yet
      if (isSupported && permission === "default") {
        toast("Enable Push Notifications", {
          description: "Get real-time alerts for new orders and missions.",
          icon: React.createElement(BellRing, { className: "w-4 h-4 text-blue-500" }),
          duration: 15000,
          action: {
            label: "Enable",
            onClick: () => {
              subscribe();
            },
          },
        });
      }
      
      setHasPrompted(true);
    };

    // Delay by a few seconds to let the user see the page first before bombarding them
    const timer = setTimeout(() => {
      requestPermissions();
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasPrompted, user, position, error, loading, refresh, isSupported, permission, subscribe]);

  return null;
}
