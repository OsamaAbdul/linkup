-- ============================================================
-- PASTE THIS ENTIRE BLOCK into Supabase SQL Editor
-- Do not paste only part of it
-- ============================================================

-- Step 1: Drop old trigger
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

-- Step 2: Ensure wallet columns exist
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.wallets SET user_id = seller_id WHERE user_id IS NULL AND seller_id IS NOT NULL;

-- Step 3: Ensure wallet_transactions.reference exists
ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS reference TEXT;

-- Step 4: Convert wallet_transactions.type to TEXT if it is an ENUM
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='wallet_transactions' AND column_name='type') = 'USER-DEFINED'
    THEN
        ALTER TABLE public.wallet_transactions ALTER COLUMN type TYPE TEXT USING type::TEXT;
        RAISE NOTICE 'Converted type column from ENUM to TEXT';
    END IF;
END $$;

-- Step 5: Create settlement function
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id  UUID;
    v_order_total      NUMERIC;
    v_delivery_fee     NUMERIC;
    v_seller_payout    NUMERIC;
    v_rider_id         UUID;
BEGIN
    IF NEW.status::TEXT <> 'completed' OR OLD.status::TEXT = 'completed' THEN
        RETURN NEW;
    END IF;

    -- Try total, then total_amount, then sum from order items
    v_order_total := COALESCE(NULLIF(NEW.total, 0), NULLIF(NEW.total_amount, 0), 0);

    IF v_order_total = 0 THEN
        SELECT COALESCE(SUM(price_at_purchase * quantity), 0)
        INTO v_order_total
        FROM public.order_items_new
        WHERE order_id = NEW.id;
    END IF;

    RAISE NOTICE '[Settlement] Order % completed. Total = %', NEW.id, v_order_total;

    IF v_order_total = 0 THEN
        RAISE WARNING '[Settlement] Zero total on order % — no earnings credited', NEW.id;
        RETURN NEW;
    END IF;

    v_delivery_fee  := ROUND(v_order_total * 0.05, 2);
    v_seller_payout := v_order_total - v_delivery_fee;

    -- Seller wallet
    SELECT id INTO v_seller_wallet_id FROM public.wallets
    WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id LIMIT 1;

    IF v_seller_wallet_id IS NULL THEN
        INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
        VALUES (NEW.seller_id, NEW.seller_id, 0, 0) RETURNING id INTO v_seller_wallet_id;
    END IF;

    UPDATE public.wallets
    SET balance = balance + v_seller_payout,
        escrow_balance = GREATEST(0, COALESCE(escrow_balance,0) - v_seller_payout),
        updated_at = NOW()
    WHERE id = v_seller_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
            'Settlement: Order #' || LEFT(NEW.id::TEXT, 8));

    BEGIN
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (NEW.seller_id, 'payment',
            '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') || ' credited — Order #' || LEFT(NEW.id::TEXT,8));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    RAISE NOTICE '[Settlement] Seller % credited ₦%', v_seller_wallet_id, v_seller_payout;

    -- Rider wallet
    SELECT s.rider_id INTO v_rider_id FROM public.shipments s
    WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL LIMIT 1;

    IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id LIMIT 1;

        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
        END IF;

        UPDATE public.wallets SET balance = balance + v_delivery_fee, updated_at = NOW()
        WHERE id = v_rider_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));

        UPDATE public.shipments SET delivery_fee = v_delivery_fee
        WHERE order_id = NEW.id AND rider_id = v_rider_id;

        BEGIN
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') || ' delivery fee — Order #' || LEFT(NEW.id::TEXT,8));
        EXCEPTION WHEN OTHERS THEN NULL; END;

        RAISE NOTICE '[Settlement] Rider % credited ₦%', v_rider_wallet_id, v_delivery_fee;
    ELSE
        RAISE NOTICE '[Settlement] No rider on order % — delivery fee skipped', NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Settlement] ERROR on order %: % (%)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 6: Attach trigger
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_revenue_settlement();

-- Step 7: Verify
SELECT tgname AS trigger, proname AS function,
       CASE tgenabled WHEN 'O' THEN 'ENABLED' ELSE 'DISABLED' END AS status
FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'tr_order_settlement';
