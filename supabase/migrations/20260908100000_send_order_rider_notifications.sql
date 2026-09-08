-- ========================================================================
-- MIGRATION: Send Order Rider Notifications
-- Adds logic to notify available riders when a Send Order is finding_rider
-- ========================================================================

CREATE OR REPLACE FUNCTION public.handle_send_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rider_rate NUMERIC := 0.80;
    v_rider_min NUMERIC := 1000;
    v_rider_payout NUMERIC := 0;
    v_rider_wallet_id UUID;
    v_delay_hours INT := 24;
    v_rider_id UUID;
    v_zone_id UUID;
BEGIN
    -- Record in tracking logs
    INSERT INTO public.send_order_tracking_logs (order_id, status, latitude, longitude, notes)
    VALUES (
        NEW.id, 
        NEW.status, 
        NEW.rider_lat, 
        NEW.rider_lng, 
        CASE NEW.status
            WHEN 'finding_rider' THEN 'Searching for an available rider'
            WHEN 'assigned_rider' THEN 'Rider accepted mission and is assigned'
            WHEN 'pickup' THEN 'Rider arrived at pickup location'
            WHEN 'on_the_way' THEN 'Package picked up and in transit'
            WHEN 'delivered' THEN 'Package successfully delivered'
            WHEN 'cancelled' THEN 'Package delivery cancelled'
            ELSE 'Status updated to ' || NEW.status::text
        END
    );

    -- NEW: Notify riders when order status becomes 'finding_rider'
    IF NEW.status = 'finding_rider' AND (OLD.status IS DISTINCT FROM 'finding_rider') THEN
        -- Get sender's zone_id as best guess for pickup location
        SELECT zone_id INTO v_zone_id FROM public.profiles WHERE id = NEW.user_id;
        
        IF v_zone_id IS NOT NULL THEN
            -- Notify logistics riders in this zone
            FOR v_rider_id IN 
                SELECT p.id 
                FROM public.profiles p
                JOIN public.user_roles ur ON ur.user_id = p.id
                WHERE ur.role = 'logistics' AND p.zone_id = v_zone_id
            LOOP
                INSERT INTO public.notifications (user_id, type, message, read, created_at)
                VALUES (
                    v_rider_id,
                    'delivery',
                    'A new LinkUp Send mission is available in your zone. Package #' || NEW.id || '.',
                    false,
                    NOW()
                );
            END LOOP;
        ELSE
            -- Fallback: Notify ALL logistics riders
            FOR v_rider_id IN 
                SELECT user_id FROM public.user_roles WHERE role = 'logistics'
            LOOP
                INSERT INTO public.notifications (user_id, type, message, read, created_at)
                VALUES (
                    v_rider_id,
                    'delivery',
                    'A new LinkUp Send mission is available. Package #' || NEW.id || '.',
                    false,
                    NOW()
                );
            END LOOP;
        END IF;
    END IF;

    -- If status transitioned to delivered
    IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
        IF NEW.delivered_at IS NULL THEN
            NEW.delivered_at := NOW();
        END IF;

        -- 1. Send in-app notification to sender
        IF NEW.user_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, type, message, read, created_at)
            VALUES (
                NEW.user_id,
                'Package Delivered',
                'Your package with tracking number ' || NEW.id || ' has been successfully delivered to ' || NEW.dropoff_recipient_name || ' at ' || NEW.dropoff_address || ' by ' || COALESCE(NEW.rider_name, 'your dispatch rider') || '.',
                false,
                NOW()
            );
        END IF;

        -- 2. Calculate and process Rider Earnings
        IF NEW.rider_id IS NOT NULL THEN
            SELECT COALESCE(rate, 0.80) INTO v_rider_rate 
            FROM public.fee_config 
            WHERE fee_type = 'send_rider_payout_rate' AND is_active = true;
            IF v_rider_rate IS NULL OR v_rider_rate <= 0 THEN v_rider_rate := 0.80; END IF;

            SELECT COALESCE(flat_fee, 1000) INTO v_rider_min 
            FROM public.fee_config 
            WHERE fee_type = 'send_rider_min_payout' AND is_active = true;
            IF v_rider_min IS NULL THEN v_rider_min := 1000; END IF;

            v_rider_payout := GREATEST(v_rider_min, round(COALESCE(NEW.delivery_fee, 1500) * v_rider_rate));
            NEW.rider_payout_amount := v_rider_payout;

            -- Check admin configured delay hours
            SELECT COALESCE((value #>> '{}')::INT, 24) INTO v_delay_hours
            FROM public.system_settings
            WHERE key = 'send_rider_payout_delay_hours';

            IF v_delay_hours IS NULL OR v_delay_hours < 0 THEN
                v_delay_hours := 24;
            END IF;

            -- Find or create rider wallet
            SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = NEW.rider_id LIMIT 1;
            IF v_rider_wallet_id IS NULL THEN
                INSERT INTO public.wallets (user_id, balance, escrow_balance)
                VALUES (NEW.rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
            END IF;

            IF v_rider_wallet_id IS NOT NULL THEN
                IF v_delay_hours <= 0 THEN
                    -- INSTANT RELEASE: Direct to available balance
                    NEW.rider_payout_status := 'released';
                    NEW.rider_payout_released_at := NOW();

                    UPDATE public.wallets 
                    SET balance = balance + v_rider_payout,
                        version = version + 1,
                        updated_at = NOW()
                    WHERE id = v_rider_wallet_id;

                    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, idempotency_key)
                    VALUES (
                        v_rider_wallet_id, 
                        v_rider_payout, 
                        'settlement', 
                        'Instant delivery payout for Package ' || NEW.id,
                        'send_rider_instant_' || NEW.id
                    )
                    ON CONFLICT (idempotency_key) DO NOTHING;

                    INSERT INTO public.notifications (user_id, type, message, read, created_at)
                    VALUES (
                        NEW.rider_id,
                        'payment',
                        'Delivery payout of ₦' || v_rider_payout || ' has been added to your available wallet balance for package ' || NEW.id || '.',
                        false,
                        NOW()
                    );
                ELSE
                    -- ESCROW HOLD: Held until release delay (e.g. 24 hours)
                    NEW.rider_payout_status := 'held';

                    UPDATE public.wallets 
                    SET escrow_balance = escrow_balance + v_rider_payout,
                        version = version + 1,
                        updated_at = NOW()
                    WHERE id = v_rider_wallet_id;

                    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, idempotency_key)
                    VALUES (
                        v_rider_wallet_id, 
                        v_rider_payout, 
                        'escrow_credit', 
                        'Delivery earnings held in escrow for Package ' || NEW.id,
                        'send_rider_escrow_' || NEW.id
                    )
                    ON CONFLICT (idempotency_key) DO NOTHING;

                    INSERT INTO public.notifications (user_id, type, message, read, created_at)
                    VALUES (
                        NEW.rider_id,
                        'escrow_credit',
                        'Delivery cut of ₦' || v_rider_payout || ' has been placed in escrow for package ' || NEW.id || ' and will be released to your available balance in ' || v_delay_hours || ' hour(s).',
                        false,
                        NOW()
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
