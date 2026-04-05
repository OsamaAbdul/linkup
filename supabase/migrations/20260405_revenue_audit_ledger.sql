
-- REVENUE AUDIT ENGINE (Ledger System)
-- This migration creates a formal audit trail for all platform revenue and disbursements.

-- 1. REVENUE LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.revenue_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    total_order_amount NUMERIC NOT NULL,
    platform_fee NUMERIC NOT NULL DEFAULT 0,
    rider_fee NUMERIC NOT NULL DEFAULT 0,
    promoter_commission NUMERIC NOT NULL DEFAULT 0,
    seller_payout NUMERIC NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'NGN',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'refunded', 'disputed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE
);

-- 2. REFACTOR FEE CALCULATION (Robust Version)
-- This function pulls directly from fee_config as the single source of truth.
CREATE OR REPLACE FUNCTION public.calculate_precise_fees(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB := '{}'::JSONB;
    v_rec RECORD;
    v_rider_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_promoter_fee NUMERIC := 0;
BEGIN
    SELECT total, promoter_id INTO v_order FROM public.orders WHERE id = p_order_id;
    
    -- 1. Fetch Configured Rates
    FOR v_rec IN (SELECT fee_type, rate, flat_fee FROM public.fee_config WHERE is_active = TRUE) 
    LOOP
        IF v_rec.fee_type = 'platform' THEN
            v_platform_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'rider' THEN
            v_rider_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        ELSIF v_rec.fee_type = 'promoter' AND v_order.promoter_id IS NOT NULL THEN
            v_promoter_fee := (v_order.total * v_rec.rate) + v_rec.flat_fee;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'platform', ROUND(v_platform_fee, 2),
        'rider', ROUND(v_rider_fee, 2),
        'promoter', ROUND(v_promoter_fee, 2),
        'seller', ROUND(v_order.total - v_platform_fee - v_rider_fee - v_promoter_fee, 2)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. REVENUE SNAPSHOT TRIGGER
-- Automatically record the ledger entry when an order reaches 'completed'
CREATE OR REPLACE FUNCTION public.record_revenue_snapshot()
RETURNS TRIGGER AS $$
DECLARE
    v_precise JSONB;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        v_precise := public.calculate_precise_fees(NEW.id);
        
        INSERT INTO public.revenue_ledgers (
            order_id,
            total_order_amount,
            platform_fee,
            rider_fee,
            promoter_commission,
            seller_payout,
            status
        ) VALUES (
            NEW.id,
            NEW.total,
            (v_precise->>'platform')::NUMERIC,
            (v_precise->>'rider')::NUMERIC,
            (v_precise->>'promoter')::NUMERIC,
            (v_precise->>'seller')::NUMERIC,
            'pending'
        );
    END IF;

    -- Update ledger status on settlement
    IF NEW.settlement_status = 'settled' AND OLD.settlement_status != 'settled' THEN
        UPDATE public.revenue_ledgers 
        SET status = 'settled', 
            settled_at = NOW() 
        WHERE order_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_revenue_ledger_snapshot ON public.orders;
CREATE TRIGGER trg_revenue_ledger_snapshot
AFTER UPDATE OF status, settlement_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_revenue_snapshot();
