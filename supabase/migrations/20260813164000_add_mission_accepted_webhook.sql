-- Create a trigger that calls the mission-accepted-email edge function
-- whenever a shipment status is updated to 'assigned'.

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the trigger function using pg_net
CREATE OR REPLACE FUNCTION "public"."mission_accepted_webhook"()
RETURNS trigger AS $$
BEGIN
  -- Only fire the webhook if the status changed to 'assigned'
  IF NEW.status = 'assigned' AND OLD.status IS DISTINCT FROM 'assigned' THEN
    PERFORM net.http_post(
      url := 'https://drvoljuaqmehmpbylcqs.supabase.co/functions/v1/mission-accepted-email',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydm9sanVhcW1laG1wYnlsY3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTcwNjQsImV4cCI6MjA5NzE5MzA2NH0.-aFg1w4WKNfiuLRXkyat3gWRxjL_fXcxHLgtpFlCLdo"}'::jsonb,
      body := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to ensure idempotency
DROP TRIGGER IF EXISTS "on_shipment_assigned_webhook" ON "public"."shipments";

-- Create the trigger
CREATE TRIGGER "on_shipment_assigned_webhook"
  AFTER UPDATE OF status ON "public"."shipments"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."mission_accepted_webhook"();
