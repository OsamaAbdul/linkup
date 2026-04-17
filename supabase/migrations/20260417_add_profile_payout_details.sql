-- Migration to add payout-related bank details to profiles
-- Purpose: Allow users (riders/sellers) to save bank details for future withdrawals.

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS payout_bank_name TEXT,
ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
ADD COLUMN IF NOT EXISTS payout_account_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.payout_bank_name IS 'The saved bank name for user withdrawals';
COMMENT ON COLUMN profiles.payout_account_number IS 'The saved 10-digit account number for user withdrawals';
COMMENT ON COLUMN profiles.payout_account_name IS 'The saved full account name for user withdrawals';
