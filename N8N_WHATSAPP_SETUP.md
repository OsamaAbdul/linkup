# Linkup Marketplace — n8n WhatsApp Notification Automation 📲

This workflow enables instant **WhatsApp notifications** whenever a new record is inserted into the `public.notifications` table in Supabase (orders, product alerts, delivery assignments, payouts, etc.).

---

## 🚀 How It Works

```
+---------------------------+        +----------------------------------------+
|   public.notifications    |  --->  |  notify_n8n_whatsapp_webhook()         |
|  (New INSERT Trigger)     |        |  (Fetches phone from profiles table)   |
+---------------------------+        +-------------------+--------------------+
                                                         |
                                                         | HTTP POST (pg_net)
                                                         v
                                     +----------------------------------------+
                                     |  n8n Webhook Node                      |
                                     |  /webhook/linkup-whatsapp-notifications|
                                     +-------------------+--------------------+
                                                         |
                                                         v
                                     +----------------------------------------+
                                     |  Code Node: Phone Sanitizer            |
                                     |  0803... -> 234803... (E.164)          |
                                     |  Formats category emojis & message     |
                                     +-------------------+--------------------+
                                                         |
                                                         v
                                     +----------------------------------------+
                                     |  WhatsApp Dispatch Node                |
                                     |  - Meta WhatsApp Business Cloud API    |
                                     |  - OR Twilio WhatsApp                  |
                                     |  - OR Custom Gateway (Evolution API)   |
                                     +-------------------+--------------------+
                                                         |
                                                         v
                                     +----------------------------------------+
                                     |  User receives WhatsApp message!       |
                                     +----------------------------------------+
```

---

## 📦 What We've Built

1. **`Linkup_WhatsApp_Notifications_Workflow.json`**:
   - Production-ready n8n workflow file ready to import.
   - Built-in Nigerian phone number formatting (`080/070/081/090...` to international `234...`).
   - Notification categorization (Order updates, payment/payout, delivery, new product drops, KYC).
   - Polished branding with sign-off: `Damian from Linkup Marketplace`.
   - Supports 3 WhatsApp provider options:
     - **WhatsApp Cloud API (Official Meta)** — default.
     - **Twilio WhatsApp** — plug & play alternative.
     - **Custom Gateway / Evolution API / Green API** — self-hosted alternative.

2. **`supabase/migrations/20260904130000_whatsapp_notifications_webhook.sql`**:
   - PostgreSQL trigger on `public.notifications`.
   - Automatically joins the recipient's phone number from `public.profiles` and sends it in the webhook payload.

---

## 🛠️ Setup Instructions

### Step 1: Import the Workflow into n8n
1. Open your **n8n instance** (e.g. `https://n8n.yourdomain.com` or local n8n).
2. Go to **Workflows** &rarr; click **Add Workflow** (or the **...** menu on top right) &rarr; select **Import from File**.
3. Choose the file: [`Linkup_WhatsApp_Notifications_Workflow.json`](file:///c:/Users/HomePC/Desktop/linkup-marketplace/Linkup_WhatsApp_Notifications_Workflow.json).
4. Save the workflow.

### Step 2: Configure Your WhatsApp Provider in n8n
Open the workflow in n8n and configure **one** of the WhatsApp nodes:

- **Option A (Meta WhatsApp Cloud API - Recommended)**:
  - Click the **WhatsApp Cloud API (Meta)** node.
  - Connect your Meta WhatsApp credentials (Phone Number ID, Access Token).
  - Activate the node.

- **Option B (Twilio WhatsApp)**:
  - If you use Twilio, disable Option A, enable the **Twilio WhatsApp** node, and connect your Twilio credentials.

- **Option C (Self-hosted Evolution API / Z-API / Green API)**:
  - Enable the **Custom Gateway** HTTP Request node and enter your gateway endpoint and API key.

### Step 3: Copy Your n8n Webhook URL
1. Click the first node: **Supabase Notifications Webhook**.
2. Copy the **Production URL** (e.g., `https://your-n8n.com/webhook/linkup-whatsapp-notifications`).
3. Toggle the workflow status to **Active**.

### Step 4: Update the Supabase Trigger URL
In [`supabase/migrations/20260904130000_whatsapp_notifications_webhook.sql`](file:///c:/Users/HomePC/Desktop/linkup-marketplace/supabase/migrations/20260904130000_whatsapp_notifications_webhook.sql), update the `v_n8n_url` variable with your real n8n webhook URL:
```sql
v_n8n_url TEXT := 'https://your-n8n.com/webhook/linkup-whatsapp-notifications';
```
Then apply the migration to your database using the Supabase SQL editor or CLI.
