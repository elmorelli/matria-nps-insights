import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STEPS, LIKERT_LABELS } from "@/lib/survey";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/respostas")({
  component: ResponsesPage,
});

async function fetchResponses() {
  const { data, error } = await supabase
    .from("responses")
    .select("*, invitations(cycle_id, contacts(full_name, role, job_title, accounts(name)))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

type R = Awaited<ReturnType<typeof fetchResponses>>[number];

function band(n: number) {
  return n >= 9 ? "promotor" : n >= 7 ? "neutro" : "detrator";
}

function answerText(r: R, key: string): string {
  const step = STEPS.find((s) => s.key === key)!;
  const v = (r as Record<string, unknown>)[key];
  if (step.kind === "likert_nr" && (r as Record<string, unknown>)[step.nrKey]) return "Ainda não chegamos nesta etapa";
  if (v == null || v === "") return "Sem resposta";
  if (step.kind === "likert" || step.kind === "likert_nr") return `${v} · ${LIKERT_LABELS[(v as number) - 1]}`;
  return String(v);
}

function ResponsesPage() {
  const { data } = useQuery({ queryKey: ["responses"], queryFn: fetchResponses });
  const [q, setQ] = useState("");
  const [fBand, setFBand] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (fBand && band(r.q1_nps) !== fBand) return false;
      if (!t) return true;
      const c = r.invitations?.contacts;
      return [c?.full_name, c?.accounts?.name, r.q2_reason, r.q11_start, r.q12_keep].some((s) => (s ?? "").toLowerCase().includes(t));
    });
  }, [data, q, fBand]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Respostas</h1>
          <p className="mt-1 text-muted-foreground">{data?.length ?? 0} respostas recebidas. Clique em uma linha para ver todas as perguntas.</p>
        </div>
        <a href="/r/teste" target="_blank" rel="noopener" className="rounded-md border bg-background px-4 py-2 text-sm text-primary hover:bg-highlight">
          Ver a pesquisa como teste
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por nome, instituição ou palavra" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm bg-background" />
        <select value={fBand} onChange={(e) => setFBand(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">Todas as notas</option>
          <option value="detrator">Detratores (0 a 6)</option>
          <option value="neutro">Neutros (7 e 8)</option>
          <option value="promotor">Promotores (9 e 10)</option>
        </select>
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const c = r.invitations?.contacts;
          const b = band(r.q1_nps);
          const isOpen = open === r.id;
          return (
            <div key={r.id} className="rounded-lg border bg-background">
              <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-start gap-4 p-4 text-left">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-semibold",
                    b === "promotor" && "bg-positive-bg text-positive",
                    b === "neutro" && "bg-highlight text-info",
                    b === "detrator" && "bg-negative-bg text-foreground",
                  )}
                >
                  {r.q1_nps}
                </span>
                <div className="min-w-0 flex-1">
                  <p>
                    {c?.full_name} <span className="text-muted-foreground">· {c?.accounts?.name} · {c?.role}</span>
                    {r.is_test && <span className="ml-2 text-xs text-info">teste</span>}
                  </p>
                  <p className="mt-1 truncate text-muted-foreground">{r.q2_reason}</p>
                </div>
                <span className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              </button>
              {isOpen && (
                <ol className="space-y-4 border-t bg-subtle p-6">
                  {STEPS.map((s, i) => (
                    <li key={s.key}>
                      <p className="text-sm text-muted-foreground">
                        {i + 1}. {s.text}
                      </p>
                      <p className="mt-1">{s.key === "q1_nps" ? String(r.q1_nps) : answerText(r, s.key)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="py-12 text-center text-muted-foreground">Nenhuma resposta encontrada.</p>}
      </div>
    </div>
  );
}
