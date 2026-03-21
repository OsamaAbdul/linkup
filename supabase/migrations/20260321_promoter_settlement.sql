-- Migration: 20260321_promoter_settlement.sql
-- Automates promoter commission payouts when an order is completed.

CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_order_total NUMERIC;
    v_delivery_fee NUMERIC;
    v_promoter_commission NUMERIC := 0;
    v_seller_payout NUMERIC;
    v_rider_id UUID;
    DELIVERY_FEE_RATE CONSTANT NUMERIC := 0.05;
BEGIN
    -- ── CASE 1: Order CONFIRMED (accepted) → Lock funds into escrow ──
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

        -- Increase escrow balance
        UPDATE public.wallets
        SET escrow_balance = escrow_balance + (v_order_total - v_delivery_fee),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, (v_order_total - v_delivery_fee), 'escrow_hold',
                'Escrow hold for Order #' || LEFT(NEW.id::TEXT, 8));

    END IF;

    -- ── CASE 2: Order COMPLETED (buyer confirms) → Release escrow to seller + rider + promoter ──
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

        v_order_total := COALESCE(NEW.total, 0);
        v_delivery_fee := ROUND(v_order_total * DELIVERY_FEE_RATE, 2);
        
        -- Check for promoter commission
        IF NEW.promoter_id IS NOT NULL THEN
            SELECT amount INTO v_promoter_commission
            FROM public.commissions
            WHERE order_id = NEW.id AND promoter_id = NEW.promoter_id
            LIMIT 1;
            
            v_promoter_commission := COALESCE(v_promoter_commission, 0);
        END IF;

        v_seller_payout := v_order_total - v_delivery_fee - v_promoter_commission;

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
        -- Note: We subtract the full (order_total - delivery_fee) from escrow because that's what we put in.
        -- But the seller only keeps v_seller_payout.
        UPDATE public.wallets
        SET balance = balance + v_seller_payout,
            escrow_balance = GREATEST(0, escrow_balance - (v_order_total - v_delivery_fee)),
            updated_at = NOW()
        WHERE id = v_seller_wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (v_seller_wallet_id, v_seller_payout, 'settlement',
                'Settlement released: Order #' || LEFT(NEW.id::TEXT, 8));

        -- ── Promoter wallet ──
        IF v_promoter_commission > 0 THEN
            SELECT id INTO v_promoter_wallet_id
            FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;

            IF v_promoter_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.promoter_id, 0, 0)
                RETURNING id INTO v_promoter_wallet_id;
            END IF;

            UPDATE public.wallets
            SET balance = balance + v_promoter_commission,
                updated_at = NOW()
            WHERE id = v_promoter_wallet_id;

            UPDATE public.commissions
            SET status = 'paid', paid_at = NOW()
            WHERE order_id = NEW.id AND promoter_id = NEW.promoter_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_promoter_wallet_id, v_promoter_commission, 'commission',
                    'Promoter commission: Order #' || LEFT(NEW.id::TEXT, 8));

            INSERT INTO public.notifications (user_id, type, message)
            VALUES (NEW.promoter_id, 'payment',
                    '₦' || TO_CHAR(v_promoter_commission, 'FM999,999,999') ||
                    ' commission earned! Order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

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

            UPDATE public.shipments
            SET delivery_fee = v_delivery_fee
            WHERE order_id = NEW.id AND rider_id = v_rider_id;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
            VALUES (v_rider_wallet_id, v_delivery_fee, 'delivery_fee',
                    'Delivery fee: Order #' || LEFT(NEW.id::TEXT, 8));
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
