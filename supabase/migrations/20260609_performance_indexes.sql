-- ============================================================
-- Migration: 20260609_performance_indexes.sql
-- Purpose:   Add all missing indexes to prevent Postgres 57014
--            statement timeout errors on critical query paths.
-- ============================================================

-- ── cart_items ───────────────────────────────────────────────
-- Filters by user_id on every cart load
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id
  ON public.cart_items (user_id);

-- Joins/filters on product_id when fetching cart with product info
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id
  ON public.cart_items (product_id);

-- ── products ─────────────────────────────────────────────────
-- ORDER BY created_at DESC is used everywhere in listing queries
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc
  ON public.products (created_at DESC);

-- category filter used in search, get_nearby_products, etc.
CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products (category);

-- seller_id filter used heavily in seller dashboard
CREATE INDEX IF NOT EXISTS idx_products_seller_id
  ON public.products (seller_id);

-- inventory > 0 is a very common filter across all product views
CREATE INDEX IF NOT EXISTS idx_products_inventory
  ON public.products (inventory)
  WHERE inventory > 0;

-- ── notifications ────────────────────────────────────────────
-- user_id + read composite index: used in Header (unread count)
-- and Notifications page simultaneously
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read
  ON public.notifications (user_id, read);

-- ORDER BY created_at DESC in Notifications page
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc
  ON public.notifications (created_at DESC);

-- ── profiles ─────────────────────────────────────────────────
-- user_id is the FK used in almost every profile lookup
-- (primary key is id, but lookups use user_id filter)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

-- ── likes (wishlist) ─────────────────────────────────────────
-- user_id filter for wishlist page
CREATE INDEX IF NOT EXISTS idx_likes_user_id
  ON public.likes (user_id);

-- product_id used to check if a product is liked by user
CREATE INDEX IF NOT EXISTS idx_likes_product_id
  ON public.likes (product_id);

-- ── commissions ──────────────────────────────────────────────
-- promoter_id filter on promoter dashboard
CREATE INDEX IF NOT EXISTS idx_commissions_promoter_id
  ON public.commissions (promoter_id);

-- ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_commissions_created_at_desc
  ON public.commissions (created_at DESC);

-- ── referrals ────────────────────────────────────────────────
-- promoter_id filter on promoter dashboard
CREATE INDEX IF NOT EXISTS idx_referrals_promoter_id
  ON public.referrals (promoter_id);

-- ── payout_requests ──────────────────────────────────────────
-- user_id filter for wallet tab & payout modal
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id
  ON public.payout_requests (user_id);

-- ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at_desc
  ON public.payout_requests (created_at DESC);

-- ── wallet_transactions ──────────────────────────────────────
-- wallet_id filter (used in WalletTab, seller dashboard)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON public.wallet_transactions (wallet_id);

-- ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at_desc
  ON public.wallet_transactions (created_at DESC);

-- ── orders ───────────────────────────────────────────────────
-- buyer_id filter for Orders page
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id
  ON public.orders (buyer_id);

-- seller_id + status composite for pending counts
CREATE INDEX IF NOT EXISTS idx_orders_seller_id_status
  ON public.orders (seller_id, status);

-- ── shipments ────────────────────────────────────────────────
-- rider_id is already in 20260406 but ensuring idempotency
CREATE INDEX IF NOT EXISTS idx_shipments_rider_id
  ON public.shipments (rider_id);

-- ── issues ───────────────────────────────────────────────────
-- seller_id filter on IssuesTab
CREATE INDEX IF NOT EXISTS idx_issues_seller_id
  ON public.issues (seller_id);
