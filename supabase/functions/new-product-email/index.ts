// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      throw new Error("Missing required environment variables.");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("New Product Webhook Payload received:", JSON.stringify(payload, null, 2));

    // Handle webhook structure (from pg_net or manual invoke)
    const record = payload.record || payload;
    if (!record || !record.id || !record.title) {
      return new Response(JSON.stringify({ message: "No valid product record found. Skipping." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const {
      id: productId,
      title: productTitle,
      description: productDescription = "",
      price: productPrice = 0,
      images = [],
      seller_id: sellerId,
      category = "Featured"
    } = record;

    // 1. Fetch Seller Info
    let sellerName = "Verified Seller";
    if (sellerId) {
      const { data: sellerProfile } = await adminClient
        .from("profiles")
        .select("display_name")
        .eq("id", sellerId)
        .maybeSingle();

      if (sellerProfile?.display_name) {
        sellerName = sellerProfile.display_name;
      }
    }

    // 2. Fetch all buyers' emails (excluding the seller)
    // We fetch user_roles where role = 'buyer'
    const { data: buyerRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "buyer");

    const buyerUserIds = new Set<string>();
    buyerRoles?.forEach((r: any) => {
      if (r.user_id !== sellerId) {
        buyerUserIds.add(r.user_id);
      }
    });

    // Fetch auth users to get emails
    let allAuthUsers: any[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 10) {
      const { data: authList, error: authListError } = await adminClient.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (authListError) throw authListError;
      if (!authList.users || authList.users.length === 0) {
        hasMore = false;
      } else {
        allAuthUsers.push(...authList.users);
        if (authList.users.length < 200) hasMore = false;
        page++;
      }
    }

    // Fetch all profiles for display names and optional emails
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, display_name, email");

    const profileMap = new Map<string, any>();
    profiles?.forEach((p: any) => profileMap.set(p.id, p));

    // Also get all non-seller, non-logistics users as buyers if user_roles doesn't have an explicit 'buyer' role
    const { data: nonBuyerRoles } = await adminClient
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["seller", "logistics"]);

    const nonBuyerUserIds = new Set<string>();
    nonBuyerRoles?.forEach((r: any) => nonBuyerUserIds.add(r.user_id));

    interface BuyerRecipient {
      email: string;
      name: string;
    }

    const recipientsMap = new Map<string, BuyerRecipient>();

    for (const u of allAuthUsers) {
      if (!u.email || u.id === sellerId) continue;
      const email = u.email.trim().toLowerCase();
      const profile = profileMap.get(u.id);
      const name = profile?.display_name || u.user_metadata?.display_name || "Shopper";

      // Match if explicitly has buyer role, OR user has no non-buyer role
      const isBuyer = buyerUserIds.has(u.id) || !nonBuyerUserIds.has(u.id);

      if (isBuyer) {
        recipientsMap.set(email, { email: u.email, name });
      }
    }

    const recipients = Array.from(recipientsMap.values());
    console.log(`Found ${recipients.length} buyers to notify for new product: "${productTitle}"`);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: "No buyers found to notify.", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Format product visuals and details
    const formattedPrice = `₦${Number(productPrice).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    const mainImage = Array.isArray(images) && images.length > 0 ? images[0] : "https://www.linkupng.com/order.png";
    const productUrl = `https://www.linkupng.com/product/${productId}`;
    const truncatedDesc = productDescription.length > 180 ? `${productDescription.slice(0, 180)}...` : productDescription;

    const emailSubject = `🔥 Just Listed: ${productTitle} on Linkup!`;

    const generateProductEmailHtml = (buyerName: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F4F6F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 25px rgba(0,0,0,0.06); }
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; border-radius: 0 !important; }
      .content-inner { padding: 24px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #F4F6F8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 12px;">
        <table role="presentation" class="email-wrapper" width="100%" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Bar -->
          <tr>
            <td align="center" style="padding: 24px 20px; background: linear-gradient(135deg, #111827 0%, #1F2937 100%);">
              <a href="https://www.linkupng.com" target="_blank" style="text-decoration: none;">
                <img src="https://www.linkupng.com/assets/logo-jbH7uo1t.png" alt="Linkup Marketplace" height="38" style="height: 38px; width: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>

          <!-- Banner / Eyebrow -->
          <tr>
            <td align="center" style="padding: 24px 24px 0 24px;">
              <span style="display: inline-block; background-color: #FFF3EB; color: #E96E28; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 50px; border: 1px solid #FCD4BE;">
                ✨ New Product Alert
              </span>
              <h1 style="margin: 14px 0 6px 0; color: #111827; font-size: 22px; font-weight: 800; line-height: 28px;">
                Fresh In The Marketplace!
              </h1>
              <p style="margin: 0; color: #6B7280; font-size: 14px;">
                Hi ${buyerName}, check out this exciting new item just listed on Linkup.
              </p>
            </td>
          </tr>

          <!-- Product Card Container -->
          <tr>
            <td class="content-inner" style="padding: 24px 32px 32px 32px;">
              <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                
                <!-- Product Image -->
                <div style="width: 100%; height: 260px; max-height: 280px; overflow: hidden; background-color: #F3F4F6; text-align: center;">
                  <a href="${productUrl}" target="_blank">
                    <img src="${mainImage}" alt="${productTitle}" style="width: 100%; height: 260px; object-fit: cover; display: block; border: 0;" />
                  </a>
                </div>

                <!-- Product Details -->
                <div style="padding: 20px 22px;">
                  <div style="display: inline-block; background-color: #F3F4F6; color: #4B5563; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; margin-bottom: 8px;">
                    ${category}
                  </div>

                  <h2 style="margin: 0 0 10px 0; color: #111827; font-size: 20px; font-weight: 800; line-height: 26px;">
                    <a href="${productUrl}" target="_blank" style="color: #111827; text-decoration: none;">
                      ${productTitle}
                    </a>
                  </h2>

                  <div style="margin-bottom: 14px;">
                    <span style="color: #E96E28; font-size: 24px; font-weight: 900; letter-spacing: -0.02em;">
                      ${formattedPrice}
                    </span>
                    <span style="color: #9CA3AF; font-size: 13px; font-weight: 500; margin-left: 8px;">
                      • Sold by ${sellerName}
                    </span>
                  </div>

                  ${truncatedDesc ? `
                  <p style="margin: 0 0 20px 0; color: #4B5563; font-size: 14px; line-height: 22px;">
                    ${truncatedDesc}
                  </p>` : ""}

                  <!-- CTA Button -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td align="center" style="border-radius: 10px; background-color: #E96E28; box-shadow: 0 4px 14px rgba(233,110,40,0.35);">
                        <a href="${productUrl}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; padding: 14px 20px; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 10px; text-align: center;">
                          View Product & Buy Now &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #F3F4F6;">
                    <p style="margin: 0; color: #6B7280; font-size: 13px; line-height: 20px;">
                      Happy shopping,<br/>
                      <strong style="color: #111827;">Damian from Linkup Marketplace</strong>
                    </p>
                  </div>

                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 28px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
              <img src="https://www.linkupng.com/assets/logo-jbH7uo1t.png" alt="Linkup" height="28" style="height: 28px; opacity: 0.85; margin-bottom: 10px;" />
              <p style="margin: 0 0 6px 0; color: #6B7280; font-size: 12px;">
                You received this new product drop notification because you are a registered buyer on Linkup.
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 11px;">
                &copy; ${new Date().getFullYear()} Linkup Marketplace. Nigeria's Community Marketplace.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // 4. Send via Resend in batches
    let successCount = 0;
    let failureCount = 0;
    const batchSize = 50;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const chunk = recipients.slice(i, i + batchSize);
      const emailPayloads = chunk.map((r) => ({
        from: "Damian from Linkup Marketplace <support@linkupng.com>",
        to: r.email,
        subject: emailSubject,
        html: generateProductEmailHtml(r.name || "Valued Shopper"),
      }));

      try {
        const resendResponse = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailPayloads),
        });

        if (resendResponse.ok) {
          const resendData = await resendResponse.json();
          successCount += Array.isArray(resendData.data) ? resendData.data.length : chunk.length;
        } else {
          const errText = await resendResponse.text();
          console.error(`Resend batch send error for product notification chunk ${i}:`, errText);
          failureCount += chunk.length;
        }
      } catch (err: any) {
        console.error(`Error sending product email batch ${i}:`, err.message);
        failureCount += chunk.length;
      }
    }

    console.log(`Product email broadcast finished: ${successCount} sent, ${failureCount} failed.`);

    return new Response(JSON.stringify({
      success: true,
      product_id: productId,
      recipients_count: recipients.length,
      success_count: successCount,
      failure_count: failureCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("Error in new-product-email edge function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
