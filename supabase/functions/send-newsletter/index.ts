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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not set.");
    }
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set.");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Authenticate calling admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Verify admin role
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // 2. Parse request body
    const body = await req.json();
    const {
      title,
      subject,
      preheader = "",
      content,
      target_audience = "all", // 'all' | 'buyers' | 'sellers' | 'logistics' | 'test'
      test_email = "",
      cta_text = "",
      cta_url = "",
      banner_image_url = "",
      campaign_id = null
    } = body;

    if (!subject || !content) {
      return new Response(JSON.stringify({ error: "Subject and content are required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 3. Resolve recipient email list
    interface Recipient {
      id?: string;
      email: string;
      name?: string;
    }

    const recipientsMap = new Map<string, Recipient>();

    if (target_audience === "test") {
      const targetTestEmail = test_email.trim() || user.email;
      if (!targetTestEmail) {
        throw new Error("No test email address provided.");
      }
      recipientsMap.set(targetTestEmail.toLowerCase(), {
        email: targetTestEmail,
        name: "Admin Tester"
      });
    } else {
      // Fetch all auth users
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

      // Fetch profiles to get display names
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, display_name, email");

      const profileMap = new Map<string, any>();
      profiles?.forEach((p: any) => profileMap.set(p.id, p));

      // Fetch user roles
      const { data: userRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role");

      const rolesByUser = new Map<string, string[]>();
      userRoles?.forEach((r: any) => {
        if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
        rolesByUser.get(r.user_id)!.push(r.role);
      });

      for (const u of allAuthUsers) {
        if (!u.email) continue;
        const email = u.email.trim().toLowerCase();
        const profile = profileMap.get(u.id);
        const name = profile?.display_name || u.user_metadata?.display_name || "Valued Member";
        const roles = rolesByUser.get(u.id) || [];

        let matchesAudience = false;
        if (target_audience === "all") {
          matchesAudience = true;
        } else if (target_audience === "buyers") {
          // Buyer if role includes buyer OR user has no specific seller/logistics role
          matchesAudience = roles.includes("buyer") || (roles.length === 0 && !roles.includes("seller") && !roles.includes("logistics"));
        } else if (target_audience === "sellers") {
          matchesAudience = roles.includes("seller");
        } else if (target_audience === "logistics") {
          matchesAudience = roles.includes("logistics");
        }

        if (matchesAudience) {
          recipientsMap.set(email, {
            id: u.id,
            email: u.email,
            name: name
          });
        }
      }
    }

    const recipients = Array.from(recipientsMap.values());
    console.log(`Found ${recipients.length} recipients for audience: ${target_audience}`);

    if (recipients.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "No valid recipients found for this audience.",
        recipients_count: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 4. Generate HTML email body
    const generateHtml = (recipientName: string) => {
      // Format content line breaks into paragraphs
      const formattedContent = content
        .split("\n\n")
        .map((para: string) => `<p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 26px;">${para.replace(/\n/g, "<br/>")}</p>`)
        .join("");

      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; width: 100%; background-color: #F4F6F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 25px rgba(0,0,0,0.05); }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 30px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #F4F6F8;">
  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; visibility:hidden; mso-hide:all;">${preheader}</div>` : ""}

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F4F6F8;">
    <tr>
      <td align="center" style="padding: 16px 12px;">
        <table role="presentation" width="100%" class="email-container" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB;">
          
          <!-- Header Bar with Logo -->
          <tr>
            <td align="center" style="padding: 28px 24px; background: linear-gradient(135deg, #111827 0%, #1F2937 100%);">
              <a href="https://www.linkupng.com" target="_blank" style="text-decoration: none;">
                <img src="https://www.linkupng.com/assets/logo-jbH7uo1t.png" alt="Linkup Marketplace" height="42" style="height: 42px; width: auto; display: block; border: 0;" />
              </a>
            </td>
          </tr>

          ${banner_image_url ? `
          <!-- Optional Banner Image -->
          <tr>
            <td align="center" style="padding: 0;">
              <img src="${banner_image_url}" alt="${title || subject}" style="width: 100%; max-height: 280px; object-fit: cover; display: block; border: 0;" />
            </td>
          </tr>
          ` : ""}

          <!-- Main Content Area -->
          <tr>
            <td class="content-cell" style="padding: 40px 36px;">
              ${title ? `
              <h1 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: 800; line-height: 32px; letter-spacing: -0.02em;">
                ${title}
              </h1>` : ""}

              <p style="margin: 0 0 18px 0; color: #6B7280; font-size: 14px; font-weight: 600;">
                Hello ${recipientName},
              </p>

              <div style="color: #374151; font-size: 16px; line-height: 26px;">
                ${formattedContent}
              </div>

              ${cta_text && cta_url ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #E96E28; box-shadow: 0 4px 14px rgba(233,110,40,0.3);">
                    <a href="${cta_url}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 10px; letter-spacing: 0.02em;">
                      ${cta_text} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}

              <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #F3F4F6;">
                <p style="margin: 0; color: #6B7280; font-size: 13px; line-height: 20px;">
                  Warm regards,<br/>
                  <strong style="color: #111827;">Damian from Linkupng Marketplace</strong>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 32px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 12px; line-height: 18px;">
                You are receiving this communication as a registered member of Linkup Marketplace.
              </p>
              <p style="margin: 0; color: #9CA3AF; font-size: 11px; line-height: 16px;">
                &copy; ${new Date().getFullYear()} Linkup Marketplace. All rights reserved.<br/>
                Nigeria's Community Marketplace.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    };

    // 5. Send via Resend Batch API
    let successCount = 0;
    let failureCount = 0;
    const batchSize = 50; // Resend allows up to 100 per batch call

    for (let i = 0; i < recipients.length; i += batchSize) {
      const chunk = recipients.slice(i, i + batchSize);
      const emailPayloads = chunk.map((r) => ({
        from: "Damian from Linkup Marketplace <support@linkupng.com>",
        to: r.email,
        subject: subject,
        html: generateHtml(r.name || "Member"),
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
          console.error(`Resend batch send error for chunk ${i}:`, errText);
          failureCount += chunk.length;
        }
      } catch (err: any) {
        console.error(`Error sending batch ${i}:`, err.message);
        failureCount += chunk.length;
      }
    }

    // 6. Record Campaign in Database
    let savedCampaign = null;
    if (target_audience !== "test") {
      const campaignRecord = {
        title: title || subject,
        subject,
        preheader,
        content,
        target_audience,
        cta_text,
        cta_url,
        banner_image_url,
        status: successCount > 0 ? "sent" : "failed",
        sent_by: user.id,
        recipients_count: recipients.length,
        success_count: successCount,
        failure_count: failureCount,
        sent_at: new Date().toISOString(),
        metadata: {
          sent_by_email: user.email,
          batch_size: batchSize,
        }
      };

      if (campaign_id) {
        const { data, error } = await adminClient
          .from("newsletter_campaigns")
          .update(campaignRecord)
          .eq("id", campaign_id)
          .select()
          .single();
        if (!error) savedCampaign = data;
      } else {
        const { data, error } = await adminClient
          .from("newsletter_campaigns")
          .insert(campaignRecord)
          .select()
          .single();
        if (!error) savedCampaign = data;
      }
    }

    return new Response(JSON.stringify({
      success: successCount > 0,
      recipients_count: recipients.length,
      success_count: successCount,
      failure_count: failureCount,
      campaign: savedCampaign,
      message: `Successfully dispatched to ${successCount} recipients.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("Error in send-newsletter edge function:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
