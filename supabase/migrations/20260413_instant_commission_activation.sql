
-- MIGRATION: 20260413_instant_commission_activation.sql
-- Fixes the delay in promoter dashboard by enabling real-time commission creation on Order INSERT.

-- 1. Update the Revenue Settlement Trigger to fire on INSERT as well
DROP TRIGGER IF EXISTS trg_revenue_settlement ON public.orders;
CREATE TRIGGER trg_revenue_settlement 
BEFORE INSERT OR UPDATE ON public.orders 
FOR EACH ROW EXECUTE FUNCTION public.handle_revenue_settlement();

-- 2. Refactor handle_revenue_settlement to support INSERT (where OLD is null)
CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    v_fees JSONB;
    v_seller_wallet_id UUID;
    v_promoter_wallet_id UUID;
BEGIN
    -- STEP 1: Commission Generation upon initial insertion or state change
    -- We target 'pending', 'processing', 'awaiting_agent' as starting states
    IF (TG_OP = 'INSERT' AND NEW.status IN ('pending', 'processing', 'awaiting_agent')) 
       OR (TG_OP = 'UPDATE' AND NEW.status IN ('pending', 'processing', 'awaiting_agent') AND (OLD.status IS NULL OR OLD.status NOT IN ('pending', 'processing', 'awaiting_agent'))) THEN
        
        -- Recalculate fees precisely for this order
        v_fees := public.calculate_precise_fees(NEW.id);
        
        -- 1. Promoter Commission Logic
        -- We only create it if promoter_id is present AND it doesn't already exist
        IF NEW.promoter_id IS NOT NULL THEN
            -- Find or Create Promoter Wallet
            SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = NEW.promoter_id LIMIT 1;
            IF v_promoter_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.promoter_id, 0, 0)
                RETURNING id INTO v_promoter_wallet_id;
            END IF;

            -- Create the Pending Commission record (Visibility for Dashboard)
            INSERT INTO public.commissions (order_id, promoter_id, amount, status)
            VALUES (NEW.id, NEW.promoter_id, (v_fees->>'promoter')::NUMERIC, 'pending')
            ON CONFLICT (order_id, promoter_id) DO UPDATE 
            SET amount = EXCLUDED.amount, status = 'pending';

            -- Create the Pending Wallet Transaction (Escrow Visibility)
            -- Note: trg_sync_wallet_balance will automatically update escrow_balance
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_promoter_wallet_id, 
                (v_fees->>'promoter')::NUMERIC, 
                'commission', 
                'Pending Commission: Order #' || NEW.id,
                'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', 'Order creation attribution')
            )
            ON CONFLICT ((metadata->>'order_id'), type) WHERE status = 'pending' DO NOTHING;
        END IF;

        -- 2. Seller Escrow Logic
        SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = NEW.seller_id OR seller_id = NEW.seller_id LIMIT 1;
        IF v_seller_wallet_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status, metadata)
            VALUES (
                v_seller_wallet_id, 
                (NEW.total - COALESCE((v_fees->>'platform')::NUMERIC, 0) - COALESCE((v_fees->>'promoter')::NUMERIC, 0)), 
                'settlement', 
                'Pending Settlement: Order #' || NEW.id,
                'pending',
                jsonb_build_object('order_id', NEW.id, 'reason', 'Order creation escrow')
            )
            ON CONFLICT ((metadata->>'order_id'), type) WHERE status = 'pending' DO NOTHING;
        END IF;
    END IF;

    -- STEP 2: Handle Completion (Hold Period)
    IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.settlement_due_at := NOW() + INTERVAL '48 hours';
        NEW.settlement_status := 'pending';
        
        -- Update hold metadata for pending transactions
        UPDATE public.wallet_transactions 
        SET metadata = metadata || jsonb_build_object('hold_until', NEW.settlement_due_at)
        WHERE (metadata->>'order_id') = NEW.id::TEXT AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
