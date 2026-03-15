-- DIAGNOSTIC: Run this in Supabase SQL Editor to find the exact problem
-- Copy the full output and share it to identify the issue

-- 1. Does the settlement trigger exist?
SELECT 
    tgname AS trigger_name,
    proname AS function_name,
    tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'tr_order_settlement';

-- 2. What is the wallet_transactions.type column datatype?
SELECT 
    column_name,
    data_type,
    udt_name  -- Shows enum type name if it's USER-DEFINED
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'wallet_transactions'
AND column_name = 'type';

-- 3. If type is an ENUM, what values does it have?
SELECT e.enumlabel AS allowed_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = (
    SELECT udt_name FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'wallet_transactions' 
    AND column_name = 'type'
)
ORDER BY e.enumsortorder;

-- 4. Does wallets table have user_id column?
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'wallets';

-- 5. Test: Manually call the trigger by simulating a completion
-- (Replace the ID with a real 'delivered' order ID from your DB)
-- SELECT * FROM public.orders WHERE status = 'delivered' LIMIT 3;
