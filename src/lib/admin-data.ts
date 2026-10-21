import { supabase } from "@/integrations/supabase/client";

export async function fetchCycles() {
  const { data, error } = await supabase.from("cycles").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function fetchContacts() {
  const { data, error } = await supabase
    .from("contacts")
    .select("*, accounts(id,name), contact_products(id,product,mom_stage), invitations(*, responses(q1_nps))")
    .order("full_name");
  if (error) throw error;
  return data;
}

export async function fetchAccounts() {
  const { data, error } = await supabase.from("accounts").select("*").order("name");
  if (error) throw error;
  return data;
}

export type ContactRow = Awaited<ReturnType<typeof fetchContacts>>[number];

export function surveyLink(token: string) {
  return `${window.location.origin}/r/${token}`;
}

export const STATUS_LABEL: Record<string, string> = {
  not_sent: "Não enviado",
  sent: "Enviado",
  opened: "Aberto",
  answered: "Respondido",
  invalid: "Inválido",
};

export const CONTACT_STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  left_organization: "Saiu da organização",
  excluded_from_base: "Excluído da base",
};
