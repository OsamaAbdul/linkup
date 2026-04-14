
-- MIGRATION: 20260413_auto_sync_promoter_attribution.sql
-- Server-side "Safety Sync" to ensure orders are attributed to promoters
-- even if the frontend fails to pass the promoter_id.

-- 1. Function to auto-attribute promoter_id BEFORE an order is created
CREATE OR REPLACE FUNCTION public.sync_order_promoter_id()
RETURNS TRIGGER AS $$
DECLARE
    v_found_promoter_id UUID;
BEGIN
    -- Only run if promoter_id is missing
    IF NEW.promoter_id IS NULL THEN
        -- Try to find the most recent valid click for this buyer
        -- We look for a click within the last 7 days (standard attribution window)
        SELECT promoter_id INTO v_found_promoter_id
        FROM public.referrals
        WHERE (buyer_id = NEW.buyer_id OR visitor_id = (NEW.shipping_address->>'visitor_id')) -- Optional visitor_id fallback
        AND status = 'click'
        AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_found_promoter_id IS NOT NULL THEN
            NEW.promoter_id := v_found_promoter_id;
            RAISE NOTICE '[Sync] Auto-attributed promoter % to order % based on recent click history', v_found_promoter_id, NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply Sync Trigger
DROP TRIGGER IF EXISTS trg_auto_sync_promoter ON public.orders;
CREATE TRIGGER trg_auto_sync_promoter
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_promoter_id();

-- 3. Function to mark referral as conversion AFTER order is successfully created
CREATE OR REPLACE FUNCTION public.mark_referral_converted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.promoter_id IS NOT NULL THEN
        UPDATE public.referrals
        SET status = 'conversion',
            converted_at = NOW(),
            order_id = NEW.id
        WHERE promoter_id = NEW.promoter_id
        AND (buyer_id = NEW.buyer_id OR visitor_id = (NEW.shipping_address->>'visitor_id'))
        AND status = 'click'
        AND converted_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Conversion Tracker
DROP TRIGGER IF EXISTS trg_mark_referral_converted ON public.orders;
CREATE TRIGGER trg_mark_referral_converted
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.mark_referral_converted();
