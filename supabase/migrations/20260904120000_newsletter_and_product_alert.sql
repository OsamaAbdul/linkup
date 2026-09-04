-- Migration: Newsletter Campaigns and New Product Email Trigger
-- Date: 2026-09-04

-- 1. Create newsletter_campaigns table
CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    preheader TEXT,
    content TEXT NOT NULL,
    target_audience TEXT NOT NULL DEFAULT 'all', -- 'all', 'buyers', 'sellers', 'logistics'
    cta_text TEXT,
    cta_url TEXT,
    banner_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
    sent_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipients_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

-- Admins full access policy
DROP POLICY IF EXISTS "Admins can manage newsletter campaigns" ON public.newsletter_campaigns;
CREATE POLICY "Admins can manage newsletter campaigns"
    ON public.newsletter_campaigns
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Trigger function for new product listings
CREATE OR REPLACE FUNCTION "public"."notify_new_product_email_webhook"()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://drvoljuaqmehmpbylcqs.supabase.co/functions/v1/new-product-email',
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

-- Drop trigger if already exists for idempotency
DROP TRIGGER IF EXISTS "on_product_created_email_trigger" ON "public"."products";

-- Create trigger on products table
CREATE TRIGGER "on_product_created_email_trigger"
  AFTER INSERT ON "public"."products"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."notify_new_product_email_webhook"();
