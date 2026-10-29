ALTER TABLE public.account_products ALTER COLUMN mom_stage DROP DEFAULT;
ALTER TABLE public.account_products ALTER COLUMN mom_stage DROP NOT NULL;
COMMENT ON COLUMN public.account_products.mom_stage IS 'DEPRECATED: MOM stage removed from the app';
COMMENT ON COLUMN public.contact_products.mom_stage IS 'DEPRECATED: MOM stage removed from the app';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS iad text, ADD COLUMN IF NOT EXISTS kae text;
COMMENT ON COLUMN public.accounts.city IS 'DEPRECATED: city removed from the app';
ALTER TABLE public.cycles ADD COLUMN IF NOT EXISTS targets_set_at timestamptz NOT NULL DEFAULT now();
UPDATE public.cycles SET targets_set_at = created_at;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS program_target_rate numeric NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS program_target_nps numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS program_targets_set_at date NOT NULL DEFAULT current_date;
CREATE SEQUENCE IF NOT EXISTS public.questionnaire_code_seq;
GRANT USAGE ON SEQUENCE public.questionnaire_code_seq TO authenticated, service_role;
ALTER TABLE public.questionnaires ADD COLUMN IF NOT EXISTS code text UNIQUE;
UPDATE public.questionnaires q SET code = 'Q-' || lpad(nextval('public.questionnaire_code_seq')::text, 4, '0')
  FROM (SELECT id FROM public.questionnaires WHERE code IS NULL ORDER BY created_at) o WHERE o.id = q.id;
CREATE OR REPLACE FUNCTION public.set_questionnaire_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL THEN NEW.code := 'Q-' || lpad(nextval('public.questionnaire_code_seq')::text, 4, '0'); END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.keep_questionnaire_code() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.code := OLD.code; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS questionnaires_code ON public.questionnaires;
CREATE TRIGGER questionnaires_code BEFORE INSERT ON public.questionnaires FOR EACH ROW EXECUTE FUNCTION public.set_questionnaire_code();
DROP TRIGGER IF EXISTS questionnaires_code_keep ON public.questionnaires;
CREATE TRIGGER questionnaires_code_keep BEFORE UPDATE OF code ON public.questionnaires FOR EACH ROW EXECUTE FUNCTION public.keep_questionnaire_code();