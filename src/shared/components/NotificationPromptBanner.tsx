import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, CheckCircle2, Loader2, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { usePushNotifications } from '@/shared/hooks/usePushNotifications';
import { useAuth } from '@/features/auth/context/AuthContext';

export function NotificationPromptBanner() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isSubscribing, lastError, subscribe, enableInAppFallback } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  useEffect(() => {
    if (isSubscribed) {
      setIsVisible(false);
      return;
    }

    // Check if snoozed
    const snoozedUntil = localStorage.getItem('linkup_push_snoozed_until');
    if (snoozedUntil && Date.now() < Number(snoozedUntil)) {
      return;
    }

    // Show prompt after brief delay on load
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3500);

    return () => clearTimeout(timer);
  }, [isSubscribed]);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setSuccessAnim(true);
      setTimeout(() => {
        setIsVisible(false);
      }, 1500);
    }
  };

  const handleSnooze = () => {
    // Snooze for 15 minutes
    const snoozeTime = Date.now() + 15 * 60 * 1000;
    localStorage.setItem('linkup_push_snoozed_until', snoozeTime.toString());
    setIsVisible(false);
  };

  const handleInAppFallback = () => {
    enableInAppFallback();
    setSuccessAnim(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 1500);
  };

  if (!isSupported || isSubscribed) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:max-w-md z-[9998]"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-4 text-card-foreground relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            {/* Top glowing accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-primary to-orange-400" />

            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm border transition-colors ${
                successAnim
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                {successAnim ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-in zoom-in" />
                ) : (
                  <BellRing className="w-5 h-5 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold font-heading text-foreground">
                    {successAnim ? 'Notifications Enabled!' : 'Enable Order & Dispatch Alerts'}
                  </h4>
                  {!successAnim && (
                    <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {successAnim
                    ? "You're all set! You'll receive real-time updates for orders, messages, and driver dispatches."
                    : "Stay updated with live driver arrivals, package tracking, and instant customer notifications."}
                </p>

                {/* Inline feedback if last attempt had an issue */}
                {lastError && !successAnim && (
                  <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {lastError === 'push_service_unavailable'
                        ? 'Push service unavailable in browser privacy mode. You can retry or enable in-app alerts.'
                        : lastError === 'denied'
                        ? 'Notifications permission was blocked in browser settings.'
                        : 'Could not connect to push service. Click retry to try again.'}
                    </span>
                  </div>
                )}

                {!successAnim && (
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    {lastError === 'push_service_unavailable' ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleInAppFallback}
                          className="h-8.5 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-1.5 transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Use In-App Alerts</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isSubscribing}
                          onClick={handleEnable}
                          className="h-8.5 px-3 rounded-xl text-xs font-semibold gap-1.5"
                        >
                          {isSubscribing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>Retry Push</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSubscribing}
                        onClick={handleEnable}
                        className="h-8.5 px-4 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md gap-1.5 transition-all active:scale-95"
                      >
                        {isSubscribing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : lastError ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry Enable</span>
                          </>
                        ) : (
                          <>
                            <BellRing className="w-3.5 h-3.5" />
                            <span>Enable Alerts</span>
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSubscribing}
                      onClick={handleSnooze}
                      className="h-8.5 px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remind Later
                    </Button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSnooze}
                className="absolute top-3.5 right-3.5 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
                title="Remind me later"
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
