import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { onlineManager } from "@tanstack/react-query";
import posthog from "posthog-js";
import { toast } from "sonner";

export interface NetworkConnectionInfo {
  type?: string;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g" | string;
  downlink?: number; // Mb/s
  rtt?: number; // ms
  saveData?: boolean;
}

export interface NetworkContextValue {
  isOnline: boolean;
  wasOffline: boolean;
  isChecking: boolean;
  lastChangedAt: Date | null;
  connectionInfo: NetworkConnectionInfo;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

function getInitialConnectionInfo(): NetworkConnectionInfo {
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    const conn = (navigator as unknown as { connection?: NetworkConnectionInfo }).connection;
    if (conn) {
      return {
        type: conn.type,
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData,
      };
    }
  }
  return {};
}

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<NetworkConnectionInfo>(getInitialConnectionInfo);

  // Avoid firing back-online toast on initial page mount
  const hasMountedRef = useRef<boolean>(false);

  // Active ping verification to ensure internet traffic actually flows
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      setIsChecking(false);
      onlineManager.setOnline(false);
      return false;
    }

    try {
      // Lightweight request with cache busting and strict timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`/favicon.ico?_ping=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to origin check if favicon.ico doesn't answer HEAD
        return fetch(`/?_ping=${Date.now()}`, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      const reachable = res.ok || res.status < 500;
      setIsOnline(reachable);
      onlineManager.setOnline(reachable);
      return reachable;
    } catch {
      // If HEAD/fetch failed or timed out, browser might have network interface up but no internet
      const reachable = typeof navigator !== "undefined" ? navigator.onLine : false;
      setIsOnline(reachable);
      onlineManager.setOnline(reachable);
      return reachable;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Update connection metrics
  const updateConnectionDetails = useCallback(() => {
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as unknown as { connection?: NetworkConnectionInfo }).connection;
      if (conn) {
        setConnectionInfo({
          type: conn.type,
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
          saveData: conn.saveData,
        });
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      // Optimistically set online so React Query instantly begins refetching without waiting for the ping
      setIsOnline(true);
      onlineManager.setOnline(true);

      const verified = await checkConnection();
      const now = new Date();
      setLastChangedAt(now);
      updateConnectionDetails();

      if (verified) {
        if (hasMountedRef.current) {
          setWasOffline(true);
          toast.success("Back online! Connection restored.", {
            id: "network-status",
            duration: 3500,
          });
        }
      } else {
        // Revert if ping fails
        setIsOnline(false);
        onlineManager.setOnline(false);
      }

      // Track analytics
      try {
        if (typeof posthog !== "undefined" && posthog.__loaded) {
          posthog.capture("network_status_change", {
            status: "online",
            effectiveType: connectionInfo.effectiveType,
            downlink: connectionInfo.downlink,
          });
        }
      } catch (err) {
        console.debug("PostHog network capture skipped:", err);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setLastChangedAt(new Date());
      onlineManager.setOnline(false);

      toast.error("You are offline. Please check your connection.", {
        id: "network-status",
        duration: 5000,
      });

      // Track analytics
      try {
        if (typeof posthog !== "undefined" && posthog.__loaded) {
          posthog.capture("network_status_change", {
            status: "offline",
          });
        }
      } catch (err) {
        console.debug("PostHog network capture skipped:", err);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    let connectionObj: EventTarget | null = null;
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      connectionObj = (navigator as unknown as { connection?: EventTarget }).connection || null;
      if (connectionObj && typeof connectionObj.addEventListener === "function") {
        connectionObj.addEventListener("change", updateConnectionDetails);
      }
    }

    // Mark as mounted after initial cycle
    hasMountedRef.current = true;

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (connectionObj && typeof connectionObj.removeEventListener === "function") {
        connectionObj.removeEventListener("change", updateConnectionDetails);
      }
    };
  }, [checkConnection, updateConnectionDetails, connectionInfo.effectiveType, connectionInfo.downlink]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        wasOffline,
        isChecking,
        lastChangedAt,
        connectionInfo,
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetworkStatus = (): NetworkContextValue => {
  const context = useContext(NetworkContext);
  if (!context) {
    // Graceful fallback if called outside provider
    return {
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      wasOffline: false,
      isChecking: false,
      lastChangedAt: null,
      connectionInfo: getInitialConnectionInfo(),
      checkConnection: async () => (typeof navigator !== "undefined" ? navigator.onLine : true),
    };
  }
  return context;
};
