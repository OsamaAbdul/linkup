-- Create a trigger that calls the send-email-notification edge function
-- whenever a new notification is inserted into the notifications table.

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function using pg_net
CREATE OR REPLACE FUNCTION "public"."send_email_webhook"()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://drvoljuaqmehmpbylcqs.supabase.co/functions/v1/send-email-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydm9sanVhcW1laG1wYnlsY3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTcwNjQsImV4cCI6MjA5NzE5MzA2NH0.-aFg1w4WKNfiuLRXkyat3gWRxjL_fXcxHLgtpFlCLdo"}'::jsonb,
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to ensure idempotency
DROP TRIGGER IF EXISTS "send_email_on_notification" ON "public"."notifications";

-- Create the trigger
CREATE TRIGGER "send_email_on_notification"
  AFTER INSERT ON "public"."notifications"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."send_email_webhook"();
