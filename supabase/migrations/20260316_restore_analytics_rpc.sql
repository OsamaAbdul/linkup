-- Restore missing get_seller_analytics RPC
-- This function provides revenue and order stats for the seller dashboard.

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

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID) TO service_role;
