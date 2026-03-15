-- MIGRATION: 20260302_enable_likes_realtime
-- Enables Supabase Realtime for the likes table to allow instant wishlist updates.

BEGIN;
  -- Add the likes table to the realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
COMMIT;
