-- Revenue Settlement on Delivery
-- Industry standard: Funds are credited to seller wallet upon successful delivery

CREATE OR REPLACE FUNCTION public.handle_revenue_settlement()
RETURNS TRIGGER AS $$
DECLARE
    seller_wallet_id UUID;
    order_total NUMERIC;
BEGIN
    -- Only proceed if status is being changed to 'delivered'
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        
        -- 1. Identify Seller Wallet
        -- We try user_id (profiles) or seller_id (auth.users)
        SELECT id INTO seller_wallet_id 
        FROM public.wallets 
        WHERE seller_id = NEW.seller_id OR user_id = NEW.seller_id
        LIMIT 1;

        -- If no wallet exists, create one
        IF seller_wallet_id IS NULL THEN
            INSERT INTO public.wallets (seller_id, balance)
            VALUES (NEW.seller_id, 0)
            RETURNING id INTO seller_wallet_id;
        END IF;

        -- 2. Calculate Settlement Amount
        -- We use order total (from either 'total' or 'total_amount' depending on schema version)
        -- The scalability migration normalized it to 'total'
        order_total := COALESCE(NEW.total, 0);

        -- 3. Update Balance
        UPDATE public.wallets 
        SET balance = balance + order_total,
            updated_at = now()
        WHERE id = seller_wallet_id;

        -- 4. Record Transaction
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (
            seller_wallet_id, 
            order_total, 
            'settlement', 
            'Order Settlement: #' || NEW.id
        );

        -- 5. Optional: Notify Seller
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
            NEW.seller_id,
            'payment',
            'Revenue of ₦' || order_total || ' has been settled for order #' || LEFT(NEW.id::text, 8)
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Order Status Changes
DROP TRIGGER IF EXISTS tr_order_settlement ON public.orders;
CREATE TRIGGER tr_order_settlement
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_revenue_settlement();
