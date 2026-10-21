
create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  cycle_id uuid references public.cycles(id) on delete set null,
  event text not null,
  details text,
  created_at timestamptz not null default now()
);
create index contact_events_contact_idx on public.contact_events(contact_id, created_at);
grant select, insert, update, delete on public.contact_events to authenticated;
grant all on public.contact_events to service_role;
alter table public.contact_events enable row level security;
create policy "admin all" on public.contact_events for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_contact_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into contact_events(contact_id, event, details, created_at) values (new.id, 'cadastrado', null, new.created_at);
  else
    if new.status is distinct from old.status then
      insert into contact_events(contact_id, event, details) values (new.id, 'status_' || new.status, new.status_reason);
    end if;
    if (new.full_name, new.phone, new.email, new.job_title, new.role) is distinct from (old.full_name, old.phone, old.email, old.job_title, old.role) then
      insert into contact_events(contact_id, event) values (new.id, 'dados_atualizados');
    end if;
  end if;
  return new;
end $$;
create trigger contacts_log after insert or update on public.contacts for each row execute function public.log_contact_event();

create or replace function public.log_invitation_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'link_gerado', new.created_at);
    if new.sent_at is not null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'enviado', new.sent_at); end if;
    if new.opened_at is not null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'acessou', new.opened_at); end if;
    if new.answered_at is not null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'respondeu', new.answered_at); end if;
    return new;
  end if;
  if new.sent_at is not null and old.sent_at is null then insert into contact_events(contact_id, cycle_id, event, details, created_at) values (new.contact_id, new.cycle_id, 'enviado', new.channel::text, new.sent_at); end if;
  if new.reminder_1_at is not null and old.reminder_1_at is null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'lembrete_1', new.reminder_1_at); end if;
  if new.reminder_2_at is not null and old.reminder_2_at is null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'lembrete_2', new.reminder_2_at); end if;
  if new.reminder_3_at is not null and old.reminder_3_at is null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'lembrete_3', new.reminder_3_at); end if;
  if new.opened_at is not null and old.opened_at is null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'acessou', new.opened_at); end if;
  if new.answered_at is not null and old.answered_at is null then insert into contact_events(contact_id, cycle_id, event, created_at) values (new.contact_id, new.cycle_id, 'respondeu', new.answered_at); end if;
  return new;
end $$;
create trigger invitations_log after insert or update on public.invitations for each row execute function public.log_invitation_event();

create or replace function public.log_followup_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid; cyc uuid;
begin
  select i.contact_id, i.cycle_id into cid, cyc from responses r join invitations i on i.id = r.invitation_id where r.id = new.response_id;
  if tg_op = 'INSERT' then
    insert into contact_events(contact_id, cycle_id, event, details) values (cid, cyc, 'retorno_aberto', to_char(new.due_date at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'));
  elsif new.status is distinct from old.status then
    insert into contact_events(contact_id, cycle_id, event, details) values (cid, cyc, 'retorno_' || new.status, new.notes);
  end if;
  return new;
end $$;
create trigger followups_log after insert or update on public.followups for each row execute function public.log_followup_event();

-- Identity confirmation event
create or replace function public.survey_verify(_token uuid, _first text, _email text)
returns json language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.id, i.contact_id, i.cycle_id, i.status, i.opened_at, c.full_name, c.email, a.name as account into inv
  from invitations i join contacts c on c.id = i.contact_id join accounts a on a.id = c.account_id
  where i.token = _token;
  if not found then return json_build_object('ok', false); end if;
  if not public.survey_identity_ok(inv.full_name, inv.email, _first, _email) then
    insert into contact_events(contact_id, cycle_id, event) values (inv.contact_id, inv.cycle_id, 'identificacao_recusada');
    return json_build_object('ok', false);
  end if;
  insert into contact_events(contact_id, cycle_id, event) values (inv.contact_id, inv.cycle_id, 'identidade_confirmada');
  if inv.opened_at is null and inv.status <> 'answered' then
    update invitations set opened_at = now(), status = 'opened' where id = inv.id;
  end if;
  return json_build_object('ok', true, 'name', inv.full_name, 'account', inv.account, 'answered', inv.status = 'answered');
end $$;

-- Backfill history for existing rows
insert into contact_events(contact_id, event, created_at) select id, 'cadastrado', created_at from contacts;
insert into contact_events(contact_id, cycle_id, event, created_at) select contact_id, cycle_id, 'link_gerado', created_at from invitations;
insert into contact_events(contact_id, cycle_id, event, created_at) select contact_id, cycle_id, 'enviado', sent_at from invitations where sent_at is not null;
insert into contact_events(contact_id, cycle_id, event, created_at) select contact_id, cycle_id, 'acessou', opened_at from invitations where opened_at is not null;
insert into contact_events(contact_id, cycle_id, event, created_at) select contact_id, cycle_id, 'respondeu', answered_at from invitations where answered_at is not null;
