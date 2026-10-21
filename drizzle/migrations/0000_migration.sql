
create type public.app_role as enum ('admin');
create type public.contact_role as enum ('Sponsor','Estratégico','Champion','Hero User');
create type public.contact_status as enum ('active','left_organization','excluded_from_base');
create type public.mom_stage as enum ('Handoff','Implantação','Go-live','Sustentação');
create type public.invite_channel as enum ('WhatsApp','Email','Presencial');
create type public.invite_status as enum ('not_sent','sent','opened','answered','invalid');
create type public.followup_status as enum ('to_do','in_contact','resolved');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- first user to sign up becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  segment text,
  estimated_annual_revenue numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  job_title text,
  role contact_role,
  status contact_status not null default 'active',
  status_changed_at date,
  status_reason text,
  notes text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.contact_products (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  product text not null,
  mom_stage mom_stage not null,
  unique (contact_id, product)
);
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date,
  target_response_rate numeric not null default 75,
  target_nps numeric not null default 60,
  reference_nps numeric,
  reference_response_rate numeric,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  channel invite_channel not null default 'WhatsApp',
  sent_at timestamptz, reminder_1_at timestamptz, reminder_2_at timestamptz, reminder_3_at timestamptz,
  opened_at timestamptz, answered_at timestamptz,
  status invite_status not null default 'not_sent',
  created_at timestamptz not null default now(),
  unique (cycle_id, contact_id)
);
create table public.responses (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  q1_nps int not null check (q1_nps between 0 and 10),
  q2_reason text not null,
  q3 int check (q3 between 1 and 5), q4 int check (q4 between 1 and 5), q5 int check (q5 between 1 and 5),
  q6 int check (q6 between 1 and 5), q7 int check (q7 between 1 and 5), q8 int check (q8 between 1 and 5),
  q9 int check (q9 between 1 and 5), q9_not_reached boolean not null default false,
  q10 int check (q10 between 1 and 5), q10_not_reached boolean not null default false,
  q11_start text, q12_keep text,
  duration_seconds int, user_agent text,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.followups (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null unique references public.responses(id) on delete cascade,
  owner text, due_date timestamptz,
  status followup_status not null default 'to_do',
  notes text, contact_date date, resolution_date date,
  created_at timestamptz not null default now()
);
create table public.settings (
  id int primary key default 1 check (id = 1),
  template_initial text not null,
  template_reminder_1 text not null,
  template_reminder_2 text not null,
  template_reminder_3 text not null
);

do $$ declare t text; begin
  foreach t in array array['accounts','contacts','contact_products','cycles','invitations','responses','followups','settings'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

-- add business hours (Mon-Fri) helper
create or replace function public.add_business_hours(_from timestamptz, _hours int)
returns timestamptz language plpgsql immutable as $$
declare d timestamptz := _from; remaining int := _hours;
begin
  while remaining > 0 loop
    d := d + interval '1 hour';
    if extract(isodow from d) < 6 then remaining := remaining - 1; end if;
  end loop;
  return d;
end $$;

create or replace function public.create_followup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.q1_nps <= 6 then
    insert into public.followups(response_id, due_date) values (new.id, public.add_business_hours(new.created_at, 48));
  elsif new.q1_nps <= 8 then
    insert into public.followups(response_id, due_date) values (new.id, new.created_at + interval '7 days');
  end if;
  return new;
end $$;
create trigger on_response_followup after insert on public.responses
for each row execute function public.create_followup();

-- Public survey functions (token based)
create or replace function public.survey_get(_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.id, i.status, i.opened_at, c.full_name, c.status as cstatus, a.name as account, cy.closed
    into inv
  from invitations i join contacts c on c.id = i.contact_id
  join accounts a on a.id = c.account_id join cycles cy on cy.id = i.cycle_id
  where i.token = _token;
  if not found then return json_build_object('state','not_found'); end if;
  if inv.cstatus <> 'active' or inv.status = 'invalid' or inv.closed then
    return json_build_object('state','closed');
  end if;
  if inv.status = 'answered' then
    return json_build_object('state','answered','name', inv.full_name, 'account', inv.account);
  end if;
  if inv.opened_at is null then
    update invitations set opened_at = now(), status = 'opened' where id = inv.id;
  end if;
  return json_build_object('state','open','name', inv.full_name, 'account', inv.account);
end $$;

create or replace function public.survey_submit(_token uuid, _a json)
returns json language plpgsql security definer set search_path = public as $$
declare inv record; c_status contact_status; is_t boolean;
begin
  select i.*, c.status as cstatus, c.is_test into inv from invitations i join contacts c on c.id = i.contact_id where i.token = _token for update of i;
  if not found then raise exception 'not_found'; end if;
  if inv.status = 'answered' then return json_build_object('ok', true, 'already', true); end if;
  if inv.cstatus <> 'active' or inv.status = 'invalid' then raise exception 'closed'; end if;
  if (_a->>'q1_nps') is null or length(coalesce(_a->>'q2_reason','')) < 10 then raise exception 'invalid'; end if;
  insert into responses(invitation_id,q1_nps,q2_reason,q3,q4,q5,q6,q7,q8,q9,q9_not_reached,q10,q10_not_reached,q11_start,q12_keep,duration_seconds,user_agent,is_test)
  values (inv.id, (_a->>'q1_nps')::int, _a->>'q2_reason',
    (_a->>'q3')::int,(_a->>'q4')::int,(_a->>'q5')::int,(_a->>'q6')::int,(_a->>'q7')::int,(_a->>'q8')::int,
    (_a->>'q9')::int, coalesce((_a->>'q9_not_reached')::boolean,false),
    (_a->>'q10')::int, coalesce((_a->>'q10_not_reached')::boolean,false),
    nullif(_a->>'q11_start',''), nullif(_a->>'q12_keep',''),
    (_a->>'duration_seconds')::int, left(_a->>'user_agent', 500), inv.is_test);
  update invitations set answered_at = now(), status = 'answered', opened_at = coalesce(opened_at, now()) where id = inv.id;
  return json_build_object('ok', true);
end $$;

grant execute on function public.survey_get(uuid) to anon, authenticated;
grant execute on function public.survey_submit(uuid, json) to anon, authenticated;

-- Seed
insert into public.settings(id, template_initial, template_reminder_1, template_reminder_2, template_reminder_3) values (1,
'Olá, {nome}. A Matria está ouvindo os parceiros sobre a experiência de {instituição} conosco. São 3 minutos e a sua resposta é lida pela liderança. {link}',
'Olá, {nome}. Passando para lembrar da pesquisa sobre a experiência de {instituição} com a Matria. Leva 3 minutos. {link}',
'Olá, {nome}. A sua visão sobre a parceria de {instituição} com a Matria é importante para nós. Ainda dá tempo de responder. {link}',
'Olá, {nome}. Último lembrete da pesquisa da Matria. Encerramos nos próximos dias. {link}');

insert into public.cycles(name, start_date, end_date, target_response_rate, target_nps, reference_nps, reference_response_rate, closed)
values ('Ciclo 1 - Ago/2026', '2026-08-03', '2026-08-31', 75, 50, 50, 71, true);
insert into public.cycles(name, start_date, target_response_rate, target_nps)
values ('Ciclo 2 - Nov/2026', '2026-11-03', 75, 60);

insert into public.accounts(name, segment) values
('Clínica SIM','Cliente'),('Gastrocentro','Cliente'),('Evo Saúde','Cliente'),('Galileu Saúde','Cliente'),
('Opty','Cliente'),('Rede Américas','POC'),('Rede D''Or','Cliente'),('Alvaro Apoio | Dasa','Cliente'),
('Orizonti','POC'),('Suel Abujamra','Cliente'),('Hospitales MAC','Cliente'),('FertGroup','Cliente'),
('IDECO','Cliente'),('ITS','Cliente'),('Alliança','Cliente'),('Fleury','POC'),('Hospital Care','POC'),
('Hospital Israelita Albert Einstein','POC');

with c as (
  insert into public.contacts(account_id, full_name, phone, email, job_title, role, is_test, notes)
  select a.id, v.n, v.p, v.e, v.j, v.r::contact_role, true, 'Dado de teste'
  from (values
    ('Clínica SIM','Ana Teste','+5511900000001','ana.teste@exemplo.com','Diretora de Operações','Sponsor'),
    ('Gastrocentro','Bruno Teste','+5511900000002','bruno.teste@exemplo.com','Coordenador de Atendimento','Champion'),
    ('Evo Saúde','Carla Teste','+5511900000003','carla.teste@exemplo.com','Supervisora de Agendamento','Hero User')
  ) v(acc,n,p,e,j,r) join public.accounts a on a.name = v.acc
  returning id, full_name
)
insert into public.contact_products(contact_id, product, mom_stage)
select id, 'Agendamento com IA', (case full_name when 'Ana Teste' then 'Sustentação' when 'Bruno Teste' then 'Go-live' else 'Implantação' end)::mom_stage from c;

insert into public.invitations(cycle_id, contact_id, status, sent_at, opened_at, answered_at)
select cy.id, c.id, 'answered', '2026-11-03 12:00+00', '2026-11-03 13:00+00', '2026-11-03 13:05+00'
from public.contacts c, public.cycles cy where c.is_test and cy.name = 'Ciclo 2 - Nov/2026';

insert into public.responses(invitation_id,q1_nps,q2_reason,q3,q4,q5,q6,q7,q8,q9,q10,q10_not_reached,q11_start,q12_keep,duration_seconds,is_test,created_at)
select i.id, v.nps, v.reason, v.q3,v.q4,v.q5,v.q6,v.q7,v.q8,v.q9,v.q10,v.nr,v.s,v.k,180,true,'2026-11-03 13:05+00'
from public.invitations i join public.contacts c on c.id = i.contact_id
join (values
  ('Ana Teste',10,'Time muito próximo e entregas no prazo.',5,5,4,5,5,4,5,5,false,'Relatórios mensais de resultado.','A proximidade do time.'),
  ('Bruno Teste',8,'Boa solução, mas o suporte demora às vezes.',4,4,3,4,4,3,4,3,false,'Responder mais rápido no suporte.','A qualidade do agendamento.'),
  ('Carla Teste',5,'A implantação está atrasada e falta clareza.',2,3,3,3,3,2,null,null,true,'Comunicar melhor o cronograma.',null)
) v(n,nps,reason,q3,q4,q5,q6,q7,q8,q9,q10,nr,s,k) on v.n = c.full_name;
