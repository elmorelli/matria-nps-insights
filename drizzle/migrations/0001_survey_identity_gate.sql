
create or replace function public.norm_txt(_t text) returns text language sql immutable as $$
  select translate(lower(trim(coalesce(_t,''))), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

create or replace function public.survey_identity_ok(_c_full_name text, _c_email text, _first text, _email text)
returns boolean language sql immutable as $$
  select public.norm_txt(split_part(trim(_c_full_name), ' ', 1)) = public.norm_txt(_first)
     and (_c_email is null or lower(trim(_c_email)) = lower(trim(coalesce(_email,''))))
$$;

-- Status before identification: no personal data
create or replace function public.survey_status(_token uuid)
returns json language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.status, c.status as cstatus, a.name as account, cy.closed into inv
  from invitations i join contacts c on c.id = i.contact_id
  join accounts a on a.id = c.account_id join cycles cy on cy.id = i.cycle_id
  where i.token = _token;
  if not found then return json_build_object('state','not_found'); end if;
  if inv.cstatus <> 'active' or inv.status = 'invalid' or inv.closed then return json_build_object('state','closed'); end if;
  if inv.status = 'answered' then return json_build_object('state','answered','account', inv.account); end if;
  return json_build_object('state','open','account', inv.account);
end $$;

create or replace function public.survey_verify(_token uuid, _first text, _email text)
returns json language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select i.id, i.status, i.opened_at, c.full_name, c.email, a.name as account into inv
  from invitations i join contacts c on c.id = i.contact_id join accounts a on a.id = c.account_id
  where i.token = _token;
  if not found or not public.survey_identity_ok(inv.full_name, inv.email, _first, _email) then
    return json_build_object('ok', false);
  end if;
  if inv.opened_at is null and inv.status <> 'answered' then
    update invitations set opened_at = now(), status = 'opened' where id = inv.id;
  end if;
  return json_build_object('ok', true, 'name', inv.full_name, 'account', inv.account, 'answered', inv.status = 'answered');
end $$;

create or replace function public.survey_submit_verified(_token uuid, _first text, _email text, _a json)
returns json language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select ct.full_name, ct.email into c from invitations i join contacts ct on ct.id = i.contact_id where i.token = _token;
  if not found or not public.survey_identity_ok(c.full_name, c.email, _first, _email) then raise exception 'identity'; end if;
  return public.survey_submit(_token, _a);
end $$;

revoke execute on function public.survey_get(uuid) from anon, authenticated, public;
revoke execute on function public.survey_submit(uuid, json) from anon, authenticated, public;
grant execute on function public.survey_status(uuid) to anon, authenticated;
grant execute on function public.survey_verify(uuid, text, text) to anon, authenticated;
grant execute on function public.survey_submit_verified(uuid, text, text, json) to anon, authenticated;
