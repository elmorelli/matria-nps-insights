create or replace function public.protect_nps_question() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.key = 'nps' and exists (select 1 from public.questionnaires where id = old.questionnaire_id) then
      raise exception 'A pergunta de NPS não pode ser removida.';
    end if;
    return old;
  end if;
  if old.key = 'nps' and (new.key <> old.key or new.text <> old.text or new.position <> old.position or new.kind <> old.kind) then
    raise exception 'A pergunta de NPS não pode ser alterada.';
  end if;
  return new;
end $$;