-- Add missing columns to the issues table to support seller dashboard and product reporting

-- 1. Add product_id and seller_id
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Update RLS policies to allow sellers to view issues directed at them
CREATE POLICY "Sellers can view issues linked to their products or orders" ON public.issues
FOR SELECT USING (
  auth.uid() = seller_id OR
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = issues.order_id 
    AND orders.seller_id = auth.uid()
  )
);

-- 3. Add indices for performance
CREATE INDEX IF NOT EXISTS idx_issues_seller_id ON public.issues(seller_id);
CREATE INDEX IF NOT EXISTS idx_issues_product_id ON public.issues(product_id);
CREATE INDEX IF NOT EXISTS idx_issues_order_id ON public.issues(order_id);
