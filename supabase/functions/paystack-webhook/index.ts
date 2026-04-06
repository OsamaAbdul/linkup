import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as crypto from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const paystackSignature = req.headers.get("x-paystack-signature");
    if (!paystackSignature) {
      console.error("No Paystack signature provided");
      return new Response(JSON.stringify({ error: "No signature" }), { status: 401 });
    }

    const bodyText = await req.text();
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

    // Verify Signature
    const hash = crypto
      .createHmac("sha512", secretKey)
      .update(bodyText)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    const constantTimeCompare = (a: string, b: string) => {
      if (a.length !== b.length) return false;
      let result = 0;
      for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
      }
      return result === 0;
    };

    if (!constantTimeCompare(hash, paystackSignature)) {
      console.error("Invalid Paystack signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }

    const event = JSON.parse(bodyText);
    console.log(`Paystack Webhook Received: ${event.event}`);

    if (event.event === "charge.success") {
      const { reference, metadata, amount, customer } = event.data;
      console.log(`Payment successful for reference: ${reference}`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Check if order already exists with this reference
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, payment_status")
        .eq("payment_ref", reference)
        .maybeSingle();

      if (existingOrder) {
        if (existingOrder.payment_status !== "paid") {
          console.log(`Updating existing order ${existingOrder.id} to paid`);
          await supabase
            .from("orders")
            .update({ payment_status: "paid" })
            .eq("id", existingOrder.id);
        } else {
          console.log(`Order ${existingOrder.id} already marked as paid`);
        }
      } else {
        // 2. Logic to create order if it doesn't exist (e.g. if client crashed)
        // This requires metadata to have been passed in the transaction initialization
        if (metadata?.order_payload) {
          console.log("Order doesn't exist. Creating from metadata payload...");
          const { data: newOrder, error: orderError } = await supabase.functions.invoke("create-order", {
            body: { 
                ...metadata.order_payload, 
                payment_ref: reference, 
                payment_status: "paid",
                payment_method: "paystack" 
            },
          });
          
          if (orderError) {
             console.error("Failed to create order via webhook recovery:", orderError);
          } else {
             console.log("Order created successfully via webhook recovery:", newOrder.order_id);
          }
        } else {
          console.warn("No existing order found and no order_payload in metadata. Cannot fulfill.");
        }
      }
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
