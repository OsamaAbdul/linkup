import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import posthog from 'posthog-js';
import { supabase } from '@/integrations/supabase/client';

export const AnalyticsProvider = () => {
  const location = useLocation();

  useEffect(() => {
    // Read from env vars, using placeholder if undefined
    const apiKey = import.meta.env.VITE_POSTHOG_KEY || 'phc_placeholder';
    const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
    
    // Only init if we haven't already
    if (!posthog.__loaded) {
      posthog.init(apiKey, { 
        api_host: apiHost, 
        autocapture: false, // We'll manually capture pageviews
        capture_pageview: false 
      });
    }

    // Listen to Supabase Auth State
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, { 
          role: session.user.user_metadata?.role,
          // Extract just the domain for analytics to avoid saving PII
          email_domain: session.user.email?.split('@')[1] 
        });
        posthog.capture('user_signed_in', { provider: session.user.app_metadata?.provider });
      } else if (event === 'SIGNED_OUT') {
        posthog.capture('user_signed_out');
        posthog.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (posthog.__loaded) {
      posthog.capture('$pageview', { path: location.pathname });
    }
  }, [location]);

  return null;
};
