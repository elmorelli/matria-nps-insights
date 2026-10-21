create type public.question_kind as enum ('nps','likert','likert_nr','text');

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  position int not null,
  key text not null,
  kind public.question_kind not null,
  text text not null,
  required boolean not null default false,
  min_chars int,
  block text not null,
  block_note text,
  unique (questionnaire_id, key)
);
create table public.response_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  question_key text not null,
  value_num int,
  value_text text,
  not_reached boolean not null default false
);
create index response_answers_resp_idx on public.response_answers(response_id);

do $$ declare t text; begin
  foreach t in array array['questionnaires','questions','response_answers'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

-- the nps question is locked
create or replace function public.protect_nps_question()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.key = 'nps' then raise exception 'A pergunta de NPS não pode ser removida.'; end if;
    return old;
  end if;
  if old.key = 'nps' and (new.key <> old.key or new.text <> old.text or new.position <> old.position or new.kind <> old.kind) then
    raise exception 'A pergunta de NPS não pode ser alterada.';
  end if;
  return new;
end $$;
create trigger questions_protect_nps before update or delete on public.questions
  for each row execute function public.protect_nps_question();

-- seed questionnaire v1
with q as (
  insert into public.questionnaires(name, version, active) values ('Questionário relacional v1', 1, true) returning id
)
insert into public.questions(questionnaire_id, position, key, kind, text, required, min_chars, block, block_note)
select q.id, v.pos, v.key, v.kind::public.question_kind, v.text, v.req, v.minc, v.block, v.note from q, (values
 (1,'nps','nps','Em uma escala de 0 a 10, o quanto você recomendaria a Matria para um colega de outra instituição de saúde?',true,null::int,'Sua nota','Obrigatório'),
 (2,'motivo','text','O que mais pesou na sua nota?',true,10,'Sua nota','Obrigatório'),
 (3,'clareza','likert','A Matria comunica com clareza o que vai acontecer, quando e quem é responsável.',true,null,'Relacionamento','Escala de 1 a 5'),
 (4,'confianca','likert','Tenho confiança de que a Matria vai entregar o que foi combinado.',true,null,'Relacionamento','Escala de 1 a 5'),
 (5,'agilidade','likert','Quando preciso de algo, o time da Matria responde com agilidade.',true,null,'Relacionamento','Escala de 1 a 5'),
 (6,'qualidade','likert','Quando preciso de algo, o time da Matria resolve com qualidade.',true,null,'Relacionamento','Escala de 1 a 5'),
 (7,'entende','likert','O time da Matria entende a realidade da minha instituição.',true,null,'Relacionamento','Escala de 1 a 5'),
 (8,'facilidade','likert','É fácil tratar assuntos com a Matria (contatos certos, sem retrabalho).',true,null,'Relacionamento','Escala de 1 a 5'),
 (9,'estavel','likert_nr','A solução da Matria funciona de forma estável no meu dia a dia.',true,null,'Solução','Escala de 1 a 5 ou ''Ainda não chegamos nesta etapa'''),
 (10,'resultados','likert_nr','A solução da Matria já está gerando os resultados que esperávamos ao contratar.',true,null,'Solução','Escala de 1 a 5 ou ''Ainda não chegamos nesta etapa'''),
 (11,'comecar','text','O que a Matria deveria começar a fazer ou fazer diferente?',false,null,'Para fechar','Opcional'),
 (12,'manter','text','O que a Matria faz hoje que você não gostaria que mudasse?',false,null,'Para fechar','Opcional')
) as v(pos,key,kind,text,req,minc,block,note);

-- cycles: questionnaire + own templates
alter table public.cycles add column questionnaire_id uuid references public.questionnaires(id);
alter table public.cycles add column template_initial text not null default '';
alter table public.cycles add column template_reminder_1 text not null default '';
alter table public.cycles add column template_reminder_2 text not null default '';
alter table public.cycles add column template_reminder_3 text not null default '';
update public.cycles set questionnaire_id = (select id from public.questionnaires where version = 1 order by created_at limit 1) where questionnaire_id is null;
update public.cycles c set template_initial = s.template_initial, template_reminder_1 = s.template_reminder_1,
  template_reminder_2 = s.template_reminder_2, template_reminder_3 = s.template_reminder_3
  from public.settings s where s.id = 1;
comment on table public.settings is 'DEPRECATED: templates now live on each cycle';

-- accounts extra fields
alter table public.accounts add column country text check (country in ('BR','MX'));
alter table public.accounts add column city text;
alter table public.accounts add column notes text;
alter table public.accounts add column owner_name text;
alter table public.accounts add column logo_url text;

-- backfill response_answers from legacy columns
insert into public.response_answers(response_id, question_id, question_key, value_num, value_text, not_reached)
select r.id, q.id, q.key,
  case q.key when 'nps' then r.q1_nps when 'clareza' then r.q3 when 'confianca' then r.q4 when 'agilidade' then r.q5
    when 'qualidade' then r.q6 when 'entende' then r.q7 when 'facilidade' then r.q8 when 'estavel' then r.q9 when 'resultados' then r.q10 end,
  case q.key when 'motivo' then r.q2_reason when 'comecar' then r.q11_start when 'manter' then r.q12_keep end,
  case q.key when 'estavel' then r.q9_not_reached when 'resultados' then r.q10_not_reached else false end
from public.responses r
join public.invitations i on i.id = r.invitation_id
join public.cycles c on c.id = i.cycle_id
join public.questions q on q.questionnaire_id = c.questionnaire_id;

-- new token-only survey functions
create or replace function public.survey_confirm(_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare inv record; qs json;
begin
  select i.id, i.contact_id, i.cycle_id, i.status, i.opened_at, c.full_name, c.status as cstatus, a.name as account, cy.closed, cy.questionnaire_id into inv
  from invitations i join contacts c on c.id = i.contact_id join accounts a on a.id = c.account_id join cycles cy on cy.id = i.cycle_id
  where i.token = _token;
  if not found then return json_build_object('state','not_found'); end if;
  if inv.cstatus <> 'active' or inv.status = 'invalid' or inv.closed then return json_build_object('state','closed'); end if;
  if inv.status = 'answered' then return json_build_object('state','answered','account', inv.account); end if;
  if inv.opened_at is null then
    update invitations set opened_at = now(), status = 'opened' where id = inv.id;
  end if;
  insert into contact_events(contact_id, cycle_id, event) values (inv.contact_id, inv.cycle_id, 'identidade_confirmada');
  select coalesce(json_agg(json_build_object('key',q.key,'kind',q.kind,'text',q.text,'required',q.required,'min_chars',q.min_chars,'block',q.block,'block_note',q.block_note) order by q.position), '[]'::json)
    into qs from questions q where q.questionnaire_id = inv.questionnaire_id;
  return json_build_object('state','open','name', inv.full_name, 'account', inv.account, 'questions', qs);
end $$;

create or replace function public.survey_decline(_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.contact_id, i.cycle_id into inv from invitations i where i.token = _token;
  if not found then return json_build_object('ok', false); end if;
  insert into contact_events(contact_id, cycle_id, event) values (inv.contact_id, inv.cycle_id, 'identificacao_recusada');
  return json_build_object('ok', true);
end $$;

-- pre-confirmation status now also returns name for the greeting
create or replace function public.survey_status(_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.status, c.status as cstatus, c.full_name, a.name as account, cy.closed into inv
  from invitations i join contacts c on c.id = i.contact_id
  join accounts a on a.id = c.account_id join cycles cy on cy.id = i.cycle_id
  where i.token = _token;
  if not found then return json_build_object('state','not_found'); end if;
  if inv.cstatus <> 'active' or inv.status = 'invalid' or inv.closed then return json_build_object('state','closed'); end if;
  if inv.status = 'answered' then return json_build_object('state','answered','account', inv.account); end if;
  return json_build_object('state','open','name', inv.full_name, 'account', inv.account);
end $$;

create or replace function public.survey_submit_by_token(_token uuid, _a json)
returns json language plpgsql security definer set search_path = public as $$
declare inv record; rid uuid; q record; ans json; vnum int; vtxt text; vnr boolean;
begin
  select i.id, i.status, c.status as cstatus, c.is_test, cy.closed, cy.questionnaire_id into inv
  from invitations i join contacts c on c.id = i.contact_id join cycles cy on cy.id = i.cycle_id
  where i.token = _token for update of i;
  if not found then raise exception 'not_found'; end if;
  if inv.status = 'answered' then return json_build_object('ok', true, 'already', true); end if;
  if inv.cstatus <> 'active' or inv.status = 'invalid' or inv.closed then raise exception 'closed'; end if;
  vnum := (_a->'answers'->'nps'->>'num')::int;
  vtxt := _a->'answers'->'motivo'->>'text';
  if vnum is null or vnum < 0 or vnum > 10 or length(coalesce(vtxt,'')) < 10 then raise exception 'invalid'; end if;

  -- validate required questions
  for q in select * from questions where questionnaire_id = inv.questionnaire_id loop
    ans := _a->'answers'->q.key;
    if q.required then
      if q.kind = 'text' and length(trim(coalesce(ans->>'text',''))) < coalesce(q.min_chars,1) then raise exception 'invalid'; end if;
      if q.kind in ('nps','likert') and (ans->>'num') is null then raise exception 'invalid'; end if;
      if q.kind = 'likert_nr' and (ans->>'num') is null and coalesce((ans->>'nr')::boolean,false) = false then raise exception 'invalid'; end if;
    end if;
    if q.kind in ('likert','likert_nr') and (ans->>'num') is not null and ((ans->>'num')::int < 1 or (ans->>'num')::int > 5) then raise exception 'invalid'; end if;
  end loop;

  insert into responses(invitation_id,q1_nps,q2_reason,q3,q4,q5,q6,q7,q8,q9,q9_not_reached,q10,q10_not_reached,q11_start,q12_keep,duration_seconds,user_agent,is_test)
  values (inv.id, vnum, vtxt,
    (_a->'answers'->'clareza'->>'num')::int, (_a->'answers'->'confianca'->>'num')::int, (_a->'answers'->'agilidade'->>'num')::int,
    (_a->'answers'->'qualidade'->>'num')::int, (_a->'answers'->'entende'->>'num')::int, (_a->'answers'->'facilidade'->>'num')::int,
    (_a->'answers'->'estavel'->>'num')::int, coalesce((_a->'answers'->'estavel'->>'nr')::boolean,false),
    (_a->'answers'->'resultados'->>'num')::int, coalesce((_a->'answers'->'resultados'->>'nr')::boolean,false),
    nullif(_a->'answers'->'comecar'->>'text',''), nullif(_a->'answers'->'manter'->>'text',''),
    (_a->>'duration_seconds')::int, left(_a->>'user_agent', 500), inv.is_test)
  returning id into rid;

  for q in select * from questions where questionnaire_id = inv.questionnaire_id loop
    ans := _a->'answers'->q.key;
    insert into response_answers(response_id, question_id, question_key, value_num, value_text, not_reached)
    values (rid, q.id, q.key, (ans->>'num')::int, nullif(left(ans->>'text', 5000),''), coalesce((ans->>'nr')::boolean,false));
  end loop;

  update invitations set answered_at = now(), status = 'answered', opened_at = coalesce(opened_at, now()) where id = inv.id;
  return json_build_object('ok', true);
end $$;

drop function if exists public.survey_verify(uuid, text, text);
drop function if exists public.survey_submit_verified(uuid, text, text, json);
drop function if exists public.survey_identity_ok(text, text, text, text);

revoke execute on function public.survey_confirm(uuid) from public;
revoke execute on function public.survey_decline(uuid) from public;
revoke execute on function public.survey_submit_by_token(uuid, json) from public;
grant execute on function public.survey_confirm(uuid) to anon, authenticated;
grant execute on function public.survey_decline(uuid) to anon, authenticated;
grant execute on function public.survey_submit_by_token(uuid, json) to anon, authenticated;
grant execute on function public.survey_status(uuid) to anon, authenticated;