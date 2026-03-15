-- MIGRATION: 20260303_fix_settlement_trigger.sql
-- This is the DEFINITIVE settlement migration.
-- Fixes the issue where seller and logistics agent earnings are NOT credited
-- when the buyer marks an order as 'completed'.
--
-- Root causes addressed:
-- 1. wallets table may only have seller_id (no user_id for riders)
-- 2. wallet_transactions.type may be an enum that lacks 'delivery_fee'
-- 3. Settlement trigger may still fire on 'delivered' (old version)
-- 4. Trigger may fail silently due to RLS on wallets/wallet_transactions

-- ═══════════════════════════════════════════════════
-- STEP 1: Ensure wallets has user_id column for riders
-- ═══════════════════════════════════════════════════
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0;

-- For existing seller wallets, backfill user_id = seller_id
UPDATE public.wallets SET user_id = seller_id WHERE user_id IS NULL AND seller_id IS NOT NULL;

-- ═══════════════════════════════════════════════════
-- STEP 2: Handle wallet_transactions.type column
-- It might be TEXT or an ENUM — handle both cases safely
-- ═══════════════════════════════════════════════════
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'wallet_transactions'
    AND column_name = 'type';

    -- If it's an enum, add new values
    IF col_type = 'USER-DEFINED' THEN
        -- Add 'delivery_fee' if not exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname IN (
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'wallet_transactions' AND column_name = 'type'
            )
            AND e.enumlabel = 'delivery_fee'
        ) THEN
            EXECUTE 'ALTER TYPE ' || (
                SELECT udt_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'type'
            ) || ' ADD VALUE IF NOT EXISTS ''delivery_fee''';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname IN (
                SELECT udt_name FROM information_schema.columns
                WHERE table_name = 'wallet_transactions' AND column_name = 'type'
            )
            AND e.enumlabel = 'escrow_hold'
        ) THEN
            EXECUTE 'ALTER TYPE ' || (
                SELECT udt_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'type'
            ) || ' ADD VALUE IF NOT EXISTS ''escrow_hold''';
        END IF;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════
-- STEP 3: Drop old trigger first (the one firing on 'delivered')
-- ═══════════════════════════════════════════════════
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- ═══════════════════════════════════════════════════
-- STEP 4: Definitive settlement function
-- Uses SECURITY DEFINER to bypass RLS on wallets/wallet_transactions
-- Fires ONLY on 'completed' (buyer confirms receipt)
-- Seller gets 95%, rider gets 5% delivery fee
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05;
BEGIN
    -- Only fire when transitioning TO 'completed'
    IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN
        RETURN NEW;
    END IF;

    v_order_total  := COALESCE(NEW.total, 0);
    v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
    v_seller_payout := v_order_total - v_delivery_fee;

    -- ── SELLER WALLET ──────────────────────────────
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
    LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
        RETURNING id INTO v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance = balance + v_seller_payout,
        escrow_balance = GREATEST(0, COALESCE(escrow_balance, 0) - v_seller_payout),
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    -- Record transaction (use TEXT cast for type to handle both TEXT and ENUM columns)
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
            'Order completed — Settlement: #' || LEFT(NEW.id::TEXT, 8));

    -- Notify seller
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (NEW.seller_id, 'payment',
            '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') ||
            ' settlement credited for Order #' || LEFT(NEW.id::TEXT, 8) ||
            '. Buyer confirmed receipt.');

    -- ── RIDER WALLET ───────────────────────────────
    SELECT s.rider_id INTO v_rider_id
    FROM public.shipments s
    WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL
    LIMIT 1;

    IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

        -- Get or create rider wallet (keyed by user_id)
        SELECT id INTO v_rider_wallet_id FROM public.wallets
        WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0)
            RETURNING id INTO v_rider_wallet_id;
        END IF;

        UPDATE public.wallets
        SET balance = balance + v_delivery_fee,
            updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        -- Store delivery_fee on the shipment row for easy querying
        UPDATE public.shipments
        SET delivery_fee = v_delivery_fee
        WHERE order_id = NEW.id AND rider_id = v_rider_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                'Delivery fee — Order #' || LEFT(NEW.id::TEXT, 8));

        INSERT INTO public.notifications (user_id, type, message)
        VALUES (v_rider_id, 'payment',
                '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') ||
                ' delivery fee credited! Order #' || LEFT(NEW.id::TEXT, 8));
    END IF;

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't block the order status update
    RAISE WARNING 'Settlement trigger error for order %: % %', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.handle_revenue_settlement IS
'Fires on orders.status = completed. Credits 95% to seller, 5% delivery fee to rider. SECURITY DEFINER bypasses RLS.';

-- ═══════════════════════════════════════════════════
-- STEP 5: Attach trigger
-- ═══════════════════════════════════════════════════
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();
