-- Update run_settlements to include order_id in metadata for easier UI reconciliation
CREATE OR REPLACE FUNCTION public.run_settlements()
RETURNS TABLE (processed_count INTEGER) AS $$
DECLARE
    v_order RECORD;
    v_fees JSONB;
    v_rider_id UUID;
    v_seller_wallet_id UUID;
    v_rider_wallet_id UUID;
    v_promoter_wallet_id UUID;
    v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    processed_count := 0;
    
    FOR v_order IN (
        SELECT * FROM public.orders 
        WHERE status = 'completed' 
        AND settlement_status = 'pending' 
        AND settlement_due_at <= NOW()
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            v_fees := public.calculate_order_fees(v_order.id);
            
            -- 1. Deduct from Seller Escrow
            SELECT id INTO v_seller_wallet_id FROM public.wallets WHERE user_id = v_order.seller_id;
            UPDATE public.wallets 
            SET escrow_balance = escrow_balance - (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC)
            WHERE id = v_seller_wallet_id;

            -- 2. Credit Seller Balance (WITH METADATA)
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, metadata)
            VALUES (
                v_seller_wallet_id, 
                (v_order.total - (v_fees->>'rider')::NUMERIC - (v_fees->>'platform')::NUMERIC - (v_fees->>'promoter')::NUMERIC), 
                'settlement', 
                'Settlement: Order #' || v_order.id,
                jsonb_build_object('order_id', v_order.id)
            );

            -- 3. Credit Platform
            UPDATE public.platform_wallets SET balance = balance + (v_fees->>'platform')::NUMERIC WHERE id = v_platform_wallet_id;

            -- 4. Credit Promoter (WITH METADATA)
            IF v_order.promoter_id IS NOT NULL THEN
                SELECT id INTO v_promoter_wallet_id FROM public.wallets WHERE user_id = v_order.promoter_id;
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, metadata)
                VALUES (
                    v_promoter_wallet_id, 
                    (v_fees->>'promoter')::NUMERIC, 
                    'commission', 
                    'Commission: Order #' || v_order.id,
                    jsonb_build_object('order_id', v_order.id)
                );
            END IF;

            -- 5. Credit Rider (WITH METADATA)
            SELECT rider_id INTO v_rider_id FROM public.shipments WHERE order_id = v_order.id LIMIT 1;
            IF v_rider_id IS NOT NULL THEN
                SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rider_id;
                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, metadata)
                VALUES (
                    v_rider_wallet_id, 
                    (v_fees->>'rider')::NUMERIC, 
                    'delivery_fee', 
                    'Delivery: Order #' || v_order.id,
                    jsonb_build_object('order_id', v_order.id)
                );
            END IF;

            UPDATE public.orders SET settlement_status = 'settled' WHERE id = v_order.id;
            processed_count := processed_count + 1;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.orders SET settlement_status = 'failed' WHERE id = v_order.id;
            RAISE WARNING 'Settlement failed for order %: %', v_order.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
