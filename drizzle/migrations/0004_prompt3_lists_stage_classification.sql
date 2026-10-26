CREATE TABLE public.option_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list text NOT NULL CHECK (list IN ('role','product','account_status','account_tier','account_type','country')),
  value text NOT NULL,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.option_lists TO authenticated;
GRANT ALL ON public.option_lists TO service_role;
ALTER TABLE public.option_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all option_lists" ON public.option_lists FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.option_lists(list,value,position,extra) VALUES
('role','Sponsor',1,'{}'),('role','Estratégico',2,'{}'),('role','Champion',3,'{}'),('role','Hero User',4,'{}'),
('account_status','Ativo',1,'{}'),('account_status','POC',2,'{}'),('account_status','Implantação',3,'{}'),('account_status','Churn',4,'{}'),('account_status','Suspenso',5,'{}'),
('account_tier','Diamante',1,'{}'),('account_tier','Ouro',2,'{}'),('account_tier','Prata',3,'{}'),('account_tier','Bronze',4,'{}'),('account_tier','Latão',5,'{}'),
('account_type','Hospital',1,'{}'),('account_type','Clínica',2,'{}'),('account_type','Laboratório',3,'{}'),('account_type','Operadora',4,'{}'),('account_type','Outro',5,'{}'),
('country','BR',1,'{"label":"Brasil","ddi":"+55","flag":"🇧🇷"}'),('country','MX',2,'{"label":"México","ddi":"+52","flag":"🇲🇽"}');
INSERT INTO public.option_lists(list,value,position)
SELECT 'product', product, row_number() over (order by product) FROM (SELECT DISTINCT product FROM public.contact_products) p ON CONFLICT DO NOTHING;

ALTER TABLE public.contacts ADD COLUMN papel text;
UPDATE public.contacts SET papel = role::text;
ALTER TABLE public.contacts ALTER COLUMN role DROP NOT NULL;
COMMENT ON COLUMN public.contacts.role IS 'DEPRECATED: replaced by papel (configurable list)';

ALTER TABLE public.accounts ADD COLUMN status text, ADD COLUMN tier text;
UPDATE public.accounts SET status = CASE WHEN segment='POC' THEN 'POC' ELSE 'Ativo' END, tier='Prata',
  segment = CASE WHEN segment IN ('POC','Cliente') OR segment IS NULL THEN 'Hospital' ELSE segment END,
  country = coalesce(country,'BR');

CREATE TABLE public.account_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product text NOT NULL,
  mom_stage public.mom_stage NOT NULL DEFAULT 'Handoff',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, product)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_products TO authenticated;
GRANT ALL ON public.account_products TO service_role;
ALTER TABLE public.account_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all account_products" ON public.account_products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.account_products(account_id, product, mom_stage)
SELECT c.account_id, cp.product, max(cp.mom_stage) FROM public.contact_products cp JOIN public.contacts c ON c.id=cp.contact_id GROUP BY 1,2;
ALTER TABLE public.contact_products ALTER COLUMN mom_stage DROP NOT NULL;
COMMENT ON COLUMN public.contact_products.mom_stage IS 'DEPRECATED: stage lives in account_products';
CREATE OR REPLACE FUNCTION public.touch_account_product() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_touch_account_product BEFORE UPDATE ON public.account_products FOR EACH ROW EXECUTE FUNCTION public.touch_account_product();

ALTER TABLE public.settings ADD COLUMN preview_title text NOT NULL DEFAULT 'Pesquisa Matria. 3 minutos',
  ADD COLUMN preview_description text NOT NULL DEFAULT 'Sua opinião sobre a parceria com a Matria.',
  ADD COLUMN duration_text text NOT NULL DEFAULT 'Leva uns 3 minutos';

CREATE OR REPLACE FUNCTION public.survey_preview_meta() RETURNS TABLE(title text, description text, duration text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT preview_title, preview_description, duration_text FROM public.settings ORDER BY id LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION public.survey_preview_meta() TO anon, authenticated;