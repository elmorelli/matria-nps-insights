import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCycles } from "@/lib/admin-data";
import { STEPS, BLOCKS, LIKERT_LABELS } from "@/lib/survey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/pesquisas")({
  component: SurveysPage,
});

type Cycle = Awaited<ReturnType<typeof fetchCycles>>[number];
type Form = { id?: string; name: string; start_date: string; end_date: string; target_response_rate: string; target_nps: string };
const EMPTY: Form = { name: "", start_date: "", end_date: "", target_response_rate: "75", target_nps: "60" };

function SurveysPage() {
  const qc = useQueryClient();
  const { data: cycles } = useQuery({ queryKey: ["cycles"], queryFn: fetchCycles });
  const { data: counts } = useQuery({
    queryKey: ["cycle-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("invitations").select("cycle_id,status");
      const m: Record<string, { total: number; answered: number }> = {};
      (data ?? []).forEach((i) => {
        m[i.cycle_id] ??= { total: 0, answered: 0 };
        m[i.cycle_id].total++;
        if (i.status === "answered") m[i.cycle_id].answered++;
      });
      return m;
    },
  });
  const [form, setForm] = useState<Form | null>(null);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.start_date) return toast.error("Informe nome e data de início.");
    const payload = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      target_response_rate: Number(form.target_response_rate) || 75,
      target_nps: Number(form.target_nps) || 60,
    };
    const { error } = form.id
      ? await supabase.from("cycles").update(payload).eq("id", form.id)
      : await supabase.from("cycles").insert(payload);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success(form.id ? "Pesquisa atualizada." : "Pesquisa criada.");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["cycles"] });
  };

  const toggleClosed = async (c: Cycle) => {
    const { error } = await supabase.from("cycles").update({ closed: !c.closed }).eq("id", c.id);
    if (error) return toast.error("Não foi possível alterar.");
    qc.invalidateQueries({ queryKey: ["cycles"] });
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl">Pesquisas</h1>
            <p className="mt-1 text-muted-foreground">Cada ciclo é uma rodada da pesquisa, com datas e metas próprias.</p>
          </div>
          <Button onClick={() => setForm({ ...EMPTY })}>
            <Plus /> Nova pesquisa
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {cycles?.map((c) => {
            const ct = counts?.[c.id];
            return (
              <div key={c.id} className="rounded-lg border bg-background p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(c.start_date + "T12:00").toLocaleDateString("pt-BR")}
                      {c.end_date ? ` até ${new Date(c.end_date + "T12:00").toLocaleDateString("pt-BR")}` : " · sem data de término"}
                    </p>
                  </div>
                  <span className={c.closed ? "rounded-full bg-offwhite px-3 py-1 text-sm text-muted-foreground" : "rounded-full bg-positive-bg px-3 py-1 text-sm text-positive"}>
                    {c.closed ? "Encerrada" : "Em coleta"}
                  </span>
                </div>
                <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Meta de NPS</dt>
                    <dd className="mt-1 text-xl font-semibold">+{c.target_nps}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Meta de resposta</dt>
                    <dd className="mt-1 text-xl font-semibold">{c.target_response_rate}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{c.reference_nps != null ? "Resultado" : "Respostas"}</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {c.reference_nps != null ? `+${c.reference_nps}` : `${ct?.answered ?? 0} de ${ct?.total ?? 0}`}
                    </dd>
                  </div>
                </dl>
                <div className="mt-6 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        id: c.id,
                        name: c.name,
                        start_date: c.start_date,
                        end_date: c.end_date ?? "",
                        target_response_rate: String(c.target_response_rate),
                        target_nps: String(c.target_nps),
                      })
                    }
                  >
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleClosed(c)}>
                    {c.closed ? "Reabrir coleta" : "Encerrar coleta"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl">Questionário</h2>
            <p className="mt-1 text-muted-foreground">12 perguntas em 4 blocos. O texto é fixo para manter a comparação entre ciclos.</p>
          </div>
          <a href="/r/teste" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm text-primary hover:bg-highlight">
            <Eye className="h-4 w-4" /> Ver como o cliente vê
          </a>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {BLOCKS.map((b, bi) => (
            <div key={b.title} className="rounded-lg border bg-background p-6">
              <p className="text-sm text-muted-foreground">
                Bloco {bi + 1} · {b.note}
              </p>
              <h3 className="mt-1 text-lg">{b.title}</h3>
              <ol className="mt-4 space-y-4">
                {STEPS.slice(b.from, b.to + 1).map((s, i) => (
                  <li key={s.key} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-highlight text-sm text-primary">{b.from + i + 1}</span>
                    <div>
                      <p>{s.text}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.kind === "nps" && "Escala de 0 (Nada provável) a 10 (Muito provável)"}
                        {s.kind === "likert" && `${LIKERT_LABELS[0]} a ${LIKERT_LABELS[4]}`}
                        {s.kind === "likert_nr" && `${LIKERT_LABELS[0]} a ${LIKERT_LABELS[4]} · ou 'Ainda não chegamos nesta etapa'`}
                        {s.kind === "text" && (s.required ? `Texto livre, mínimo de ${s.min} caracteres` : "Texto livre, opcional")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar pesquisa" : "Nova pesquisa"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cn">Nome</Label>
                <Input id="cn" placeholder="Ciclo 3 - Fev/2027" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cs">Início</Label>
                  <Input id="cs" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ce">Término</Label>
                  <Input id="ce" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr">Meta de resposta (%)</Label>
                  <Input id="cr" type="number" value={form.target_response_rate} onChange={(e) => setForm({ ...form, target_response_rate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnps">Meta de NPS</Label>
                  <Input id="cnps" type="number" value={form.target_nps} onChange={(e) => setForm({ ...form, target_nps: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
