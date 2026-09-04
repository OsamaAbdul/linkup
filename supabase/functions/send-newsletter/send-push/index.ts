// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate Request
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header provided");

    const token = authHeader.replace(/^[Bb]earer\s+/, "").trim();
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse Payload
    const body = await req.json();
    const { target_user_id, title, message, url, icon } = body;

    if (!target_user_id || !title || !message) {
      throw new Error("Missing required fields: target_user_id, title, message");
    }

    // 2. Configure Web Push
    const VAPID_PUBLIC_KEY = Deno.env.get("VITE_VAPID_PUBLIC_KEY") || "BN5R1dEKhws8X8qALinzM9C5WuzhOly2Cz1jHaxKlSgDq2fqRw9GpJD568A2OU9mk1KO6e0qtqst2BAMlczr5Os";
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!VAPID_PRIVATE_KEY) {
       console.warn("VAPID_PRIVATE_KEY not set in edge function secrets! Push will fail if not set locally.");
    }

    webpush.setVapidDetails(
      'mailto:admin@linkup.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY || "2Kht47zHqBrClD1ObR90d0Rc2vbIGYhQ4FpzhkKsENY" // Using local dev fallback
    );

    // 3. Get User Subscriptions
    const { data: subscriptions, error: subError } = await adminClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', target_user_id);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "User has no push subscriptions." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Send Notifications
    const payload = JSON.stringify({
      title: title,
      body: message,
      icon: icon || '/logoo.jpeg',
      data: {
         url: url || '/'
      }
    });

    const sendPromises = subscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        return { success: true, endpoint: sub.endpoint };
      } catch (error: any) {
        console.error(`Error sending push to ${sub.endpoint}:`, error);
        
        // If the subscription is gone or invalid (HTTP 410 or 404), remove it from DB
        if (error.statusCode === 410 || error.statusCode === 404) {
           await adminClient.from('push_subscriptions').delete().eq('id', sub.id);
        }
        return { success: false, endpoint: sub.endpoint, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
