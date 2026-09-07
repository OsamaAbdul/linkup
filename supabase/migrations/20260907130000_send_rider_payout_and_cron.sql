-- ========================================================================
-- MIGRATION: LinkUp Send Rider Automated Payout & Customizable Cron Job
-- ========================================================================

-- 1. Extend public.send_orders to track rider payout lifecycle
ALTER TABLE public.send_orders
ADD COLUMN IF NOT EXISTS rider_payout_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rider_payout_status VARCHAR(30) DEFAULT 'pending' CHECK (rider_payout_status IN ('pending', 'held', 'released', 'refunded', 'disputed')),
ADD COLUMN IF NOT EXISTS rider_payout_released_at TIMESTAMPTZ;

-- Backfill existing delivered send_orders as released or held
UPDATE public.send_orders
SET rider_payout_status = 'released',
    rider_payout_released_at = COALESCE(delivered_at, updated_at)
WHERE status = 'delivered' AND (rider_payout_status IS NULL OR rider_payout_status = 'pending');

-- 2. Seed System Setting for Send Rider Payout Delay (default: 24 hours, 0 = instant)
INSERT INTO public.system_settings (key, value)
VALUES ('send_rider_payout_delay_hours', '24'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Update the status change trigger on send_orders
-- Supports both instant release (0 hours) or escrow hold (> 0 hours) based on admin configuration
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
BEGIN
    -- Record in tracking logs
    INSERT INTO public.send_order_tracking_logs (order_id, status, latitude, longitude, notes)
    VALUES (
        NEW.id, 
        NEW.status, 
        NEW.rider_lat, 
        NEW.rider_lng, 
        CASE NEW.status
            WHEN 'assigned_rider' THEN 'Rider accepted mission and is assigned'
            WHEN 'pickup' THEN 'Rider arrived at pickup location'
            WHEN 'on_the_way' THEN 'Package picked up and in transit'
            WHEN 'delivered' THEN 'Package successfully delivered'
            WHEN 'cancelled' THEN 'Package delivery cancelled'
            ELSE 'Status updated to ' || NEW.status::text
        END
    );

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

-- 4. Automated Cron Job RPC: process_send_rider_payout_releases()
-- Runs regularly to release held send order payouts after the configured delay hours
CREATE OR REPLACE FUNCTION public.process_send_rider_payout_releases()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_delay_hours INT := 24;
    v_released_count INT := 0;
    v_total_released_amount NUMERIC := 0;
    v_rec RECORD;
    v_rider_wallet_id UUID;
    v_payout_amount NUMERIC := 0;
BEGIN
    -- Read admin-configured delay in hours
    SELECT COALESCE((value #>> '{}')::INT, 24) INTO v_delay_hours
    FROM public.system_settings
    WHERE key = 'send_rider_payout_delay_hours';

    IF v_delay_hours IS NULL OR v_delay_hours < 0 THEN
        v_delay_hours := 24;
    END IF;

    -- Iterate through all delivered packages where payout is still held and hold time has elapsed
    FOR v_rec IN 
        SELECT id, rider_id, rider_payout_amount, delivery_fee
        FROM public.send_orders
        WHERE status = 'delivered'
        AND rider_payout_status = 'held'
        AND rider_id IS NOT NULL
        AND delivered_at <= (NOW() - (v_delay_hours || ' hours')::INTERVAL)
    LOOP
        v_payout_amount := v_rec.rider_payout_amount;
        IF v_payout_amount IS NULL OR v_payout_amount <= 0 THEN
            v_payout_amount := GREATEST(1000, round(COALESCE(v_rec.delivery_fee, 1500) * 0.80));
        END IF;

        -- Find or create rider wallet
        SELECT id INTO v_rider_wallet_id FROM public.wallets WHERE user_id = v_rec.rider_id LIMIT 1;
        IF v_rider_wallet_id IS NULL THEN
            INSERT INTO public.wallets (user_id, balance, escrow_balance)
            VALUES (v_rec.rider_id, 0, 0) RETURNING id INTO v_rider_wallet_id;
        END IF;

        IF v_rider_wallet_id IS NOT NULL AND v_payout_amount > 0 THEN
            -- Move funds from escrow_balance to balance
            UPDATE public.wallets
            SET balance = balance + v_payout_amount,
                escrow_balance = GREATEST(0, escrow_balance - v_payout_amount),
                version = version + 1,
                updated_at = NOW()
            WHERE id = v_rider_wallet_id;

            -- Record settlement transaction with unique idempotency key
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, idempotency_key)
            VALUES (
                v_rider_wallet_id,
                v_payout_amount,
                'settlement',
                'Escrow release for Send Package ' || v_rec.id,
                'send_rider_release_' || v_rec.id
            )
            ON CONFLICT (idempotency_key) DO NOTHING;

            -- Update send order payout status
            UPDATE public.send_orders
            SET rider_payout_status = 'released',
                rider_payout_released_at = NOW(),
                updated_at = NOW()
            WHERE id = v_rec.id;

            -- Send payout notification to rider
            INSERT INTO public.notifications (user_id, type, message, read, created_at)
            VALUES (
                v_rec.rider_id,
                'payment',
                'Delivery payout of ₦' || v_payout_amount || ' for package ' || v_rec.id || ' has been released to your available balance.',
                false,
                NOW()
            );

            v_released_count := v_released_count + 1;
            v_total_released_amount := v_total_released_amount + v_payout_amount;
        END IF;
    END LOOP;

    RAISE LOG 'Send rider payout cron finished: % packages released, total ₦%', v_released_count, v_total_released_amount;

    RETURN jsonb_build_object(
        'success', true,
        'delay_hours', v_delay_hours,
        'released_count', v_released_count,
        'total_amount', v_total_released_amount
    );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.process_send_rider_payout_releases() TO postgres, service_role, authenticated;

-- 5. Schedule hourly execution via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process_send_rider_payout_releases') THEN
        PERFORM cron.unschedule('process_send_rider_payout_releases');
    END IF;

    PERFORM cron.schedule(
        'process_send_rider_payout_releases',
        '0 * * * *',
        'SELECT public.process_send_rider_payout_releases()'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule notice for send rider payout releases: %', SQLERRM;
END $$;
