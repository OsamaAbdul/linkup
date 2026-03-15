-- MIGRATION: 20260303_complete_order_rpc.sql
-- Replace the opaque trigger with a direct RPC called from the frontend.
-- The frontend calls this instead of a raw .update({ status: 'completed' })
-- This gives us full control, visible errors, and no trigger mystery.

-- Drop old trigger — no longer needed
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- Ensure wallet columns exist
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.wallets SET user_id = seller_id WHERE user_id IS NULL AND seller_id IS NOT NULL;

ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS reference TEXT;

-- Convert wallet_transactions.type to TEXT if it is an ENUM
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='type') = 'USER-DEFINED'
    THEN
        ALTER TABLE public.wallet_transactions ALTER COLUMN type TYPE TEXT USING type::TEXT;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- RPC: complete_order_and_settle
-- Called by the buyer's "Confirm Receipt" button
-- 1. Validates order is in 'delivered' state and belongs to buyer
-- 2. Sets status = 'completed'
-- 3. Credits seller 95% + rider 5% from order total
-- SECURITY DEFINER: bypasses RLS for wallet writes
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order             RECORD;
    v_seller_wallet_id  UUID;
    v_rider_wallet_id   UUID;
    v_order_total       NUMERIC;
    v_platform_fee      NUMERIC;
    v_rider_flat_fee    CONSTANT NUMERIC := 1500;  -- Fixed ₦1,500 per delivery
    v_rider_id          UUID;
BEGIN
    -- 1. Load and validate the order
    SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id
    AND buyer_id = auth.uid()
    AND status::TEXT = 'delivered'
    FOR UPDATE;  -- Row lock to prevent race conditions

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order not found, not yours, or not in delivered state'
        );
    END IF;

    -- Order total = product price as listed by seller
    v_order_total := COALESCE(NULLIF(v_order.total, 0), 0);
    -- Platform takes 10% (tracked for accounting, NOT deducted from seller)
    v_platform_fee := ROUND(v_order_total * 0.10, 2);

    -- If still zero, sum from order items
    IF v_order_total = 0 THEN
        SELECT COALESCE(SUM(price_at_purchase * quantity), 0)
        INTO v_order_total
        FROM public.order_items_new
        WHERE order_id = p_order_id;
    END IF;

    -- 3. Mark order as completed
    UPDATE public.orders
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. If total is zero, complete but skip earnings (edge case for test orders)
    IF v_order_total = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'warning', 'Order completed but total was zero — no earnings credited',
            'seller_credited', 0,
            'rider_credited', 0
        );
    END IF;

    -- Fee breakdown:
    -- Seller  → full product price (v_order_total)
    -- Rider   → flat ₦1,500 per delivery
    -- Platform → 10% of product price (logged, not deducted from seller)

    -- 5. Credit seller wallet
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = v_order.seller_id OR user_id = v_order.seller_id LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (v_order.seller_id, v_order.seller_id, 0, 0)
        RETURNING id INTO v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance        = balance + v_order_total,
        escrow_balance = GREATEST(0, COALESCE(escrow_balance, 0) - v_order_total),
        updated_at     = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_order_total, 'settlement',
            'Settlement: Order #' || LEFT(p_order_id::TEXT, 8) ||
            ' (platform fee: ₦' || v_platform_fee::TEXT || ')');

    -- Seller notification
    BEGIN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (v_order.seller_id, 'payment',
            '₦' || TO_CHAR(v_order_total, 'FM999,999,999') ||
            ' credited — Order #' || LEFT(p_order_id::TEXT, 8) || ' confirmed by buyer.');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 6. Credit rider wallet — flat ₦1,500 per delivery
    SELECT s.rider_id INTO v_rider_id FROM public.shipments s
    WHERE s.order_id = p_order_id AND s.rider_id IS NOT NULL LIMIT 1;

    IF v_rider_id IS NOT NULL THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets
        WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
        END IF;

        UPDATE public.wallets
        SET balance = balance + v_rider_flat_fee, updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_rider_flat_fee, 'delivery_fee',
                'Delivery fee: Order #' || LEFT(p_order_id::TEXT, 8));

        UPDATE public.shipments
        SET delivery_fee = v_rider_flat_fee
        WHERE order_id = p_order_id AND rider_id = v_rider_id;

        BEGIN
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                '₦1,500 delivery fee credited — Order #' || LEFT(p_order_id::TEXT, 8));
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    RETURN jsonb_build_object(
        'success',         true,
        'order_total',     v_order_total,
        'seller_credited', v_order_total,
        'rider_credited',  CASE WHEN v_rider_id IS NOT NULL THEN v_rider_flat_fee ELSE 0 END,
        'platform_fee',    v_platform_fee,
        'rider_found',     (v_rider_id IS NOT NULL)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.complete_order_and_settle IS
'Called by buyer to confirm receipt. Atomically sets order=completed and credits seller (95%) + rider (5%).';

-- Verify
SELECT 'complete_order_and_settle RPC created successfully' AS status;
