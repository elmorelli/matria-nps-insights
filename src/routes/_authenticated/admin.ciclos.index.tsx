import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allDataKey, allDataQuery, EMPTY_FILTERS, cycleStats, fmt } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/ciclos/")({
  head: () => ({ meta: [{ title: "Ciclos | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: CyclesPage,
});

type Form = { name: string; start_date: string; end_date: string; target_response_rate: string; target_nps: string; questionnaire_id: string };

function CyclesPage() {
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [form, setForm] = useState<Form | null>(null);
  const activeQs = d?.questionnaires.filter((q) => q.active) ?? [];

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.start_date) return toast.error("Informe nome e data de início.");
    if (form.target_nps === "" || form.target_response_rate === "") return toast.error("As duas metas são obrigatórias.");
    if (!form.questionnaire_id) return toast.error("Escolha o questionário.");
    const { data: def } = await supabase.from("settings").select("template_initial,template_reminder_1,template_reminder_2,template_reminder_3").order("id").limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("cycles")
      .insert({
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        target_nps: Number(form.target_nps),
        target_response_rate: Number(form.target_response_rate),
        questionnaire_id: form.questionnaire_id,
        template_initial: def?.template_initial ?? "",
        template_reminder_1: def?.template_reminder_1 ?? "",
        template_reminder_2: def?.template_reminder_2 ?? "",
        template_reminder_3: def?.template_reminder_3 ?? "",
      })
      .select("id")
      .single();
    if (error) return toast.error("Não foi possível criar o ciclo.");
    toast.success("Ciclo criado. As mensagens padrão de Configurações foram copiadas.");
    setForm(null);
    await qc.invalidateQueries({ queryKey: allDataKey });
    void data;
  };

  const cycles = [...(d?.cycles ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Ciclos</h1>
          <p className="mt-1 text-muted-foreground">Cada ciclo é uma rodada da pesquisa, com datas, metas, questionário e mensagens próprios.</p>
        </div>
        <Button onClick={() => setForm({ name: "", start_date: "", end_date: "", target_nps: "", target_response_rate: "", questionnaire_id: activeQs[0]?.id ?? "" })}>
          <Plus /> Novo ciclo
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {d &&
          cycles.map((c) => {
            const st = cycleStats(d, c, EMPTY_FILTERS);
            const qn = d.questionnaires.find((q) => q.id === c.questionnaire_id);
            return (
              <Link key={c.id} to="/admin/ciclos/$id" params={{ id: c.id }} className="block rounded-lg border bg-background p-6 hover:border-primary">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {new Date(c.start_date + "T12:00").toLocaleDateString("pt-BR")}
                      {c.end_date ? ` até ${new Date(c.end_date + "T12:00").toLocaleDateString("pt-BR")}` : " · sem data de término"}
                    </p>
                    {qn && <p className="text-sm text-muted-foreground">{qn.name} · versão {qn.version}</p>}
                  </div>
                  <span className={c.closed ? "rounded-full bg-offwhite px-3 py-1 text-sm text-muted-foreground" : "rounded-full bg-positive-bg px-3 py-1 text-sm text-positive"}>{c.closed ? "Encerrado" : "Em coleta"}</span>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Meta de NPS</dt>
                    <dd className="mt-1 text-xl font-light">{fmt(Number(c.target_nps))}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Meta de resposta</dt>
                    <dd className="mt-1 text-xl font-light">{c.target_response_rate}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">NPS</dt>
                    <dd className="mt-1 text-xl font-light">{fmt(st.nps)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Respostas</dt>
                    <dd className="mt-1 text-xl font-light">
                      {st.s.n} de {st.rows.length}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo ciclo</DialogTitle>
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
                  <Label htmlFor="cnps">Meta de NPS</Label>
                  <Input id="cnps" type="number" value={form.target_nps} onChange={(e) => setForm({ ...form, target_nps: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr">Meta de resposta (%)</Label>
                  <Input id="cr" type="number" value={form.target_response_rate} onChange={(e) => setForm({ ...form, target_response_rate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq">Questionário</Label>
                <select id="cq" value={form.questionnaire_id} onChange={(e) => setForm({ ...form, questionnaire_id: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  {activeQs.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name} (versão {q.version})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Criar ciclo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
