-- Add onboarding_completed column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users: if they have a role, mark as completed
UPDATE profiles 
SET onboarding_completed = TRUE 
WHERE id IN (SELECT user_id FROM user_roles);

-- Alternatively, keep it simple and just let them complete it once more if they haven't.
-- But marking based on role presence is safer for existing users.
