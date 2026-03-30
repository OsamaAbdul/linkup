import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform-runtime, x-supabase-client-platform-runtime-version",
};

const COMMISSION_RATE = 0.05; // 5%

function toTextAddress(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && (val as any).address && typeof (val as any).address === "string") {
    return (val as any).address;
  }
  return "";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("--- create-order Gateway logic ---");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify User Identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header provided");

    const token = authHeader.replace(/^[Bb]earer\s+/, "").trim();
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Manual Auth Fail:", authError?.message);
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          details: "Invalid session. Please login again.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Authenticated User: ${user.id}. Processing order...`);

    // Parse Payload
    const body = await req.json();
    const {
      items,
      shipping_address,
      pickup_address,
      total,
      zone,
      city_id,
      zone_id,
      delivery_fee,
      payment_method,
      payment_ref,
      payment_status,
      seller_id,
      promoter_id,
      pickup_lat,
      pickup_lng,
      delivery_lat,
      delivery_lng,
    } = body;

    console.log(
      `Payload received: items=${items?.length}, total=${total}, payment_method=${payment_method}, payment_status=${payment_status}`
    );

    if (!items || items.length === 0) throw new Error("No items in order");

    // Determine the seller_id from items or payload
    const orderSellerId = seller_id || items[0]?.seller_id;
    if (!orderSellerId) throw new Error("No seller_id provided");

    // --- Fetch Seller details for Distance & Pickup ---
    let final_pickup_lat = pickup_lat;
    let final_pickup_lng = pickup_lng;
    let seller_address_fallback = "";

    if (!final_pickup_lat || !final_pickup_lng || !seller_address_fallback) {
      const { data: sellerProfile } = await adminClient
        .from("profiles")
        .select("latitude, longitude, address")
        .eq("id", orderSellerId)
        .single();
      
      if (sellerProfile) {
        final_pickup_lat = final_pickup_lat || sellerProfile.latitude;
        final_pickup_lng = final_pickup_lng || sellerProfile.longitude;
        seller_address_fallback = seller_address_fallback || sellerProfile.address || "";
      }

      // Check seller_verifications if still missing
      if (!seller_address_fallback) {
        const { data: sellerVerif } = await adminClient
          .from("seller_verifications")
          .select("business_address")
          .eq("user_id", orderSellerId)
          .single();
        
        if (sellerVerif) {
          seller_address_fallback = sellerVerif.business_address || "";
        }
      }
    }

    // --- Enrich Items & Decrement inventory ---
    const enrichedItems = [];
    for (const item of items) {
      if (item.product_id && item.quantity) {
        const { data: prod } = await adminClient
          .from("products")
          .select("inventory, title, images")
          .eq("id", item.product_id)
          .single();

        if (prod) {
          enrichedItems.push({
            ...item,
            title: item.title || prod.title,
            image: item.image || prod.images?.[0] || ""
          });

          await adminClient
            .from("products")
            .update({
              inventory: Math.max(0, (prod.inventory || 0) - item.quantity),
            })
            .eq("id", item.product_id);
        } else {
          enrichedItems.push(item);
        }
      } else {
        enrichedItems.push(item);
      }
    }

    // --- Create Order ---
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: orderSellerId,
        items: enrichedItems,
        total: total || 0,
        shipping_info: shipping_address || pickup_address || null,
        status: "pending",
        promoter_id: promoter_id || null,
        payment_method: payment_method || null,
        payment_ref: payment_ref || null,
        payment_status: payment_status || null,
        pickup_lat: final_pickup_lat || null,
        pickup_lng: final_pickup_lng || null,
        delivery_lat: delivery_lat || null,
        delivery_lng: delivery_lng || null,
        settlement_status: "none",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("ORDER_INSERT_FAIL:", orderError);
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // --- Create Order Items (Relational Integrity) ---
    const orderItemsPayload = enrichedItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      seller_id: item.seller_id || orderSellerId,
      quantity: item.quantity,
      price_at_purchase: item.price,
      size: item.size || null,
    }));

    const { error: itemsError } = await adminClient
      .from("order_items_new")
      .insert(orderItemsPayload);

    if (itemsError) {
      console.error("ORDER_ITEMS_INSERT_FAIL:", itemsError);
      // Non-blocking but logged
    }

    // --- Conversion Tracking (New Engine) ---
    if (promoter_id) {
       await adminClient
        .from("referrals")
        .update({ 
          converted_at: new Date().toISOString(), 
          order_id: order.id 
        })
        .eq("promoter_id", promoter_id)
        .eq("visitor_id", user.id) // Assuming visitor_id maps to user_id after login
        .is("converted_at", null);
    }

    console.log("Order created:", order.id);

    // --- Create Shipment (fail loudly) ---
    const deliveryAddress = toTextAddress(shipping_address);
    const pickupAddress = toTextAddress(pickup_address) || seller_address_fallback;

    const { error: shipmentError } = await adminClient.from("shipments").insert({
      order_id: order.id,
      seller_id: orderSellerId,
      status: "pending",
      delivery_address: deliveryAddress,
      pickup_address: pickupAddress,
      delivery_fee: delivery_fee || 0,
      zone_id: zone_id || null,
      city_id: city_id || null,
      zone: zone || null,
      broadcast_zone: zone || null,
      pickup_latitude: final_pickup_lat || null,
      pickup_longitude: final_pickup_lng || null,
      buyer_latitude: delivery_lat || null,
      buyer_longitude: delivery_lng || null,
    });

    if (shipmentError) {
      console.error("SHIPMENT_INSERT_FAIL:", shipmentError);
      // Best-effort rollback to avoid orphaned orders
      await adminClient.from("orders").delete().eq("id", order.id);
      throw new Error(`Failed to create shipment: ${shipmentError.message}`);
    }

    // --- Commission Logic ---
    let commissionCreated = false;
    if (promoter_id) {
      // Anti-fraud: promoter cannot be the buyer or the seller
      if (promoter_id !== user.id && promoter_id !== orderSellerId) {
        const commissionAmount = (total || 0) * COMMISSION_RATE;
        if (commissionAmount > 0) {
          const { error: commError } = await adminClient
            .from("commissions")
            .insert({
              order_id: order.id,
              promoter_id: promoter_id,
              seller_id: orderSellerId,
              rate: COMMISSION_RATE,
              amount: commissionAmount,
              status: "pending",
            });
          if (commError) {
            console.error("COMMISSION_INSERT_FAIL:", commError);
          } else {
            commissionCreated = true;
            console.log(
              `Commission created: ₦${commissionAmount} for promoter ${promoter_id}`
            );
          }
        }
      } else {
        console.log("Self-referral blocked. No commission awarded.");
      }
    }

    // --- Notifications ---
    await adminClient.from("notifications").insert({
      user_id: orderSellerId,
      type: "order",
      message: `New order received! Order #${order.id.slice(0, 8)}`,
    });

    return new Response(
      JSON.stringify({
        order_id: order.id,
        commission_created: commissionCreated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    console.error("CRITICAL_FUNCTION_ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
