import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(() => {
    return localStorage.getItem('linkup_push_subscribed') === 'true';
  });
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check for existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setSubscription(sub);
            setIsSubscribed(true);
            localStorage.setItem('linkup_push_subscribed', 'true');
          }
        }).catch((err) => {
          console.warn('Error reading push subscription:', err);
        });
      }).catch((err) => {
        console.warn('Service worker not ready:', err);
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications are not supported by your browser.');
      setLastError('unsupported');
      return false;
    }

    setIsSubscribing(true);
    setLastError(null);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setLastError('denied');
        toast.error('Notification permission was not granted.', {
          description: 'You can enable it in your browser site permissions settings.',
        });
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BN5R1dEKhws8X8qALinzM9C5WuzhOly2Cz1jHaxKlSgDq2fqRw9GpJD568A2OU9mk1KO6e0qtqst2BAMlczr5Os";
      
      if (!publicVapidKey) {
        console.error("VITE_VAPID_PUBLIC_KEY is not set.");
        setLastError('missing_key');
        return false;
      }

      // Check if existing subscription is active
      let newSubscription = await registration.pushManager.getSubscription();
      if (!newSubscription) {
        newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });
      }

      setSubscription(newSubscription);
      setIsSubscribed(true);
      localStorage.setItem('linkup_push_subscribed', 'true');

      // Save to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && newSubscription) {
        const subData = JSON.parse(JSON.stringify(newSubscription));
        
        await supabase.from('push_subscriptions' as any).upsert({
          user_id: session.user.id,
          endpoint: subData.endpoint,
          p256dh: subData.keys?.p256dh || '',
          auth: subData.keys?.auth || '',
          user_agent: navigator.userAgent,
        }, { onConflict: 'user_id, endpoint' });
      }

      toast.success('Push notifications enabled!', {
        description: 'You will receive real-time alerts for orders, messages, and dispatch updates.',
      });
      return true;
    } catch (error: any) {
      console.warn('Push notification subscription status:', error);
      const isPushServiceError = error?.name === 'AbortError' || error?.message?.includes('push service error') || error?.message?.includes('Registration failed');

      if (isPushServiceError) {
        setLastError('push_service_unavailable');
      } else if (error?.name === 'NotAllowedError') {
        setLastError('dismissed');
      } else {
        setLastError(error?.message || 'failed');
        toast.error('Could not activate push notifications on this device.');
      }
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  const enableInAppFallback = useCallback(() => {
    setIsSubscribed(true);
    localStorage.setItem('linkup_push_subscribed', 'true');
    toast.success('In-App alerts activated!', {
      description: 'You will receive real-time alerts while using LinkUp.',
    });
  }, []);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribed,
    isSubscribing,
    lastError,
    subscribe,
    enableInAppFallback,
  };
};
