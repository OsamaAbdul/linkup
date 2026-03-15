
-- Fix overly permissive RLS policies
DROP POLICY "Sellers can insert categories" ON public.categories;
CREATE POLICY "Authenticated can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'seller'));

DROP POLICY "Authenticated can insert shipments" ON public.shipments;
CREATE POLICY "Sellers can insert shipments" ON public.shipments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'seller'));
