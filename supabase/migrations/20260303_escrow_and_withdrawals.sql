-- MIGRATION: 20260303_escrow_and_withdrawals.sql
-- Implements:
-- 1. Real escrow_balance column on wallets (holds funds until buyer confirms)
-- 2. Withdrawal requests table with daily limit enforcement
-- 3. Updated settlement trigger (moves funds from escrow → available on 'completed')
-- 4. delivery_fee_amount column on shipments (records exact amount earned)

-- ============================================================
-- 1. ESCROW BALANCE on wallets
-- ============================================================
ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS escrow_balance NUMERIC DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- 2. DELIVERY FEE tracking on shipments
-- ============================================================
ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMPTZ;  -- seller's selected pickup time

-- ============================================================
-- 3. WITHDRAWAL REQUESTS table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    admin_note TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own withdrawal requests"
ON public.withdrawal_requests FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can create withdrawal requests"
ON public.withdrawal_requests FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Only admins can approve/reject
CREATE POLICY "Admins can manage all withdrawal requests"
ON public.withdrawal_requests FOR ALL
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;

-- ============================================================
-- 4. UPDATED SETTLEMENT TRIGGER
-- When order = 'awaiting_agent' (broadcast): funds go into BUYER's escrow
-- When order = 'completed' (buyer confirms): escrow releases to seller (95%) and rider (5%)
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
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05;
BEGIN
    -- ── CASE 1: Order CONFIRMED (accepted) → Lock funds into escrow ──
    -- This represents buyer payment being secured
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);

        -- Find or create seller wallet
        SELECT id INTO v_seller_wallet_id
        FROM public.wallets
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        IF v_seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        -- Increase escrow balance (funds held until buyer confirms)
        UPDATE public.wallets
        SET escrow_balance = escrow_balance + (v_order_total - v_delivery_fee),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, (v_order_total - v_delivery_fee), 'escrow_hold',
                'Escrow hold for Order #' || LEFT(NEW.id::TEXT, 8));

    END IF;

    -- ── CASE 2: Order COMPLETED (buyer confirms) → Release escrow to seller + rider ──
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
        v_seller_payout := v_order_total - v_delivery_fee;

        -- ── Seller wallet ──
        SELECT id INTO v_seller_wallet_id
        FROM public.wallets
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        IF v_seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, user_id, balance, escrow_balance)
            VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
            RETURNING id INTO v_seller_wallet_id;
        END IF;

        -- Release from escrow → available balance
        UPDATE public.wallets
        SET balance = balance + v_seller_payout,
            escrow_balance = GREATEST(0, escrow_balance - v_seller_payout),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
                'Settlement released: Order #' || LEFT(NEW.id::TEXT, 8));

        INSERT INTO public.notifications (user_id, type, message)
        VALUES (NEW.seller_id, 'payment',
                '₦' || TO_CHAR(v_seller_payout, 'FM999,999,999') ||
                ' released from escrow for Order #' || LEFT(NEW.id::TEXT, 8));

        -- ── Rider wallet ──
        SELECT s.rider_id INTO v_rider_id
        FROM public.shipments s
        WHERE s.order_id = NEW.id AND s.rider_id IS NOT NULL
        LIMIT 1;

        IF v_rider_id IS NOT NULL AND v_delivery_fee > 0 THEN

            SELECT id INTO v_rider_wallet_id
            FROM public.wallets WHERE user_id = v_rider_id LIMIT 1;

            IF v_rider_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (v_rider_id, 0, 0)
                RETURNING id INTO v_rider_wallet_id;
            END IF;

            UPDATE public.wallets
            SET balance = balance + v_delivery_fee,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            -- Store delivery fee on shipment for easy querying
            UPDATE public.shipments
            SET delivery_fee = v_delivery_fee
            WHERE order_id = NEW.id AND rider_id = v_rider_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                    'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));

            INSERT INTO public.notifications (user_id, type, message)
            VALUES (v_rider_id, 'payment',
                    '₦' || TO_CHAR(v_delivery_fee, 'FM999,999,999') ||
                    ' delivery fee credited! Order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger and recreate
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- ============================================================
-- 5. DAILY WITHDRAWAL LIMIT FUNCTION
-- Max ₦50,000 per day per user (adjustable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_withdrawal(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bank_name TEXT,
    p_account_number TEXT,
    p_account_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_today_total NUMERIC;
    DAILY_LIMIT CONSTANT NUMERIC := 50000;
BEGIN
    -- Get wallet
    SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = p_user_id LIMIT 1;

    IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No wallet found');
    END IF;

    -- Check sufficient balance
    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Check daily limit
    SELECT COALESCE(SUM(amount), 0) INTO v_today_total
    FROM public.withdrawal_requests
    WHERE user_id = p_user_id
    AND DATE(requested_at) = CURRENT_DATE
    AND status NOT IN ('rejected');

    IF (v_today_total + p_amount) > DAILY_LIMIT THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Daily withdrawal limit of ₦50,000 exceeded. Used: ₦' || v_today_total::TEXT
        );
    END IF;

    -- Deduct from balance immediately (hold until processed)
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    -- Record withdrawal request
    INSERT INTO public.withdrawal_requests
        (user_id, wallet_id, amount, bank_name, account_number, account_name, status)
    VALUES
        (p_user_id, v_wallet.id, p_amount, p_bank_name, p_account_number, p_account_name, 'pending');

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (v_wallet.id, -p_amount, 'withdrawal', 'Withdrawal request: ₦' || p_amount::TEXT);

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request submitted');
END;
$$;

COMMENT ON FUNCTION public.request_withdrawal IS 'Creates a withdrawal request with daily limit enforcement of ₦50,000';
