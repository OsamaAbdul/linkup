-- MIGRATION: 20260227_fix_shipment_schema
-- Ensures shipments table is consistent and has required columns for the hyperlocal flow.

-- 1. Ensure seller_id and zone exist with proper types/refs
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS zone public.abuja_zone,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

-- 2. Ensure delivery_address and pickup_address are JSONB (they should be, but let's be sure)
-- No changes needed if already JSONB, but let's ensure they aren't TEXT by accident in some schemas
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipments' AND column_name = 'delivery_address' AND data_type = 'text'
    ) THEN
        ALTER TABLE public.shipments ALTER COLUMN delivery_address TYPE JSONB USING delivery_address::JSONB;
        ALTER TABLE public.shipments ALTER COLUMN pickup_address TYPE JSONB USING pickup_address::JSONB;
    END IF;
END $$;

-- 3. Ensure orders table uses 'total' column consistently
DO $$ 
BEGIN
    -- If 'total_amount' exists but 'total' doesn't, rename it (scalability overhaul fallback)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total') THEN
        ALTER TABLE public.orders RENAME COLUMN total_amount TO total;
    END IF;
END $$;

-- 4. Add index for seller_id on shipments
CREATE INDEX IF NOT EXISTS idx_shipments_seller_id ON public.shipments(seller_id);
CREATE INDEX IF NOT EXISTS idx_shipments_zone ON public.shipments(zone);

-- 5. RLS Fix: Allow sellers to create shipments for their orders
DROP POLICY IF EXISTS "Sellers can create shipments for their orders" ON public.shipments;
CREATE POLICY "Sellers can create shipments for their orders"
ON public.shipments FOR INSERT
WITH CHECK (
  auth.uid() = seller_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'seller'
  )
);

-- Allow sellers to view the shipments they created (redundant if SELECT policy is already broad but safer)
DROP POLICY IF EXISTS "Sellers can view their shipments" ON public.shipments;
CREATE POLICY "Sellers can view their shipments"
ON public.shipments FOR SELECT
USING (seller_id = auth.uid());
