// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header provided");

    const token = authHeader.replace(/^[Bb]earer\s+/, "").trim();
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const {
      id, zone, zoneId, cityId, pickupAddress, deliveryAddress, pickupTime, lat, lng
    } = body;

    if (!id || !zoneId) throw new Error("Missing required fields: id or zoneId");

    // Fetch existing shipment to get delivery coords and zone
    const { data: shipment, error: shipmentError } = await adminClient
      .from("shipments")
      .select("*")
      .eq("order_id", id)
      .single();

    if (shipmentError || !shipment) {
      throw new Error("Shipment not found for this order");
    }

    // Recalculate distance
    const distanceKm = calculateDistance(
      lat, lng,
      shipment.buyer_latitude, shipment.buyer_longitude
    );

    // Fetch fee config
    const { data: feeConfigs } = await adminClient
      .from("fee_config")
      .select("fee_type, flat_fee")
      .in("fee_type", ["rider", "buyer_cross_zone"]);

    let riderBaseFee = 1500;
    let crossZoneFeeRate = 0;

    if (feeConfigs) {
      const riderConfig = feeConfigs.find((f: any) => f.fee_type === "rider");
      if (riderConfig?.flat_fee) riderBaseFee = Number(riderConfig.flat_fee);

      const crossConfig = feeConfigs.find((f: any) => f.fee_type === "buyer_cross_zone");
      if (crossConfig?.flat_fee) crossZoneFeeRate = Number(crossConfig.flat_fee);
    }

    const deliveryZoneId = shipment.zone_id;
    let finalCrossZoneFee = 0;
    if (deliveryZoneId && zoneId !== deliveryZoneId) {
      finalCrossZoneFee = crossZoneFeeRate;
    }

    const totalDeliveryFee = riderBaseFee + finalCrossZoneFee;

    // Update orders
    const { error: updateOrderError } = await adminClient
      .from("orders")
      .update({
        status: "awaiting_agent",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (updateOrderError) throw updateOrderError;

    // Update shipments
    const { error: updateShipmentError } = await adminClient
      .from("shipments")
      .update({
        seller_id: user.id,
        zone_id: zoneId,
        status: "pending",
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        delivery_fee: totalDeliveryFee,
        distance_km: distanceKm || 0,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', id);
    if (updateShipmentError) throw updateShipmentError;

    // Find logistics riders in the pickup zone
    const { data: zoneProfiles } = await adminClient
      .from("profiles")
      .select("id")
      .eq("zone_id", zoneId);

    const { data: logisticsRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "logistics");
    
    const zoneRiderIds = (zoneProfiles || [])
       .filter((p: any) => (logisticsRoles || []).some((r: any) => r.user_id === p.id))
       .map((p: any) => p.id);

    // Send Push Notifications
    const riderPushPromises = zoneRiderIds.map((rId: string) => 
      adminClient.functions.invoke("send-push", {
        body: {
          target_user_id: rId,
          title: "New Mission Available! 🏍️",
          message: `A new delivery mission is available in your zone. Claim it now!`,
          url: "/logistics",
        },
        headers: { Authorization: authHeader || "" }
      })
    );

    // Insert Notifications (triggers email)
    const riderNotificationPromises = zoneRiderIds.map((rId: string) =>
      adminClient.from("notifications").insert({
        user_id: rId,
        type: "delivery",
        message: `A new delivery mission is available in your zone. Order #${id.slice(0, 8)}`,
      })
    );

    await Promise.all([...riderPushPromises, ...riderNotificationPromises]);

    return new Response(JSON.stringify({ success: true, deliveryFee: totalDeliveryFee }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in broadcast-order:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
