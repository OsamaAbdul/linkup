-- MIGRATION: 20260303_settlement_definitive_fix.sql
-- Run this AFTER DIAGNOSTIC_settlement.sql confirms the problem.
--
-- This is a complete rewrite of the settlement system that:
-- 1. Converts wallet_transactions.type to TEXT (removes ENUM constraints)
-- 2. Adds all required wallet columns
-- 3. Creates a clean, debuggable settlement trigger
-- 4. Includes an inline test at the end

-- ═══════════════════════════════════════════════════════════
-- PART 1: Fix wallet_transactions.type (convert ENUM -> TEXT)
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'type';

    IF col_type = 'USER-DEFINED' THEN
        -- Convert enum column to TEXT so any string value works
        ALTER TABLE public.wallet_transactions 
            ALTER COLUMN type TYPE TEXT USING type::TEXT;
        RAISE NOTICE 'Converted wallet_transactions.type from ENUM to TEXT';
    ELSE
        RAISE NOTICE 'wallet_transactions.type is already %', col_type;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Ensure wallets has required columns
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: for existing seller wallets, user_id = seller_id
UPDATE public.wallets 
SET user_id = seller_id 
WHERE user_id IS NULL AND seller_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Ensure wallet_transactions has reference column
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS reference TEXT;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Clean settlement trigger
-- ═══════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id  UUID;
    v_order_total      NUMERIC;
    v_delivery_fee     NUMERIC;
    v_seller_payout    NUMERIC;
    v_rider_id         UUID;
    DELIVERY_FEE_RATE  CONSTANT NUMERIC := 0.05;
BEGIN
    -- Only fire when status changes TO 'completed'
    IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN
        RETURN NEW;
    END IF;

    v_order_total   := COALESCE(NEW.total, 0);
    v_delivery_fee  := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
    v_seller_payout := v_order_total - v_delivery_fee;

    RAISE NOTICE '[Settlement] Order % completed. Total: %, Fee: %, Seller: %',
        NEW.id, v_order_total, v_delivery_fee, v_seller_payout;

    -- ── Seller wallet ──────────────────────────────────────
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
    LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
        RETURNING id INTO v_seller_wallet_id;
        RAISE NOTICE '[Settlement] Created new seller wallet: %', v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance         = balance + v_seller_payout,
        escrow_balance  = GREATEST(0, COALESCE(escrow_balance, 0) - v_seller_payout),
        updated_at      = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
            'Settlement: Order #' || LEFT(NEW.id::TEXT, 8));

    -- Seller notification
    BEGIN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (NEW.seller_id, 'payment',
                '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') ||
                ' credited — Order #' || LEFT(NEW.id::TEXT, 8) || ' finalized by buyer.');
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[Settlement] Notification insert failed (non-critical): %', SQLERRM;
    END;

    -- ── Rider wallet ───────────────────────────────────────
    SELECT s.rider_id INTO v_rider_id
    FROM public.shipments s
    WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL
    LIMIT 1;

    RAISE NOTICE '[Settlement] Rider ID for order %: %', NEW.id, v_rider_id;

    IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

        SELECT id INTO v_rider_wallet_id FROM public.wallets
        WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0)
            RETURNING id INTO v_rider_wallet_id;
            RAISE NOTICE '[Settlement] Created new rider wallet: %', v_rider_wallet_id;
        END IF;

        UPDATE public.wallets
        SET balance    = balance + v_delivery_fee,
            updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));

        UPDATE public.shipments
        SET delivery_fee = v_delivery_fee
        WHERE order_id = NEW.id AND rider_id = v_rider_id;

        BEGIN
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                    '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') ||
                    ' delivery fee credited — Order #' || LEFT(NEW.id::TEXT, 8));
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[Settlement] Rider notification failed (non-critical): %', SQLERRM;
        END;
    END IF;

    RAISE NOTICE '[Settlement] Complete for order %', NEW.id;
    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Settlement] CRITICAL ERROR for order %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;  -- Never block the order update
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach the trigger
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- ═══════════════════════════════════════════════════════════
-- PART 5: VERIFY — after running, check trigger exists
-- ═══════════════════════════════════════════════════════════
SELECT 
    tgname AS trigger_name,
    proname AS function_name,
    CASE tgenabled WHEN 'O' THEN 'ENABLED' ELSE 'DISABLED' END AS status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'tr_order_settlement';

-- ═══════════════════════════════════════════════════════════
-- PART 6: Manual test — simulate completing an order
-- Uncomment and replace ORDER_ID with a real delivered order
-- ═══════════════════════════════════════════════════════════
-- UPDATE public.orders 
-- SET status = 'completed', updated_at = NOW() 
-- WHERE id = 'YOUR-ORDER-ID-HERE' 
-- AND status = 'delivered';
--
-- Then check:
-- SELECT * FROM public.wallet_transactions ORDER BY created_at DESC LIMIT 5;
-- SELECT id, balance, escrow_balance, user_id, seller_id FROM public.wallets;
