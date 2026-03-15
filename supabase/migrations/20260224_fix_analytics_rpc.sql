-- Fix get_seller_analytics RPC
-- The previous version used 'completed' which is not in the order_status enum, causing 400 errors.

CREATE OR REPLACE FUNCTION public.get_seller_analytics(seller_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(total), 0),
        'total_orders', COUNT(*),
        'active_products', (SELECT COUNT(*) FROM public.products WHERE seller_id = seller_uuid),
        'avg_order_value', CASE WHEN COUNT(*) > 0 THEN SUM(total) / COUNT(*) ELSE 0 END
    ) INTO result
    FROM public.orders
    WHERE seller_id = seller_uuid AND status = 'delivered';
    
    RETURN result;
END;
$$;
