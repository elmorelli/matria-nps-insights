ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'deployment';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = ANY(_roles))
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','account_products','contacts','contact_products','contact_events','cycles','invitations','followups','responses','response_answers','questionnaires','questions','option_lists','settings']
  LOOP
    EXECUTE format('CREATE POLICY "panel read" ON public.%I FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY[''deployment'',''viewer'']))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['cycles','invitations','followups']
  LOOP
    EXECUTE format('CREATE POLICY "deployment write" ON public.%I FOR ALL TO authenticated USING (public.has_any_role(auth.uid(), ARRAY[''deployment''])) WITH CHECK (public.has_any_role(auth.uid(), ARRAY[''deployment'']))', t);
  END LOOP;
END $$;