-- Payout Request System Migration (Unified for Sellers & Logistics)

-- 1. System Settings for Global Config
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
    ('withdrawal_fee', '{"amount": 500, "type": "flat"}'::JSONB, 'Flat fee deducted from each withdrawal request'),
    ('payout_interval_days', '7'::JSONB, 'Minimum number of days between payout requests')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- RLS for System Settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings" 
ON public.system_settings FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. Unified Payout Requests Table
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    fee_amount NUMERIC NOT NULL DEFAULT 0,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handle renaming if it already existed with seller_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_requests' AND column_name = 'seller_id') THEN
        ALTER TABLE public.payout_requests RENAME COLUMN seller_id TO user_id;
    END IF;
END $$;

-- RLS Policies
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view own payout requests" 
ON public.payout_requests FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sellers can create own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Users can create own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create own payout requests" 
ON public.payout_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all payout requests" ON public.payout_requests;
CREATE POLICY "Admins can manage all payout requests" 
ON public.payout_requests FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. Wallet Integration Logic (Fixed to prevent double deduction)
CREATE OR REPLACE FUNCTION public.handle_payout_request()
RETURNS TRIGGER AS $$
DECLARE
    v_wallet_balance NUMERIC;
    v_last_request_date TIMESTAMP;
    v_interval_days INTEGER;
BEGIN
    -- Get wallet balance
    SELECT balance INTO v_wallet_balance FROM public.wallets WHERE id = NEW.wallet_id FOR UPDATE;
    
    -- Check if balance is sufficient (amount + fee)
    IF v_wallet_balance < (NEW.amount + NEW.fee_amount) THEN
        RAISE EXCEPTION 'Insufficient balance for payout (including fee)';
    END IF;

    -- Check payout interval
    SELECT (value->>0)::INTEGER INTO v_interval_days FROM public.system_settings WHERE key = 'payout_interval_days';
    
    SELECT MAX(created_at) INTO v_last_request_date 
    FROM public.payout_requests 
    WHERE user_id = NEW.user_id AND status != 'rejected';

    IF v_last_request_date IS NOT NULL AND (NOW() - v_last_request_date) < (v_interval_days || ' days')::INTERVAL THEN
        RAISE EXCEPTION 'Payout interval not met. You can only request payouts every % days.', v_interval_days;
    END IF;

    -- Create wallet transaction for the deduction (Auto-syncs balance via trg_sync_wallet_balance)
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
    VALUES (
        NEW.wallet_id, 
        -(NEW.amount + NEW.fee_amount), 
        'withdrawal', 
        'Payout Request: ' || NEW.id,
        'pending'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_payout_request ON public.payout_requests;
CREATE TRIGGER tr_handle_payout_request
BEFORE INSERT ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_payout_request();

-- 4. Payout Rejection (Refund) Logic (Fixed to prevent double credit)
CREATE OR REPLACE FUNCTION public.handle_payout_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If rejected, create refund transaction (Auto-syncs balance)
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
        VALUES (
            NEW.wallet_id, 
            (NEW.amount + NEW.fee_amount), 
            'refund', 
            'Refund: Rejected Payout ' || NEW.id,
            'success'
        );
        
        -- Update the original withdrawal transaction to failed
        UPDATE public.wallet_transactions 
        SET status = 'failed' 
        WHERE reference = 'Payout Request: ' || NEW.id;
    END IF;

    -- If completed, mark transaction as success
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.wallet_transactions 
        SET status = 'success' 
        WHERE reference = 'Payout Request: ' || NEW.id;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_handle_payout_update ON public.payout_requests;
CREATE TRIGGER tr_handle_payout_update
BEFORE UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_payout_update();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;