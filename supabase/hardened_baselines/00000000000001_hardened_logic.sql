-- PRODUCTION SECURITY & BUSINESS LOGIC: 0001_hardened_logic.sql
-- Consolidates all Phase 1-15 Hardened functions and triggers.
-- This is the "Engine" of the Linkup Marketplace.

BEGIN;

-- 1. UTILITY: ADMIN & KYC CHECK
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CORE: REVENUE SETTLEMENT ENGINE (Phase 11 Unified)
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_attribution_threshold TIMESTAMP := NOW() - INTERVAL '30 days';
BEGIN
    -- STEP 1: Capture Geometry & Initial Fees on Stage transition to awaiting_agent
    IF NEW.status = 'awaiting_agent' AND OLD.status != 'awaiting_agent' THEN
        NEW.distance_km := public.calculate_distance(NEW.pickup_lat, NEW.pickup_lng, NEW.delivery_lat, NEW.delivery_lng);
        v_fees := public.calculate_order_fees(NEW.id);
        
        -- Validate Promoter Attribution (Last-Click Wins within window)
        IF NEW.promoter_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.referrals 
                WHERE promoter_id = NEW.promoter_id 
                AND buyer_id = NEW.buyer_id
                AND created_at >= v_attribution_threshold
                AND expires_at > NOW()
            ) THEN
                NEW.promoter_id := NULL; -- Invalidate fraudulent/expired attribution
            END IF;
        END IF;

        -- Find seller wallet
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id LIMIT 1;
        
        -- Hold seller funds in escrow (Order total - estimated rider/platform fees)
        UPDATE public.wallets 
        SET escrow_balance = escrow_balance + (NEW.total - COALESCE((v_fees->>'rider')::NUMERIC, 0) - COALESCE((v_fees->>'platform')::NUMERIC, 0))
        WHERE id = v_seller_wallet_id;
    END IF;

    -- STEP 2: Initiate Delayed Settlement on Stage transition to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';
    END IF;

    -- STEP 3: Handle Disputes
    IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
        NEW.settlement_status := 'none'; -- Halt settlement
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CORE: WITHDRAWAL & FLOODING SHIELD (Phase 13 Atomic)
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
    v_new_request_id UUID;
    v_daily_limit NUMERIC := 100000;
    v_today_total NUMERIC;
BEGIN
    -- IDENTITY GUARD
    IF p_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized identity mismatch');
    END IF;

    -- FLOODING SHIELD: Block concurrent pending requests
    IF EXISTS (
        SELECT 1 FROM public.payout_requests 
        WHERE user_id = p_user_id AND status = 'pending'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have a withdrawal request pending. Please wait for processing.');
    END IF;

    -- ATOMIC LOCK
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_wallet IS NULL THEN
        INSERT INTO public.wallets (user_id) VALUES (p_user_id) RETURNING * INTO v_wallet;
    END IF;

    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- LIMIT GUARD
    SELECT COALESCE(SUM(amount), 0) INTO v_today_total
    FROM public.payout_requests 
    WHERE user_id = p_user_id AND created_at >= CURRENT_DATE AND status != 'rejected';

    IF (v_today_total + p_amount) > v_daily_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Daily withdrawal limit reached (₦' || v_daily_limit || ')');
    END IF;

    INSERT INTO public.payout_requests (
        user_id, amount, bank_name, account_number, account_name, status
    ) VALUES (
        p_user_id, p_amount, p_bank_name, p_account_number, p_account_name, 'pending'
    ) RETURNING id INTO v_new_request_id;

    RETURN jsonb_build_object('success', true, 'id', v_new_request_id);
END;
$$;

-- 4. TRIGGER ATTACHMENTS
DROP TRIGGER IF EXISTS trg_revenue_settlement ON public.orders;
CREATE TRIGGER trg_revenue_settlement
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'avatar_url');
  
  -- Create empty wallet
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
