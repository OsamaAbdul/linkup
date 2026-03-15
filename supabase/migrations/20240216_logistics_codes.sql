-- Add verification codes to shipments table
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS pickup_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6),
ADD COLUMN IF NOT EXISTS delivery_code TEXT DEFAULT substring(md5(random()::text) from 1 for 6);

-- Comment
COMMENT ON COLUMN public.shipments.pickup_code IS 'Code rider needs from seller to confirm pickup';
COMMENT ON COLUMN public.shipments.delivery_code IS 'Code rider needs from buyer to confirm delivery';
