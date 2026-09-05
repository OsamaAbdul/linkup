-- Migration: Connect Supabase notifications to n8n WhatsApp Workflow
-- Whenever a notification is inserted, this trigger passes the record and user profile (with phone number) to n8n.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function that forwards notifications + recipient phone to n8n webhook
CREATE OR REPLACE FUNCTION "public"."notify_n8n_whatsapp_webhook"()
RETURNS trigger AS $$
DECLARE
  v_phone TEXT;
  v_display_name TEXT;
  v_n8n_url TEXT := 'https://your-n8n-instance.com/webhook/linkup-whatsapp-notifications'; -- Replace with your active n8n Webhook URL
BEGIN
  -- 1. Fetch user's phone number & name from profiles
  SELECT phone, display_name 
  INTO v_phone, v_display_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- 2. Only dispatch if phone exists or let n8n handle the validation
  IF v_phone IS NOT NULL AND trim(v_phone) != '' THEN
    PERFORM net.http_post(
      url := v_n8n_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'profile', jsonb_build_object(
          'phone', v_phone,
          'display_name', v_display_name
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists for idempotency
DROP TRIGGER IF EXISTS "send_whatsapp_on_notification" ON "public"."notifications";

-- Create trigger on notifications table
CREATE TRIGGER "send_whatsapp_on_notification"
  AFTER INSERT ON "public"."notifications"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."notify_n8n_whatsapp_webhook"();
