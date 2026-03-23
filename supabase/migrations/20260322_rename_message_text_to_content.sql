-- MIGRATION: 20260322_rename_message_text_to_content
-- Renames the 'text' column to 'content' in the 'messages' table to match frontend expectations.

DO $$ 
BEGIN
    -- Check if 'text' column exists and 'content' column does not
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'text'
    ) AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'content'
    ) THEN
        ALTER TABLE public.messages RENAME COLUMN "text" TO "content";
    END IF;

    -- If 'content' doesn't exist at all (rare but possible), add it
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'content'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN "content" TEXT NOT NULL DEFAULT '';
    END IF;
END $$;
