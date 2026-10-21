import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Eye, Lock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allDataKey, allDataQuery, type AllData, type QuestionRow } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/questionarios")({
  head: () => ({ meta: [{ title: "Questionários | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: QuestionnairesPage,
});

const KIND_LABEL: Record<string, string> = {
  nps: "Nota de 0 a 10",
  likert: "Escala de 1 a 5",
  likert_nr: "Escala de 1 a 5 ou 'Ainda não chegamos nesta etapa'",
  text: "Texto livre",
};

function lockedOf(d: AllData, qid: string) {
  const cycles = d.cycles.filter((c) => c.questionnaire_id === qid);
  return { cycles, locked: cycles.some((c) => d.invitations.some((i) => i.cycle_id === c.id)) };
}

function QuestionnairesPage() {
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [sel, setSel] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });
  if (!d) return <p className="text-muted-foreground">Carregando...</p>;
  const current = d.questionnaires.find((q) => q.id === sel) ?? null;

  const clone = async (qid: string) => {
    const src = d.questionnaires.find((q) => q.id === qid)!;
    const version = Math.max(...d.questionnaires.map((q) => q.version)) + 1;
    const name = src.name.replace(/v\d+$/, `v${version}`);
    const { data: nq, error } = await supabase.from("questionnaires").insert({ name: name === src.name ? `${src.name} v${version}` : name, version, active: false, notes: src.notes }).select("id").single();
    if (error || !nq) return toast.error("Não foi possível criar a versão.");
    const qs = d.questions.filter((q) => q.questionnaire_id === qid);
    const { error: e2 } = await supabase.from("questions").insert(qs.map(({ id: _id, questionnaire_id: _q, ...rest }) => ({ ...rest, questionnaire_id: nq.id })));
    if (e2) return toast.error("A versão foi criada, mas as perguntas não foram copiadas.");
    toast.success(`Versão ${version} criada. Ela começa inativa.`);
    await refresh();
    setSel(nq.id);
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("questionnaires").update({ active }).eq("id", id);
    if (error) return toast.error("Não foi possível alterar.");
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Questionários</h1>
        <p className="mt-1 text-muted-foreground">Cada ciclo usa uma versão. Para mudar perguntas, crie uma nova versão. As chaves das perguntas se mantêm para comparar ciclos.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {d.questionnaires.map((q) => {
          const { cycles, locked } = lockedOf(d, q.id);
          const n = d.questions.filter((x) => x.questionnaire_id === q.id).length;
          return (
            <div key={q.id} className={cn("rounded-lg border bg-background p-5", sel === q.id && "border-primary")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg">{q.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Versão {q.version} · {n} perguntas · {cycles.length ? `Usado em ${cycles.map((c) => c.name).join(", ")}` : "Nenhum ciclo usa"}
                  </p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-sm", q.active ? "bg-positive-bg text-positive" : "bg-offwhite text-muted-foreground")}>{q.active ? "Ativo" : "Inativo"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant={sel === q.id ? "default" : "outline"} onClick={() => setSel(q.id)}>
                  {locked ? "Ver perguntas" : "Editar perguntas"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => clone(q.id)}>
                  <Copy /> Nova versão
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(q.id, !q.active)}>
                  {q.active ? "Desativar" : "Ativar"}
                </Button>
                <a href={`/r/teste?q=${q.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md px-3 text-sm text-primary hover:bg-highlight">
                  <Eye className="h-4 w-4" /> Pré-visualizar
                </a>
              </div>
              {locked && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> Em uso por um ciclo com links gerados. Só pode ser copiado.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {current && <Editor key={current.id} d={d} qid={current.id} locked={lockedOf(d, current.id).locked} onChange={refresh} />}
    </div>
  );
}

function Editor({ d, qid, locked, onChange }: { d: AllData; qid: string; locked: boolean; onChange: () => void }) {
  const qs = d.questions.filter((q) => q.questionnaire_id === qid).sort((a, b) => a.position - b.position);
  const name = d.questionnaires.find((q) => q.id === qid)?.name;
  const [newQ, setNewQ] = useState({ text: "", kind: "likert", block: qs[qs.length - 1]?.block ?? "", key: "" });

  const save = async (q: QuestionRow, patch: Partial<QuestionRow>) => {
    const { error } = await supabase.from("questions").update(patch).eq("id", q.id);
    if (error) return toast.error(error.message.includes("NPS") ? "A pergunta de NPS não pode ser alterada." : "Não foi possível salvar.");
    onChange();
  };
  const move = async (i: number, dir: -1 | 1) => {
    const a = qs[i];
    const b = qs[i + dir];
    if (!b || a.key === "nps" || b.key === "nps") return;
    await supabase.from("questions").update({ position: b.position }).eq("id", a.id);
    await supabase.from("questions").update({ position: a.position }).eq("id", b.id);
    onChange();
  };
  const remove = async (q: QuestionRow) => {
    if (q.key === "nps") return;
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) return toast.error("Não foi possível remover.");
    onChange();
  };
  const renameBlock = async (oldName: string, nn: string) => {
    if (!nn.trim() || nn === oldName) return;
    const { error } = await supabase.from("questions").update({ block: nn.trim() }).eq("questionnaire_id", qid).eq("block", oldName);
    if (error) return toast.error("Não foi possível renomear o bloco.");
    onChange();
  };
  const add = async () => {
    if (!newQ.text.trim() || !newQ.block.trim()) return toast.error("Informe o texto e o bloco.");
    const key = (newQ.key.trim() || newQ.text.trim().split(/\s+/).slice(0, 2).join("_"))
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]/g, "");
    if (d.questions.some((q) => q.key === key && q.questionnaire_id === qid)) return toast.error("Já existe uma pergunta com essa chave.");
    const { error } = await supabase.from("questions").insert({
      questionnaire_id: qid,
      position: Math.max(0, ...qs.map((q) => q.position)) + 1,
      key,
      kind: newQ.kind as never,
      text: newQ.text.trim(),
      required: newQ.kind !== "text",
      block: newQ.block.trim(),
      block_note: KIND_LABEL[newQ.kind],
    });
    if (error) return toast.error("Não foi possível adicionar.");
    setNewQ({ ...newQ, text: "", key: "" });
    onChange();
  };

  const blocks = [...new Set(qs.map((q) => q.block))];

  return (
    <section className="space-y-4 rounded-xl border bg-background p-4 sm:p-6">
      <h2 className="text-xl">{name}</h2>
      {locked && <p className="text-sm text-muted-foreground">Somente leitura. Use "Nova versão" para mudar.</p>}
      {blocks.map((b) => (
        <div key={b} className="space-y-3">
          {locked ? <h3 className="text-base">{b}</h3> : <BlockName value={b} onSave={(v) => renameBlock(b, v)} />}
          {qs.map((q, i) =>
            q.block !== b ? null : (
              <div key={q.id} className="flex gap-3 rounded-lg border p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-highlight text-sm text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  {locked || q.key === "nps" ? <p>{q.text}</p> : <QText value={q.text} onSave={(v) => save(q, { text: v })} />}
                  <p className="text-sm text-muted-foreground">
                    {KIND_LABEL[q.kind]} · chave "{q.key}"{q.kind === "text" ? (q.required ? ` · obrigatório, mínimo ${q.min_chars ?? 1} caracteres` : " · opcional") : ""}
                  </p>
                  {q.key === "nps" && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Lock className="h-3 w-3" /> Pergunta de NPS travada. Não pode ser editada, removida ou movida.
                    </p>
                  )}
                </div>
                {!locked && q.key !== "nps" && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button aria-label="Subir" onClick={() => move(i, -1)} className="rounded p-1 text-primary hover:bg-highlight disabled:opacity-30" disabled={i <= 1}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button aria-label="Descer" onClick={() => move(i, 1)} className="rounded p-1 text-primary hover:bg-highlight disabled:opacity-30" disabled={i === qs.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button aria-label="Remover" onClick={() => remove(q)} className="rounded p-1 text-negative hover:bg-negative-bg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      ))}
      {!locked && (
        <div className="space-y-2 rounded-lg border border-dashed p-4">
          <p>Nova pergunta</p>
          <Textarea placeholder="Texto da pergunta" value={newQ.text} onChange={(e) => setNewQ({ ...newQ, text: e.target.value })} rows={2} />
          <div className="flex flex-wrap gap-2">
            <select value={newQ.kind} onChange={(e) => setNewQ({ ...newQ, kind: e.target.value })} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="likert">Escala de 1 a 5</option>
              <option value="likert_nr">Escala de 1 a 5 com "Ainda não chegamos"</option>
              <option value="text">Texto livre</option>
            </select>
            <Input placeholder="Bloco" value={newQ.block} onChange={(e) => setNewQ({ ...newQ, block: e.target.value })} className="max-w-48" list="blocks" />
            <datalist id="blocks">
              {blocks.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
            <Input placeholder="Chave (opcional)" value={newQ.key} onChange={(e) => setNewQ({ ...newQ, key: e.target.value })} className="max-w-40" />
            <Button onClick={add}>
              <Plus /> Adicionar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function QText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <Textarea rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() && v !== value && onSave(v.trim())} />;
}
function BlockName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} className="max-w-xs text-base" aria-label="Nome do bloco" />;
}
