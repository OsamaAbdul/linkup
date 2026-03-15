-- MIGRATION: 20260303_settlement_on_completion.sql
-- Moves ALL financial settlement (seller + logistics) to trigger on 'completed'
-- (i.e., when the BUYER marks the order as received).
-- This prevents premature payouts and potential fraud.
--
-- DELIVERY_FEE: A 5% delivery fee is calculated from the order total and credited
-- to the logistics agent's wallet. The seller receives the remaining 95%.
-- Adjust DELIVERY_FEE_RATE as needed.

DO $$
BEGIN
    -- Ensure wallets table has user_id for logistics agents
    -- (it may only have seller_id from v1)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.wallets ADD COLUMN user_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- ============================================================
-- 1. UPDATED SELLER SETTLEMENT
-- Now triggers on 'completed' (buyer confirms receipt) not 'delivered'
-- Seller receives 95% of the order total (5% route fee to logistics)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05; -- 5% to logistics agent
BEGIN
    -- ── Fire ONLY when status transitions to 'completed' ──
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
        v_seller_payout := v_order_total - v_delivery_fee;

        -- ── 1. Find (or create) seller wallet ──
        SELECT id INTO v_seller_wallet_id
        FROM public.wallets
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        IF v_seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, user_id, balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        -- ── 2. Credit seller wallet (order total minus delivery fee) ──
        UPDATE public.wallets
        SET balance = balance + v_seller_payout,
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (
            v_seller_wallet_id,
            v_seller_payout,
            'settlement',
            'Order Settlement (net): #' || LEFT(NEW.id::TEXT, 8)
        );

        -- ── 3. Notify seller ──
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
            NEW.seller_id,
            'payment',
            '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999.00') || ' credited for Order #' || LEFT(NEW.id::TEXT, 8) || '. Buyer has confirmed receipt.'
        );

        -- ── 4. Find rider for this order via shipments ──
        SELECT rider_id INTO v_rider_id
        FROM public.shipments
        WHERE order_id = NEW.id
        AND rider_id IS NOT NULL
        LIMIT 1;

        -- ── 5. Credit logistics agent wallet (delivery fee) ──
        IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

            SELECT id INTO v_rider_wallet_id
            FROM public.wallets
            WHERE user_id = v_rider_id
            LIMIT 1;

            IF v_rider_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance)
                VALUES (v_rider_id, 0)
                RETURNING id INTO v_rider_wallet_id;
            END IF;

            UPDATE public.wallets
            SET balance = balance + v_delivery_fee,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (
                v_rider_wallet_id,
                v_delivery_fee,
                'delivery_fee',
                'Delivery Fee for Order #' || LEFT(NEW.id::TEXT, 8)
            );

            -- ── 6. Notify logistics agent ──
            INSERT INTO public.notifications (user_id, type, message)
            VALUES (
                v_rider_id,
                'payment',
                '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999.00') || ' delivery fee credited for Order #' || LEFT(NEW.id::TEXT, 8) || '. Well done!'
            );

        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Recreate trigger (replaces the old one that fired on 'delivered')
-- ============================================================
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;

CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- ============================================================
-- 3. Add 'delivery_fee' transaction type if enum exists
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'transaction_type'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'delivery_fee'
            AND enumtypid = 'public.transaction_type'::regtype
        ) THEN
            ALTER TYPE public.transaction_type ADD VALUE 'delivery_fee';
        END IF;
    END IF;
END $$;

COMMENT ON FUNCTION public.handle_revenue_settlement IS
'Settles order revenue on BUYER COMPLETION: 95% to seller wallet, 5% delivery fee to logistics agent wallet.';
