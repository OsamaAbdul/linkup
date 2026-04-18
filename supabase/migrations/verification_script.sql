-- Verification script for Logistics settlement fix
-- Run this in the Supabase SQL Editor or via psql

-- 1. Create a dummy order with a high total
INSERT INTO public.orders (id, seller_id, buyer_id, total_amount, status)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 10000, 'awaiting_agent');

-- 2. Create a shipment for this order
INSERT INTO public.shipments (order_id, seller_id, status, delivery_fee_amount, cross_zone_fee_amount)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'broadcast', 1500, 500);

-- 3. Simulate rider claiming the mission
UPDATE public.shipments SET rider_id = '00000000-0000-0000-0000-000000000004', status = 'accepted' 
WHERE order_id = '00000000-0000-0000-0000-000000000001';

-- 4. Mark as delivered (Triggers rider payout)
UPDATE public.shipments SET status = 'delivered' WHERE order_id = '00000000-0000-0000-0000-000000000001';

-- 5. Mark order as completed (Triggers seller payout)
UPDATE public.orders SET status = 'completed' WHERE id = '00000000-0000-0000-0000-000000000001';

-- 6. Check results
SELECT 'Rider Payout Check' as label, amount as rider_amount 
FROM public.wallet_transactions 
WHERE (metadata->>'order_id') = '00000000-0000-0000-0000-000000000001' AND type = 'delivery_fee';

SELECT 'Seller Payout Check' as label, amount as seller_amount 
FROM public.wallet_transactions 
WHERE (metadata->>'order_id') = '00000000-0000-0000-0000-000000000001' AND type = 'settlement';

-- Expected Rider: (1500 + 500) - 300 = 1700
-- Expected Seller: 10000 - (10000 * 0.05 platform?) - (rider_fees) ... 
