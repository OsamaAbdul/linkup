import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, X, AlertTriangle } from "lucide-react";
import { useNetworkStatus } from "../context/NetworkContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";

export const NetworkStatusBanner: React.FC = () => {
  const { isOnline, wasOffline, isChecking, checkConnection } = useNetworkStatus();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [showRestored, setShowRestored] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // If user drops offline, un-dismiss so they are immediately warned
  useEffect(() => {
    if (!isOnline) {
      setIsDismissed(false);
      setShowRestored(false);
    } else if (wasOffline) {
      setShowRestored(true);
      // Invalidate queries to refetch products and other data
      queryClient.invalidateQueries();
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, queryClient]);

  const handleRetry = async () => {
    await checkConnection();
  };

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-[9999] flex flex-col items-center">
      <AnimatePresence>
        {!isOnline && !isDismissed && (
          <motion.div
            initial={{ y: -60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-auto w-full max-w-2xl px-3 pt-2"
          >
            <div className="relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-destructive/95 text-destructive-foreground shadow-xl shadow-destructive/20 border border-destructive-foreground/20 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-black/20 shrink-0">
                  <WifiOff className="w-4 h-4 text-white animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-destructive" />
                </div>
                <div className="truncate">
                  <p className="text-sm font-semibold tracking-wide">
                    You are currently offline
                  </p>
                  <p className="text-xs text-destructive-foreground/80 truncate">
                    Some features may be limited until connection is restored.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRetry}
                  disabled={isChecking}
                  className="h-8 px-3 text-xs font-medium gap-1.5 bg-white/20 hover:bg-white/30 text-white border-0 transition-all active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
                  <span>{isChecking ? "Checking..." : "Retry"}</span>
                </Button>
                <button
                  onClick={() => setIsDismissed(true)}
                  aria-label="Dismiss banner"
                  className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Minimized pill if dismissed while still offline */}
        {!isOnline && isDismissed && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="pointer-events-auto mt-2"
          >
            <button
              onClick={() => setIsDismissed(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/90 text-white text-xs font-medium shadow-lg hover:bg-destructive transition-all active:scale-95 backdrop-blur-sm border border-white/20"
              title="Click to view offline details"
            >
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>Offline Mode</span>
              <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
            </button>
          </motion.div>
        )}

        {/* Back Online Announcement Banner */}
        {isOnline && showRestored && (
          <motion.div
            initial={{ y: -60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-auto px-4 pt-2"
          >
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30 backdrop-blur-md">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-700">
                <Wifi className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold">
                Back Online! Connection restored.
              </span>
              <button
                onClick={() => setShowRestored(false)}
                className="ml-1 p-0.5 rounded text-emerald-200 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
