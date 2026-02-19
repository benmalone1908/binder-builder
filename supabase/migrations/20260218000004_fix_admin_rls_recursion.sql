-- Fix: Replace self-referential admin RLS policies with SECURITY DEFINER function
-- The previous policies caused recursive RLS evaluation on user_profiles

-- Create a SECURITY DEFINER function that checks admin status without RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop the problematic self-referential policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;

-- Recreate using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON public.user_profiles
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());
