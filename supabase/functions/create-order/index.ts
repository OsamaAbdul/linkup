// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
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

function calculateDistance(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Number((R * c).toFixed(1));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("--- create-order Gateway logic ---");

    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
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
      rider_fee_breakdown,
    } = body;

    console.log(
      `Payload received: items=${items?.length}, total=${total}, payment_method=${payment_method}, payment_status=${payment_status}`
    );

    if (!items || items.length === 0) throw new Error("No items in order");

    // --- Fetch Global Fee Config ---
    const { data: feeConfigs } = await adminClient
      .from("fee_config")
      .select("fee_type, rate")
      .in("fee_type", ["platform", "platform_rider_cut"]);

    let platformProductRate = 0.05; // default 5%
    let platformRiderRate = 0.10; // default 10%
    if (feeConfigs) {
      const pFee = feeConfigs.find((f: any) => f.fee_type === "platform");
      if (pFee?.rate) platformProductRate = Number(pFee.rate);

      const prFee = feeConfigs.find((f: any) => f.fee_type === "platform_rider_cut");
      if (prFee?.rate) platformRiderRate = Number(prFee.rate);
    }

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
    let finalPromoterId = null;
    let matchedReferralId = null;
    let totalPromoterEarnings = 0;

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

      let matchedReferralId = null;
      let promotedProductId = null;
      let promotedCampaignId = null;

      // SECURE: Referral Verification Guard (Phase 10/14)
      // We verify that a matching referral entry exists in the ledger.
      if (promoter_id) {
        console.log(`[Attribution] Verifying for promoter: ${promoter_id}`);
        
        // HEAL: We are more flexible now. We check for a matching click and don't strictly 
        // enforce expires_at if it's missing (assume non-expiring).
        const { data: referralRecord, error: referralLookupError } = await adminClient
          .from("referrals")
          .select("id, buyer_id, visitor_id, product_id, campaign_id")
          .eq("promoter_id", promoter_id)
          .or(`buyer_id.eq.${user.id},visitor_id.eq.${body.visitor_id}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (referralLookupError) {
            console.error(`[Attribution] DB Error during lookup:`, referralLookupError.message);
        }

        if (referralRecord) {
          console.log(`[Attribution] SUCCESS: Found matching referral record ${referralRecord.id}`);
          finalPromoterId = promoter_id;
          matchedReferralId = referralRecord.id;
          promotedProductId = referralRecord.product_id;
          promotedCampaignId = referralRecord.campaign_id;
        } else {
          // Fallback: If we have the promoter_id in checkout and the buyer isn't the promoter,
          // we can allow a more lenient "Identity Healing" if they just clicked the link.
          console.warn(`[Attribution] No strict match found. Checking for any recent click from this promoter...`);
          
          const { data: recentClick } = await adminClient
            .from("referrals")
            .select("id, product_id, campaign_id")
            .eq("promoter_id", promoter_id)
            .or(`buyer_id.eq.${user.id},visitor_id.eq.${body.visitor_id}`)
            .limit(1)
            .maybeSingle();
            
          if (recentClick) {
            console.log(`[Attribution] HEALED: Found a recent click. Attributing order.`);
            finalPromoterId = promoter_id;
            matchedReferralId = recentClick.id;
            promotedProductId = recentClick.product_id;
            promotedCampaignId = recentClick.campaign_id;
          } else {
            console.error(`[Attribution] FAILED: No record found for promoter ${promoter_id} and buyer ${user.id}`);
          }
        }
      } else {
        console.log(`[Attribution] SKIP: No promoter_id provided in checkout payload.`);
      }

      // --- Calculate Exact Financial Splits (Upfront) ---
      // Rider gets the base delivery fee PLUS the cross zone distance fee
      const current_rider_fee = (delivery_fee ? (delivery_fee / sellerIds.length) : 0) + (cross_zone_fee ? (cross_zone_fee / sellerIds.length) : 0);
      
      const product_total = calculatedSubTotal;
      let calculated_platform_fee = product_total * platformProductRate; // Dynamic Platform Product Cut
      
      // Platform Rider Cut: Deduct percentage from the rider's fee and give it to the platform
      const rider_platform_cut = current_rider_fee * platformRiderRate;
      const final_rider_fee = Math.max(0, current_rider_fee - rider_platform_cut);
      calculated_platform_fee += rider_platform_cut;
      
      let calculated_promoter_fee = 0;

      // Calculate promoter fee only if they promoted a specific product that is in the cart
      if (finalPromoterId && promotedProductId && promotedCampaignId) {
        const { data: campaign } = await adminClient
          .from("promoter_campaigns")
          .select("commission_rate")
          .eq("id", promotedCampaignId)
          .maybeSingle();

        if (campaign && campaign.commission_rate) {
          // Find the promoted items in the cart
          let promoted_items_total = 0;
          for (const item of enrichedSellerItems) {
            if (item.product_id === promotedProductId) {
              promoted_items_total += (Number(item.price) || 0) * (item.quantity || 1);
            }
          }
          
          if (promoted_items_total > 0) {
            calculated_promoter_fee = promoted_items_total * (Number(campaign.commission_rate) / 100);
            // Promoter's fee is deducted from the platform earnings
            calculated_platform_fee = Math.max(0, calculated_platform_fee - calculated_promoter_fee);
            totalPromoterEarnings += calculated_promoter_fee;
          }
        }
      }

      // Seller gets exactly what is left of the product total after the product platform cut
      const calculated_seller_earnings = product_total - (product_total * platformProductRate);
      
      const total_order_charge = product_total + current_rider_fee;

      // --- Create Transactional Order Record ---
      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .insert({
          buyer_id: user.id,
          seller_id: sId,
          total: total_order_charge || 0,
          subtotal: product_total || 0,
          shipping_fee: current_rider_fee || 0,
          platform_fee: calculated_platform_fee || 0,
          promoter_fee: calculated_promoter_fee || 0,
          seller_earnings: calculated_seller_earnings || 0,
          grand_total: total_order_charge || 0,
          status: "pending",
          promoter_id: finalPromoterId || null,
          payment_method: payment_method || null,
          payment_ref: payment_ref || null,
          payment_status: payment_status || null,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error(`ORDER_INSERT_FAIL for seller ${sId}:`, orderError);
        throw new Error(`Failed to create order for seller ${sId}: ${orderError.message}`);
      }

      createdOrderIds.push(order.id);

      // --- Create Recipient Record (The Destination Data) ---
      // --- Run Secondary Inserts Concurrently to reduce Latency ---
      const shipAddrRaw = shipping_address || pickup_address || {};
      const recipientPromise = adminClient.from("order_recipient").insert({
        order_id: order.id,
        full_name: shipAddrRaw.name || shipAddrRaw.full_name || user.user_metadata?.display_name || "Customer",
        phone: shipAddrRaw.phone || user.phone || "No phone",
        address_line: toTextAddress(shipAddrRaw),
        city_id: city_id || null, 
        zone_id: zone_id || null,
        lat: delivery_lat || null,
        lng: delivery_lng || null,
      });

      const orderItemsPayload = enrichedSellerItems.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        seller_id: sId,
        quantity: item.quantity,
        price_at_purchase: item.price,
        size: item.size || null,
      }));
      const itemsPromise = adminClient.from("order_items").insert(orderItemsPayload);

      const deliveryAddressStr = toTextAddress(shipping_address);
      const finalPickupAddressStr = toTextAddress(pickup_address) || current_seller_address;
      
      const calculated_distance_km = calculateDistance(
        current_pickup_lat,
        current_pickup_lng,
        delivery_lat,
        delivery_lng
      );

      const fee_breakdown = {
        base_fee: delivery_fee ? (delivery_fee / sellerIds.length) : 0,
        cross_zone_fee: cross_zone_fee ? (cross_zone_fee / sellerIds.length) : 0,
        total: current_rider_fee,
        distance_km: calculated_distance_km || body.distance_km || 0
      };

      const shipmentPromise = adminClient.from("shipments").insert({
        order_id: order.id,
        seller_id: sId,
        status: "pending",
        delivery_address: deliveryAddressStr,
        pickup_address: finalPickupAddressStr,
        delivery_fee: current_rider_fee, 
        zone_id: zone_id || null,
        buyer_latitude: delivery_lat || null,
        buyer_longitude: delivery_lng || null,
        distance_km: calculated_distance_km || body.distance_km || null,
        rider_fee_breakdown: fee_breakdown,
      });

      const notificationPromise = adminClient.from("notifications").insert({
        user_id: sId,
        type: "order",
        message: `New order portion received! Order #${order.id.slice(0, 8)}`,
      });

      const settlementPromise = adminClient.from("order_settlements").insert({
        order_id: order.id,
        gross_amount: total_order_charge || 0,
        seller_amount: calculated_seller_earnings || 0,
        rider_amount: final_rider_fee || 0,
        platform_amount: calculated_platform_fee || 0,
        promoter_amount: calculated_promoter_fee || 0,
        status: "pending",
      });

      const [recipientRes, itemsRes, shipmentRes, notifRes, settlementRes] = await Promise.all([
        recipientPromise, itemsPromise, shipmentPromise, notificationPromise, settlementPromise
      ]);

      if (recipientRes.error) console.error("RECIPIENT_INSERT_FAIL:", recipientRes.error);
      if (itemsRes.error) console.error("ITEMS_INSERT_FAIL:", itemsRes.error);
      if (shipmentRes.error) console.error("SHIPMENT_INSERT_FAIL:", shipmentRes.error);
      if (settlementRes.error) console.error("SETTLEMENT_INSERT_FAIL:", settlementRes.error);
    }

    // --- Conversion Tracking (Phase 10/14) ---
    if (finalPromoterId && createdOrderIds.length > 0) {
       console.log(`[Attribution] Finalizing conversion for order: ${createdOrderIds[0]}`);
       
       // Use the specific record we identified earlier if available, 
       // otherwise fallback to the broad filter to catch any missed clicks.
       const updateFilter = matchedReferralId 
         ? { id: matchedReferralId } 
         : { promoter_id: finalPromoterId };

       const query = adminClient
        .from("referrals")
        .update({ 
          converted_at: new Date().toISOString(), 
          order_id: createdOrderIds[0],
          status: 'conversion',
          buyer_id: user.id,
          earnings: totalPromoterEarnings
        });

       if (matchedReferralId) {
         await query.eq("id", matchedReferralId);
       } else {
         await query
           .eq("promoter_id", finalPromoterId)
           .or(`buyer_id.eq.${user.id},visitor_id.eq.${body.visitor_id || 'none'}`)
           .is("converted_at", null);
       }
       
       console.log(`[Attribution] Conversion update triggered.`);
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
