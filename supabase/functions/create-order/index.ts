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
      cross_zone_fee,
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
    // --- IDEMPOTENCY GUARD (Phase 14) ---
    // If we have a payment_ref, check if we've already created an order for it.
    if (payment_ref) {
      const { data: existingOrder } = await adminClient
        .from("orders")
        .select("id")
        .eq("payment_ref", payment_ref)
        .limit(1)
        .maybeSingle();

      if (existingOrder) {
        console.log(`Idempotency Hit: Order already exists for ref ${payment_ref}. ID: ${existingOrder.id}`);
        return new Response(
          JSON.stringify({
            success: true,
            order_id: existingOrder.id,
            was_idempotent: true
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

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
      let calculatedSubTotal = 0;

      for (const item of sellerItems) {
        // SECURE: Enforce positive quantity to prevent "negative order" theft
        if (!item.quantity || item.quantity <= 0) {
          console.error(`Invalid quantity for product ${item.product_id}: ${item.quantity}`);
          continue; // Skip items with negative/zero quantity
        }

        if (item.product_id) {
          // HEAL: Fetch PRICE and inventory from source of truth (DB)
          const { data: prod } = await adminClient
            .from("products")
            .select("price, inventory, title, images")
            .eq("id", item.product_id)
            .single();

          if (prod) {
            const itemPrice = Number(prod.price) || 0;
            const requestedQty = item.quantity || 1;

            // --- STRICT STOCK GUARD (Phase 14) ---
            if ((prod.inventory || 0) < requestedQty) {
              console.error(`INSUFFICIENT_STOCK: ${prod.title} (${item.product_id}). Wanted ${requestedQty}, had ${prod.inventory}`);
              throw new Error(`Sorry, only ${prod.inventory} of "${prod.title}" items are left in stock.`);
            }

            calculatedSubTotal += (itemPrice * requestedQty);

            enrichedSellerItems.push({
              ...item,
              price: itemPrice, // SECURE: Overwrite client price with DB price
              title: item.title || prod.title,
              image: item.image || prod.images?.[0] || ""
            });

            await adminClient
              .from("products")
              .update({
                inventory: (prod.inventory || 0) - requestedQty,
              })
              .eq("id", item.product_id);
          } else {
            // Fallback for missing product
            enrichedSellerItems.push(item);
            calculatedSubTotal += (Number(item.price) || 0) * (item.quantity || 1);
          }
        } else {
          enrichedSellerItems.push(item);
          calculatedSubTotal += (Number(item.price) || 0) * (item.quantity || 1);
        }
      }

      // SECURE: Referral Verification Guard (Phase 10/14)
      // We verify that a matching referral entry exists in the ledger.
      let finalPromoterId = null;
      if (promoter_id) {
        console.log(`[Attribution] Verifying for promoter: ${promoter_id}`);
        console.log(`[Attribution] Identities: User=${user.id}, Visitor=${body.visitor_id}`);
        
        const { data: referralRecord, error: referralLookupError } = await adminClient
          .from("referrals")
          .select("id")
          .eq("promoter_id", promoter_id)
          .or(`buyer_id.eq.${user.id},visitor_id.eq.${body.visitor_id}`)
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();

        if (referralLookupError) {
            console.error(`[Attribution] DB Error during lookup:`, referralLookupError.message);
        }

        if (referralRecord) {
          console.log(`[Attribution] SUCCESS: Found matching referral record ${referralRecord.id}`);
          finalPromoterId = promoter_id;
        } else {
          console.warn(`[Attribution] FAILED: No matching click found in DB for identities provided.`);
        }
      } else {
        console.log(`[Attribution] SKIP: No promoter_id provided in checkout payload.`);
      }

      // --- Create Transactional Order Record ---
      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert({
          buyer_id: user.id,
          seller_id: sId,
          total_amount: (calculatedSubTotal + (delivery_fee ? (delivery_fee / sellerIds.length) : 0) + (cross_zone_fee ? (cross_zone_fee / sellerIds.length) : 0)) || 0,
          status: "pending",
          promoter_id: finalPromoterId || null,
          payment_method: payment_method || null,
          payment_ref: payment_ref || null,
          payment_status: payment_status || null,
          settlement_status: "none",
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`ORDER_INSERT_FAIL for seller ${sId}:`, orderError);
        throw new Error(`Failed to create order for seller ${sId}: ${orderError.message}`);
      }

      createdOrderIds.push(order.id);

      // --- Create Recipient Record (The Destination Data) ---
      const shipAddrRaw = shipping_address || pickup_address || {};
      const { error: recipientError } = await adminClient
        .from("order_recipient")
        .insert({
          order_id: order.id,
          full_name: shipAddrRaw.name || shipAddrRaw.full_name || user.user_metadata?.display_name || "Customer",
          phone: shipAddrRaw.phone || user.phone || "No phone",
          address_line: toTextAddress(shipAddrRaw),
          city_id: city_id || null, 
          zone_id: zone_id || null,
          lat: delivery_lat || null,
          lng: delivery_lng || null,
        });

      if (recipientError) {
        console.error("RECIPIENT_INSERT_FAIL:", recipientError);
        throw new Error(`Failed to save recipient data: ${recipientError.message}`);
      }

      // --- Create Order Items Relationship ---
      const orderItemsPayload = enrichedSellerItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        seller_id: sId,
        quantity: item.quantity,
        price_at_purchase: item.price,
        size: item.size || null,
      }));

      await adminClient.from("order_items").insert(orderItemsPayload);

      // --- Create Shipment Record (The Logistics Pipeline) ---
      const deliveryAddressStr = toTextAddress(shipping_address);
      const finalPickupAddressStr = toTextAddress(pickup_address) || current_seller_address;

      await adminClient.from("shipments").insert({
        order_id: order.id,
        seller_id: sId,
        status: "pending",
        delivery_address_text: deliveryAddressStr,
        pickup_address_text: finalPickupAddressStr,
        delivery_fee_amount: delivery_fee ? (delivery_fee / sellerIds.length) : 0, 
        cross_zone_fee_amount: cross_zone_fee ? (cross_zone_fee / sellerIds.length) : 0,
        zone_id: zone_id || null,
        city_id: city_id || null,
        zone: zone || null,
        broadcast_zone: zone || null,
        pickup_lat: current_pickup_lat || null,
        pickup_lng: current_pickup_lng || null,
        delivery_lat: delivery_lat || null,
        delivery_lng: delivery_lng || null,
        distance_km: body.distance_km || null,
        // (Removing legacy JSONB to finalize the pure architecture)
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
          order_id: createdOrderIds[0],
          status: 'conversion',
          buyer_id: user.id // Ensure buyer_id is linked upon conversion
        })
        .eq("promoter_id", promoter_id)
        .or(`buyer_id.eq.${user.id},visitor_id.eq.${body.visitor_id}`)
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
