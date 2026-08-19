// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting map (IP -> Timestamp)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60000; // 60 seconds

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting Check
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip) || 0;

  if (now - lastRequest < RATE_LIMIT_MS) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute before trying again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 429,
    });
  }
  rateLimitMap.set(ip, now);

  try {
    const payload = await req.json();
    console.log("Password Reset Request received for:", payload.email);

    const { email, origin } = payload;

    if (!email) {
      throw new Error("No email provided.");
    }

    // Initialize Supabase admin client
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get Resend API Key
    // @ts-ignore
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set.");
    }

    // 1. Generate the recovery link using Supabase Admin API
    // If the request comes from localhost, we let it redirect to localhost for local testing.
    // Otherwise, we ensure it uses the production URL.
    const isLocalhost = origin?.includes("localhost") || origin?.includes("127.0.0.1");
    const baseUrl = isLocalhost ? origin : "https://linkupng.com";
    const redirectTo = `${baseUrl}/reset-password`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: { redirectTo },
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      throw new Error(linkError.message);
    }

    const actionLink = linkData.properties.action_link;

    // 2. Send email using Resend REST API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Linkup <support@linkupng.com>",
        to: email,
        subject: "Reset your Linkup password",
        html: `
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Reset Password - Linkup</title>

  <style>
    /* Responsive styles */
    @media only screen and (max-width: 620px) {
      .email-wrapper { padding: 20px 12px !important; }
      .email-container { width: 100% !important; border-radius: 12px !important; }
      .content { padding: 32px 22px !important; }
      .footer { padding: 22px !important; }
      .hero-image { width: 72% !important; max-width: 280px !important; }
      .title { font-size: 23px !important; line-height: 1.3 !important; }
      .notification-card { padding: 20px !important; }
      .cta-button { width: 100% !important; }
      .cta-button a { display: block !important; padding: 15px 20px !important; }
    }
    @media only screen and (max-width: 420px) {
      .content { padding: 28px 18px !important; }
      .brand-bar { padding: 22px 18px !important; }
      .hero-image { width: 80% !important; }
    }
  </style>
</head>

<body style="margin:0; padding:0; width:100%; background-color:#F4F6F8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#17202A;">

  <!-- Preheader -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; visibility:hidden; mso-hide:all;">
    Click the link to reset your Linkup password.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#F4F6F8;">
    <tr>
      <td align="center" class="email-wrapper" style="padding:42px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-container"
          style="width:100%; max-width:620px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E4E7EB; box-shadow:0 8px 30px rgba(23,32,42,0.07);">
          <tr>
            <td class="content"
              style="padding:42px 48px 44px 48px; background-image: linear-gradient(rgba(255,255,255,0.95), rgba(255,255,255,0.95)), url('https://www.linkupng.com/assets/logo-jbH7uo1t.png'); background-repeat: no-repeat; background-position: center; background-size: 300px;">
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 30px 0;">
                    <img src="https://www.linkupng.com/assets/logo-jbH7uo1t.png" alt="Linkup Logo" class="hero-image"
                      width="180" style="width:180px; max-width:60%; height:auto; display:block; margin:0 auto; border:0; outline:none;">
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px 0; color:#E96E28; font-size:13px; line-height:20px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-align:center;">
                Account Security
              </p>

              <h1 class="title" style="margin:0 0 28px 0; color:#17202A; font-size:28px; line-height:36px; font-weight:700; letter-spacing:-0.025em; text-align:center;">
                Reset Your Password
              </h1>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background-color:#FFF8F4; border:1px solid #F2C7B0; border-radius:12px;">
                <tr>
                  <td class="notification-card" style="padding:24px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width:4px; background-color:#E96E28; border-radius:4px; font-size:1px; line-height:1px;">&nbsp;</td>
                        <td style="padding-left:18px;">
                          <p style="margin:0 0 7px 0; color:#66717D; font-size:12px; line-height:18px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase;">
                            Action Required
                          </p>
                          <p style="margin:0; color:#17202A; font-size:15px; line-height:24px; font-weight:500;">
                            Oops! We are sorry that you forgot your password. Click the button below to choose a new one. If you did not make this request, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:30px auto 0 auto;">
                <tr>
                  <td class="cta-button" align="center" style="border-radius:8px; background-color:#E96E28; box-shadow:0 4px 12px rgba(233,110,40,0.22);">
                    <a href="${actionLink}" target="_blank"
                      style="display:inline-block; padding:15px 30px; color:#FFFFFF; text-decoration:none; font-size:15px; line-height:20px; font-weight:700; border-radius:8px;">
                      Reset Password
                      <span style="padding-left:5px;">→</span>
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 0 0; color:#8A939D; font-size:12px; line-height:19px; text-align:center; word-break: break-all;">
                Or copy and paste this link into your browser:<br>
                <a href="${actionLink}" style="color:#E96E28;">${actionLink}</a>
              </p>

            </td>
          </tr>

          <tr>
            <td class="footer" style="padding:25px 40px; background-color:#F8F9FA; border-top:1px solid #E7EAED; text-align:center;">
              <p style="margin:0; color:#8A939D; font-size:12px; line-height:19px;">
                This is an automated message from <strong>Linkup Marketplace</strong>.<br>
                Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>

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
    console.error("Error in request-password-reset:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
