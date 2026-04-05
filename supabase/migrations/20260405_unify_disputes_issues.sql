-- MIGRATION: 20260405_unify_disputes_issues.sql
-- Consolidates the dispute and issue management systems into a single unified ledger.

-- 1. ENHANCE issues table for unified functionality
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'technical' CHECK (category IN ('technical', 'security', 'financial_dispute')),
ADD COLUMN IF NOT EXISTS resolution_meta JSONB,
ADD COLUMN IF NOT EXISTS evidence_url TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- 2. MIGRATE existing dispute data to issues table
INSERT INTO public.issues (
    user_id,
    order_id,
    seller_id,
    product_id,
    title,
    description,
    status,
    category,
    resolution_meta,
    evidence_url,
    priority,
    created_at
)
SELECT 
    d.initiator_id as user_id,
    d.order_id,
    o.seller_id,
    d.product_id,
    'Financial Dispute: ' || d.reason as title,
    d.details as description,
    CASE 
        WHEN d.status = 'under_review' THEN 'in_progress'::public.issue_status
        WHEN d.status = 'dismissed' THEN 'closed'::public.issue_status
        ELSE d.status::public.issue_status
    END as status,
    'financial_dispute' as category,
    d.resolution_meta,
    d.evidence_url,
    'high'::public.issue_priority as priority, -- Disputes are always high priority
    d.created_at
FROM public.disputes d
JOIN public.orders o ON o.id = d.order_id
ON CONFLICT DO NOTHING;

-- 3. REFACTOR resolve_dispute RPC to target unified issues table
DROP FUNCTION IF EXISTS public.resolve_dispute(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.resolve_dispute(
    p_issue_id UUID,
    p_resolution_type TEXT, -- 'refund' or 'release'
    p_admin_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_seller_id UUID;
    v_buyer_id UUID;
    v_total_amount NUMERIC;
    v_issue_status TEXT;
BEGIN
    -- 1. Fetch case details from unified issues table
    SELECT order_id, user_id, status
    INTO v_order_id, v_buyer_id, v_issue_status
    FROM public.issues
    WHERE id = p_issue_id AND category = 'financial_dispute';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Case ID not found in judicial ledger');
    END IF;

    IF v_issue_status = 'resolved' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Case already adjudicated');
    END IF;

    -- 2. Fetch order financials
    SELECT seller_id, total
    INTO v_seller_id, v_total_amount
    FROM public.orders
    WHERE id = v_order_id;

    -- 3. Adjudication Logic
    IF p_resolution_type = 'refund' THEN
        -- Move funds from Platform to Buyer
        UPDATE public.wallets SET balance = balance + v_total_amount WHERE user_id = v_buyer_id;
        UPDATE public.platform_wallets SET balance = balance - v_total_amount;
        
        INSERT INTO public.wallet_transactions (user_id, amount, type, description, status)
        VALUES (v_buyer_id, v_total_amount, 'deposit', 'Refund for Order #' || v_order_id, 'success');
        
        UPDATE public.orders SET status = 'cancelled', payment_status = 'refunded' WHERE id = v_order_id;

    ELSIF p_resolution_type = 'release' THEN
        -- Move funds from Platform to Seller
        UPDATE public.wallets SET balance = balance + v_total_amount WHERE user_id = v_seller_id;
        UPDATE public.platform_wallets SET balance = balance - v_total_amount;
        
        INSERT INTO public.wallet_transactions (user_id, amount, type, description, status)
        VALUES (v_seller_id, v_total_amount, 'deposit', 'Escrow release for Order #' || v_order_id, 'success');
        
        UPDATE public.orders SET status = 'completed', settlement_status = 'settled' WHERE id = v_order_id;
    
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid resolution protocol');
    END IF;

    -- 4. Finalize Unified Ticket
    UPDATE public.issues 
    SET 
        status = 'resolved'::public.issue_status,
        resolved_at = NOW(),
        resolution_meta = jsonb_build_object(
            'resolution', p_resolution_type,
            'notes', p_admin_notes,
            'resolved_by_system', true
        )
    WHERE id = p_issue_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Adjudicated successfully: ' || p_resolution_type,
        'order_id', v_order_id
    );
END;
$$;

-- 4. UNIFIED RLS POLICIES FOR issues
DROP POLICY IF EXISTS "Users can manage own issues" ON public.issues;
CREATE POLICY "Users can manage own issues" ON public.issues
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view everything" ON public.issues;
CREATE POLICY "Admins can view everything" ON public.issues
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';
