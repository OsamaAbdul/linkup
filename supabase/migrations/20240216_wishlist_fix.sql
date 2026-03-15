-- Fix RLS for Likes (Wishlist)
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users view own likes" ON public.likes;
DROP POLICY IF EXISTS "Users insert own likes" ON public.likes;
DROP POLICY IF EXISTS "Users delete own likes" ON public.likes;

-- Create Policies
CREATE POLICY "Users view own likes" ON public.likes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own likes" ON public.likes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own likes" ON public.likes
FOR DELETE USING (auth.uid() = user_id);
