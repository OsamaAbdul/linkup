
-- MIGRATION: 20260413_final_referral_reliability.sql
-- 1. Improves sync_order_promoter_id to handle multi-order sessions
-- 2. Restores wallet initialization in handle_revenue_settlement_after

-- 1. Improved Attribution Sync (Session-Aware)
CREATE OR REPLACE FUNCTION public.sync_order_promoter_id()
RETURNS TRIGGER AS $$
DECLARE
    v_found_promoter_id UUID;
BEGIN
    IF NEW.promoter_id IS NULL THEN
        -- Look for ANY valid referral click or conversion from this buyer 
        -- within a 2-hour window (standard checkout session)
        SELECT promoter_id INTO v_found_promoter_id
        FROM public.referrals
        WHERE (buyer_id = NEW.buyer_id OR visitor_id = (NEW.shipping_address->>'visitor_id'))
        AND status IN ('click', 'conversion') -- Allow already converted referrals to attribute subsequent orders in the same session
        AND (expires_at > NOW() OR expires_at IS NULL)
        ORDER BY created_at DESC 
        LIMIT 1;

        IF v_found_promoter_id IS NOT NULL THEN
            NEW.promoter_id := v_found_promoter_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix handle_revenue_settlement_after with Wallet Recovery
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement_after()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status IN ('pending', 'processing', 'awaiting_agent')) 
       OR (TG_OP = 'UPDATE' AND NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent'))) THEN
        
        v_fees := public.calculate_precise_fees(NEW.id);
        
        IF NEW.promoter_id IS NOT NULL THEN
            -- Find or Create Promoter Wallet (Safe Recovery)
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;
            IF v_promoter_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.promoter_id, 0, 0)
                RETURNING id INTO v_promoter_wallet_id;
            END IF;

            -- Create Commission
            INSERT INTO public.commissions (order_id, promoter_id, amount, status)
            VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
            ON CONFLICT (order_id, promoter_id) DO UPDATE SET amount = EXCLUDED.amount;

            -- Create Transaction
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_promoter_wallet_id, (v_fees->>'promoter')::NUMERIC, 'commission', 'Order #' || NEW.id, 'pending', jsonb_build_object('order_id', NEW.id))
            ON CONFLICT DO NOTHING;
        END IF;

        -- Seller Wallet Recovery
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        IF v_seller_wallet_id IS NULL AND NEW.seller_id IS NOT NULL THEN
             INSERT INTO public.wallets (user_id, seller_id, balance, escrow_balance)
             VALUES (NEW.seller_id, NEW.seller_id, 0, 0)
             RETURNING id INTO v_seller_wallet_id;
        END IF;

        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (v_seller_wallet_id, (NEW.total - COALESCE((v_fees->>'platform')::NUMERIC, 0) - COALESCE((v_fees->>'promoter')::NUMERIC, 0)), 'settlement', 'Order #' || NEW.id, 'pending', jsonb_build_object('order_id', NEW.id))
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
