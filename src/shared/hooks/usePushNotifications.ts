import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check for existing subscription
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setSubscription(sub);
        });
      });
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
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

  const subscribe = async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported by your browser.');
      return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Permission for notifications was denied.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!publicVapidKey) {
        console.error("VITE_VAPID_PUBLIC_KEY is not set.");
        return;
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      setSubscription(newSubscription);

      // Save to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const subData = JSON.parse(JSON.stringify(newSubscription));
        
        await supabase.from('push_subscriptions').upsert({
          user_id: session.user.id,
          endpoint: subData.endpoint,
          p256dh: subData.keys.p256dh,
          auth: subData.keys.auth,
          user_agent: navigator.userAgent
        }, { onConflict: 'user_id, endpoint' });
        
        toast.success('Successfully subscribed to notifications!');
      } else {
         toast.error('You must be logged in to subscribe to notifications.');
      }
    } catch (error: any) {
      console.error('Error subscribing to push notifications:', error);
      toast.error('Failed to subscribe to notifications.');
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    subscribe
  };
};
