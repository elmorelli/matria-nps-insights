import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  cadastrado: "Cadastrado na base",
  dados_atualizados: "Dados atualizados",
  status_active: "Reativado na base",
  status_left_organization: "Saiu da organização",
  status_excluded_from_base: "Excluído da base",
  link_gerado: "Link da pesquisa gerado",
  enviado: "Convite enviado",
  lembrete_1: "Lembrete 1 enviado",
  lembrete_2: "Lembrete 2 enviado",
  lembrete_3: "Lembrete 3 enviado",
  identificacao_recusada: "Tentativa de acesso com dados que não conferem",
  identidade_confirmada: "Confirmou nome e e-mail no link",
  acessou: "Abriu a pesquisa pela primeira vez",
  respondeu: "Respondeu a pesquisa",
  retorno_aberto: "Retorno aberto para a liderança",
  retorno_to_do: "Retorno voltou para a fazer",
  retorno_in_contact: "Retorno em contato",
  retorno_resolved: "Retorno resolvido",
};

const TONE: Record<string, string> = {
  respondeu: "bg-positive",
  retorno_resolved: "bg-positive",
  identificacao_recusada: "bg-negative",
  status_left_organization: "bg-muted-foreground",
  status_excluded_from_base: "bg-muted-foreground",
  retorno_aberto: "bg-attention",
};

export function ContactTimeline({ contact, onClose }: { contact: { id: string; full_name: string; accounts?: { name: string } | null } | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["timeline", contact?.id],
    enabled: !!contact,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_events")
        .select("*, cycles(name)")
        .eq("contact_id", contact!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-medium">{contact?.full_name}</SheetTitle>
          <p className="text-sm text-muted-foreground">{contact?.accounts?.name} · linha do tempo</p>
        </SheetHeader>
        <ol className="relative mt-8 ml-3 border-l border-border pl-6">
          {(data ?? []).map((e) => (
            <li key={e.id} className="mb-6 last:mb-0">
              <span className={cn("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full", TONE[e.event] ?? "bg-primary")} />
              <p>{LABEL[e.event] ?? e.event}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {e.cycles?.name ? ` · ${e.cycles.name}` : ""}
              </p>
              {e.details && <p className="mt-1 text-sm text-muted-foreground">{e.details}</p>}
            </li>
          ))}
          {data?.length === 0 && <p className="text-muted-foreground">Sem eventos ainda.</p>}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
