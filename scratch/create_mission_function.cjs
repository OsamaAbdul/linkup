const fs = require('fs');
const path = require('path');

const sourcePath = 'c:\\Users\\HomePC\\Desktop\\linkup-marketplace\\supabase\\functions\\send-email-notification\\index.ts';
const targetDir = 'c:\\Users\\HomePC\\Desktop\\linkup-marketplace\\supabase\\functions\\mission-accepted-email';
const targetPath = path.join(targetDir, 'index.ts');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

let sourceContent = fs.readFileSync(sourcePath, 'utf8');

const startMarker = '        html: `\n';
const endMarker = '`,\n      }),\n    });';

const startIndex = sourceContent.indexOf(startMarker);
const endIndex = sourceContent.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find HTML template in send-email-notification');
    process.exit(1);
}

let htmlTemplate = sourceContent.slice(startIndex + startMarker.length, endIndex);

const functionCode = `// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getEmailTemplate = (message: string) => \`
\${htmlTemplate}\`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Webhook payload received:", JSON.stringify(payload, null, 2));

    // We only care about UPDATE events on shipments where status becomes 'assigned'
    if (payload.type !== "UPDATE" || payload.table !== "shipments") {
      return new Response(JSON.stringify({ message: "Not a shipment update. Skipping." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { record, old_record } = payload;

    // Check if the status just changed to 'assigned'
    if (record.status !== 'assigned' || (old_record && old_record.status === 'assigned')) {
      console.log("Shipment status is not newly 'assigned'. Skipping.");
      return new Response(JSON.stringify({ message: "Not newly assigned. Skipped." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const orderId = record.order_id;
    const sellerId = record.seller_id;

    if (!orderId) {
      throw new Error("No order_id found in the shipment record.");
    }

    // Initialize Supabase admin client
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the order to get the buyer_id
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('buyer_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order?.buyer_id) {
      throw new Error(\`Failed to fetch order or buyer_id for order \${orderId}\`);
    }

    const buyerId = order.buyer_id;

    // Helper to get email by user ID
    const getEmailForUser = async (userId: string) => {
      const { data: userAuth } = await adminClient.auth.admin.getUserById(userId);
      let email = userAuth?.user?.email;

      if (!email) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("id", userId)
          .maybeSingle();
        email = profile?.email;
      }
      return email;
    };

    const buyerEmail = await getEmailForUser(buyerId);
    let sellerEmail = null;
    if (sellerId) {
      sellerEmail = await getEmailForUser(sellerId);
    }

    if (!buyerEmail && !sellerEmail) {
      console.log("No valid emails found for buyer or seller. Skipping.");
      return new Response(JSON.stringify({ message: "No valid emails found. Skipped." }), {
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

    const sendEmail = async (toEmail: string, subject: string, message: string) => {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${resendApiKey}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Linkup Notifications <support@linkupng.com>",
          to: toEmail,
          subject: subject,
          html: getEmailTemplate(message),
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error(\`Failed to send email to \${toEmail}: \${errorText}\`);
      } else {
        console.log(\`Successfully sent email to \${toEmail}\`);
      }
    };

    const buyerMessage = "A logistics agent has been assigned and is on their way to pick up your order.";
    const sellerMessage = "A logistics agent has been assigned and will arrive soon to pick up the order.";
    const emailSubject = "Logistics Agent Assigned - Linkup";

    const emailPromises = [];
    if (buyerEmail) {
      emailPromises.push(sendEmail(buyerEmail, emailSubject, buyerMessage));
    }
    if (sellerEmail) {
      emailPromises.push(sendEmail(sellerEmail, emailSubject, sellerMessage));
    }

    await Promise.all(emailPromises);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in mission-accepted-email:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
`;

fs.writeFileSync(targetPath, functionCode);
console.log('Successfully created mission-accepted-email/index.ts');
