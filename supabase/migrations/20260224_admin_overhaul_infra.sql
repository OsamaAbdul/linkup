-- Admin Management & Support Infrastructure

-- 1. Create Issues Table
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'delivery', 'payment', 'product', 'technical'
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id)
);

-- RLS for Issues
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own issues" ON public.issues
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create issues" ON public.issues
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all issues" ON public.issues
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 2. Audit Logs Table for System History
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL, -- 'delete_user', 'resolve_issue', 'update_order'
    actor_id UUID REFERENCES public.profiles(id),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Admin User Deletion RPC (SECURITY DEFINER to handle sensitive deletes)
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only admins can call this
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Avoid deleting your own account
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'Cannot delete your own admin account';
    END IF;

    -- Log the action
    INSERT INTO public.audit_logs (action, actor_id, target_id, details)
    VALUES ('delete_user', auth.uid(), target_user_id, jsonb_build_object('timestamp', now()));

    -- Delete roles
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    
    -- Delete profile
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- Note: This doesn't delete from auth.users (requires service_role)
    -- But deleting the profile and roles effectively "kills" the account in our application logic.
END;
$$;
