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
    const payload = await req.json();
    console.log("Webhook payload received:", JSON.stringify(payload, null, 2));

    // Ensure it's an INSERT operation
    if (payload.type !== "INSERT" || !payload.record) {
      return new Response(JSON.stringify({ message: "Not an INSERT operation. Skipping." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { user_id, message, type } = payload.record;

    if (!user_id) {
      throw new Error("No user_id found in the notification record.");
    }

    // Initialize Supabase admin client
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user's email address
    // We try to get it from auth.users first, fallback to public.profiles
    const { data: userAuth, error: authError } = await adminClient.auth.admin.getUserById(user_id);
    let targetEmail = userAuth?.user?.email;

    if (!targetEmail) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", user_id)
        .maybeSingle();

      targetEmail = profile?.email;
    }

    if (!targetEmail) {
      console.log(`No valid email found for user ${user_id}. Skipping email notification.`);
      return new Response(JSON.stringify({ message: "No valid email found. Skipped." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get Resend API Key
    // @ts-ignore
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set.");
    }

    console.log(`Sending email to ${targetEmail} for notification type: ${type}`);

    // Send email using Resend REST API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Linkup Notifications <support@linkupng.com>",
        to: targetEmail,
        subject: `New Notification: ${type || 'Alert'}`,
        html: `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>New Notification - Linkup</title>

  <style>
    /* Responsive styles */
    @media only screen and (max-width: 620px) {
      .email-wrapper {
        padding: 20px 12px !important;
      }

      .email-container {
        width: 100% !important;
        border-radius: 12px !important;
      }

      .content {
        padding: 32px 22px !important;
      }

      .footer {
        padding: 22px !important;
      }

      .hero-image {
        width: 72% !important;
        max-width: 280px !important;
      }

      .title {
        font-size: 23px !important;
        line-height: 1.3 !important;
      }

      .notification-card {
        padding: 20px !important;
      }

      .cta-button {
        width: 100% !important;
      }

      .cta-button a {
        display: block !important;
        padding: 15px 20px !important;
      }
    }

    @media only screen and (max-width: 420px) {
      .content {
        padding: 28px 18px !important;
      }

      .brand-bar {
        padding: 22px 18px !important;
      }

      .hero-image {
        width: 80% !important;
      }
    }
  </style>
</head>

<body
  style="margin:0; padding:0; width:100%; background-color:#F4F6F8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#17202A;">

  <!-- Preheader -->
  <div
    style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; visibility:hidden; mso-hide:all;">
    ${message}
  </div>

  <!-- Outer Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="width:100%; background-color:#F4F6F8;">

    <tr>
      <td align="center" class="email-wrapper" style="padding:42px 20px;">

        <!-- Email Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-container"
          style="width:100%; max-width:620px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E4E7EB; box-shadow:0 8px 30px rgba(23,32,42,0.07);">

          <!-- ========================= -->
          <!-- MAIN CONTENT -->
          <!-- ========================= -->
          <tr>
            <td class="content"
              style="padding:42px 48px 44px 48px; background-image: linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url('https://www.linkupng.com/assets/logo-jbH7uo1t.png'); background-repeat: no-repeat; background-position: center; background-size: 300px;">

              <!-- Hero Image -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 30px 0;">

                    <img src="https://www.linkupng.com/public/order.png" alt="Order notification" class="hero-image"
                      width="280"
                      style="width:280px; max-width:72%; height:auto; display:block; margin:0 auto; border:0; outline:none; border-radius:12px;">

                  </td>
                </tr>
              </table>

              <!-- Eyebrow -->
              <p
                style="margin:0 0 10px 0; color:#E96E28; font-size:13px; line-height:20px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-align:center;">
                Order Update
              </p>

              <!-- Main Title -->
              <h1 class="title"
                style="margin:0 0 28px 0; color:#17202A; font-size:28px; line-height:36px; font-weight:700; letter-spacing:-0.025em; text-align:center;">
                You have a new notification
              </h1>

              <!-- Notification Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                style="width:100%; background-color:#FFF8F4; border:1px solid #F2C7B0; border-radius:12px;">

                <tr>
                  <td class="notification-card" style="padding:24px 26px;">

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                      <tr>
                        <td
                          style="width:4px; background-color:#E96E28; border-radius:4px; font-size:1px; line-height:1px;">
                          &nbsp;
                        </td>

                        <td style="padding-left:18px;">

                          <p
                            style="margin:0 0 7px 0; color:#66717D; font-size:12px; line-height:18px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase;">
                            Shipment Status
                          </p>

                          <p style="margin:0; color:#17202A; font-size:16px; line-height:26px; font-weight:600;">
                            ${message}
                          </p>

                        </td>
                      </tr>

                    </table>

                  </td>
                </tr>

              </table>

              <!-- Supporting Text -->
              <p style="margin:28px 0 0 0; color:#4B5563; font-size:15px; line-height:25px; text-align:center;">
                Please log in to your dashboard to view more details and manage your account.
              </p>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
                style="margin:30px auto 0 auto;">

                <tr>
                  <td class="cta-button" align="center"
                    style="border-radius:8px; background-color:#E96E28; box-shadow:0 4px 12px rgba(233,110,40,0.22);">

                    <a href="https://linkupng.com/dashboard" target="_blank"
                      style="display:inline-block; padding:15px 30px; color:#FFFFFF; text-decoration:none; font-size:15px; line-height:20px; font-weight:700; border-radius:8px;">
                      View Dashboard
                      <span style="padding-left:5px;">→</span>
                    </a>

                  </td>
                </tr>

              </table>

              <!-- Informative Subtext -->
              <p style="margin:22px 0 0 0; color:#8A939D; font-size:12px; line-height:19px; text-align:center;">
                You can review your order details, track updates, and manage your account from your dashboard.
              </p>

            </td>
          </tr>

          <!-- ========================= -->
          <!-- FOOTER -->
          <!-- ========================= -->
          <tr>
            <td class="footer"
              style="padding:25px 40px; background-color:#F8F9FA; border-top:1px solid #E7EAED; text-align:center;">

              <img src="https://www.linkupng.com/assets/logo-jbH7uo1t.png" width="auto" height="40"
                alt="Linkup Marketplace"
                style="height:40px; max-height:40px; width:auto; display:inline-block; border:0; outline:none; text-decoration:none; margin-bottom:12px;">

              <p style="margin:0; color:#8A939D; font-size:12px; line-height:19px;">
                This is an automated message from <strong>Linkup Marketplace</strong>.<br>
                Please do not reply directly to this email.
              </p>

            </td>
          </tr>

        </table>

        <!-- Bottom Brand Text -->
        <p style="margin:18px 0 0 0; color:#9AA2AA; font-size:11px; line-height:17px; text-align:center;">
          © Linkup Marketplace. All rights reserved.
        </p>

      </td>
    </tr>

  </table>

</body>

</html>`,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      throw new Error(`Resend API Error: ${errorText}`);
    }

    const resendData = await resendResponse.json();
    console.log("Email sent successfully:", resendData);

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in send-email-notification:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
