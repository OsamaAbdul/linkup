DROP POLICY IF EXISTS "Users view own promoter code" ON public.promoter_codes;
CREATE POLICY "Anyone can view promoter codes" ON public.promoter_codes FOR SELECT USING (true);
