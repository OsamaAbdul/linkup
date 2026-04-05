import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-platform-runtime, x-supabase-client-platform-runtime-version",
};

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

    // --- Group Items by Seller ---
    const itemsBySeller: Record<string, any[]> = {};
    for (const item of items) {
      const sId = item.seller_id || seller_id;
      if (!sId) continue;
      if (!itemsBySeller[sId]) itemsBySeller[sId] = [];
      itemsBySeller[sId].push(item);
    }

    const sellerIds = Object.keys(itemsBySeller);
    if (sellerIds.length === 0) throw new Error("No valid products or sellers found in order items");

    const createdOrderIds: string[] = [];

    // --- Process each Seller as a separate Order ---
    for (const sId of sellerIds) {
      console.log(`Processing sub-order for seller: ${sId}`);
      const sellerItems = itemsBySeller[sId];
      
      // Calculate sub-total for this seller
      const subTotal = sellerItems.reduce((acc: number, item: any) => acc + (Number(item.price) * (item.quantity || 1)), 0);

      // --- Fetch Seller details for Distance & Pickup ---
      let current_pickup_lat = pickup_lat;
      let current_pickup_lng = pickup_lng;
      let current_seller_address = "";

      const { data: sellerProfile } = await adminClient
        .from("profiles")
        .select("latitude, longitude, address")
        .eq("id", sId)
        .single();
      
      if (sellerProfile) {
        current_pickup_lat = current_pickup_lat || sellerProfile.latitude;
        current_pickup_lng = current_pickup_lng || sellerProfile.longitude;
        current_seller_address = sellerProfile.address || "";
      }

      // Check seller_verifications if still missing address
      if (!current_seller_address) {
        const { data: sellerVerif } = await adminClient
          .from("seller_verifications")
          .select("business_address")
          .eq("user_id", sId)
          .single();
        
        if (sellerVerif) {
          current_seller_address = sellerVerif.business_address || "";
        }
      }

      // --- Enrich Items & Decrement inventory for this seller's products ---
      const enrichedSellerItems = [];
      for (const item of sellerItems) {
        if (item.product_id && item.quantity) {
          const { data: prod } = await adminClient
            .from("products")
            .select("inventory, title, images")
            .eq("id", item.product_id)
            .single();

          if (prod) {
            enrichedSellerItems.push({
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
            enrichedSellerItems.push(item);
          }
        } else {
          enrichedSellerItems.push(item);
        }
      }

      // --- Create Order for this Seller ---
      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert({
          buyer_id: user.id,
          seller_id: sId,
          items: enrichedSellerItems, // Storing items in JSONB too for legacy/quick view
          total: subTotal || 0,
          shipping_info: shipping_address || pickup_address || null,
          status: "pending",
          promoter_id: promoter_id || null,
          payment_method: payment_method || null,
          payment_ref: payment_ref || null,
          payment_status: payment_status || null,
          pickup_lat: current_pickup_lat || null,
          pickup_lng: current_pickup_lng || null,
          delivery_lat: delivery_lat || null,
          delivery_lng: delivery_lng || null,
          settlement_status: "none",
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`ORDER_INSERT_FAIL for seller ${sId}:`, orderError);
        continue;
      }

      createdOrderIds.push(order.id);

      // --- Create Order Items Relationship ---
      const orderItemsPayload = enrichedSellerItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        seller_id: sId,
        quantity: item.quantity,
        price_at_purchase: item.price,
        size: item.size || null,
      }));

      await adminClient.from("order_items_new").insert(orderItemsPayload);

      // --- Create Shipment for this Seller's sub-order ---
      const deliveryAddress = toTextAddress(shipping_address);
      const finalPickupAddress = toTextAddress(pickup_address) || current_seller_address;

      await adminClient.from("shipments").insert({
        order_id: order.id,
        seller_id: sId,
        status: "pending",
        delivery_address: deliveryAddress,
        pickup_address: finalPickupAddress,
        delivery_fee: delivery_fee ? (delivery_fee / sellerIds.length) : 0, 
        zone_id: zone_id || null,
        city_id: city_id || null,
        zone: zone || null,
        broadcast_zone: zone || null,
        pickup_latitude: current_pickup_lat || null,
        pickup_longitude: current_pickup_lng || null,
        buyer_latitude: delivery_lat || null,
        buyer_longitude: delivery_lng || null,
      });

      // --- Notify Seller ---
      await adminClient.from("notifications").insert({
        user_id: sId,
        type: "order",
        message: `New order portion received! Order #${order.id.slice(0, 8)}`,
      });
    }

    // --- Conversion Tracking (Reference the first order created) ---
    if (promoter_id && createdOrderIds.length > 0) {
       await adminClient
        .from("referrals")
        .update({ 
          converted_at: new Date().toISOString(), 
          order_id: createdOrderIds[0] 
        })
        .eq("promoter_id", promoter_id)
        .eq("visitor_id", user.id)
        .is("converted_at", null);
    }

    return new Response(
      JSON.stringify({
        order_ids: createdOrderIds,
        main_order_id: createdOrderIds[0],
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
