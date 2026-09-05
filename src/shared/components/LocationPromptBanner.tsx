import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { reverseGeocode } from '@/features/send/hooks/useLocationDetector';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function LocationPromptBanner() {
  const { user, profile, refreshProfile } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice or already has location stored
    const prompted = localStorage.getItem('linkup_location_prompted');
    const storedLocation = localStorage.getItem('linkup_user_location');
    const hasProfileCoords = profile?.latitude && profile?.longitude;

    if (prompted || storedLocation || hasProfileCoords) {
      return;
    }

    // Check browser permission status if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        if (result.state === 'granted') {
          // Already granted: automatically fetch coordinates quietly
          fetchAndSaveLocation(false);
        } else if (result.state === 'prompt') {
          // Show polite prompt after 2.5 seconds
          const timer = setTimeout(() => setIsVisible(true), 2500);
          return () => clearTimeout(timer);
        }
      }).catch(() => {
        const timer = setTimeout(() => setIsVisible(true), 2500);
        return () => clearTimeout(timer);
      });
    } else {
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const fetchAndSaveLocation = async (showFeedback = true) => {
    if (!navigator.geolocation) {
      if (showFeedback) toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetecting(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Reverse geocode to resolve city & neighborhood
          const geo = await reverseGeocode(lat, lng);
          const locationData = {
            latitude: lat,
            longitude: lng,
            address: geo.address,
            city: geo.city,
            state: geo.state,
            timestamp: Date.now(),
          };

          localStorage.setItem('linkup_user_location', JSON.stringify(locationData));
          localStorage.setItem('linkup_location_prompted', 'true');

          // If logged in, update profile
          if (user) {
            try {
              await supabase
                .from('profiles')
                .update({
                  latitude: lat,
                  longitude: lng,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', user.id);
              refreshProfile();
            } catch (dbErr) {
              console.warn('Profile location update error:', dbErr);
            }
          }

          setIsVisible(false);
          if (showFeedback) {
            toast.success(`Location set to ${geo.city || 'your area'}!`, {
              description: 'You will now see accurate delivery fees and nearby vendors.',
            });
          }
        } catch (err) {
          console.warn('Error saving location:', err);
        } finally {
          setIsDetecting(false);
        }
      },
      (err) => {
        setIsDetecting(false);
        localStorage.setItem('linkup_location_prompted', 'true');
        setIsVisible(false);
        if (showFeedback) {
          if (err.code === err.PERMISSION_DENIED) {
            toast.info('Location access was not enabled. You can enable it anytime from your profile dropdown.');
          } else {
            toast.error('Location detection timed out.');
          }
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handleDismiss = () => {
    localStorage.setItem('linkup_location_prompted', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[9999]"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-4 text-card-foreground relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            {/* Top glowing accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-orange-400 to-amber-500" />

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-primary/20">
                <MapPin className="w-5 h-5 animate-pulse" />
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold font-heading text-foreground">
                    Enable Location Access
                  </h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Allow LinkUp to detect your location for accurate delivery fares, nearby vendors, and live parcel tracking.
                </p>

                <div className="flex items-center gap-2 mt-3.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isDetecting}
                    onClick={() => fetchAndSaveLocation(true)}
                    className="h-8.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md gap-1.5 transition-all active:scale-95"
                  >
                    {isDetecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Detecting...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Allow Location</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDetecting}
                    onClick={handleDismiss}
                    className="h-8.5 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    Not Now
                  </Button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
