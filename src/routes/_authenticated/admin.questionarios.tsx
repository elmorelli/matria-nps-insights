import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, GripVertical, Lock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allDataKey, allDataQuery, type AllData, type QuestionRow } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/questionarios")({
  head: () => ({ meta: [{ title: "Questionários | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: QuestionnairesPage,
});

const KIND_LABEL: Record<string, string> = {
  nps: "Nota 0 a 10",
  likert: "Escala 1 a 5",
  likert_nr: "Escala 1 a 5 com 'Ainda não chegamos nesta etapa'",
  text: "Texto livre",
};
const LOCK_NOTE = "Em uso em ciclos com links gerados. Para alterar, crie um novo questionário usando este como base.";

function usageOf(d: AllData, qid: string) {
  const cycles = d.cycles.filter((c) => c.questionnaire_id === qid);
  return { cycles, locked: cycles.some((c) => d.invitations.some((i) => i.cycle_id === c.id)) };
}

function QuestionnairesPage() {
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });
  if (!d) return <p className="text-muted-foreground">Carregando...</p>;

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("questionnaires").update({ active }).eq("id", id);
    if (error) return toast.error("Não foi possível alterar.");
    refresh();
  };
  const remove = async (id: string) => {
    const { error: e1 } = await supabase.from("questions").delete().eq("questionnaire_id", id);
    const { error } = e1 ? { error: e1 } : await supabase.from("questionnaires").delete().eq("id", id);
    setDeleting(null);
    if (error) return toast.error("Não foi possível excluir.");
    toast.success("Questionário excluído.");
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Questionários</h1>
          <p className="mt-1 text-muted-foreground">Cada ciclo usa um questionário. As chaves das perguntas se mantêm para comparar ciclos.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Novo questionário
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {d.questionnaires.map((q) => {
          const { cycles } = usageOf(d, q.id);
          const n = d.questions.filter((x) => x.questionnaire_id === q.id).length;
          return (
            <div key={q.id} className="rounded-lg border bg-background p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{q.code}</p>
                  <h2 className="text-lg">{q.name}</h2>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-sm", q.active ? "bg-positive-bg text-positive" : "bg-offwhite text-muted-foreground")}>{q.active ? "Ativo" : "Inativo"}</span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <span>{n} perguntas</span>·<span>Criado em {new Date(q.created_at).toLocaleDateString("pt-BR")}</span>·
                {cycles.length ? (
                  <Popover>
                    <PopoverTrigger className="text-primary underline-offset-4 hover:underline">
                      Usado em {cycles.length} {cycles.length === 1 ? "ciclo" : "ciclos"}
                    </PopoverTrigger>
                    <PopoverContent className="w-56 text-sm">
                      <ul className="space-y-1">
                        {cycles.map((c) => (
                          <li key={c.id}>{c.name}</li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span>Usado em 0 ciclos</span>
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(q.id)}>
                  Editar perguntas
                </Button>
                {cycles.length ? (
                  q.active && (
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(q.id, false)}>
                      Desativar
                    </Button>
                  )
                ) : (
                  <Button size="sm" variant="ghost" className="text-negative" onClick={() => setDeleting(q.id)}>
                    <Trash2 /> Excluir
                  </Button>
                )}
                {!q.active && (
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(q.id, true)}>
                    Ativar
                  </Button>
                )}
                <a href={`/r/teste?q=${q.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md px-3 text-sm text-primary hover:bg-highlight">
                  <Eye className="h-4 w-4" /> Pré-visualizar
                </a>
              </div>
              {cycles.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Questionário usado em ciclos não pode ser excluído.</p>}
            </div>
          );
        })}
      </div>

      <CreateDialog d={d} open={creating} onClose={() => setCreating(false)} onCreated={async (id) => { await refresh(); setCreating(false); setEditing(id); }} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {editing && <Editor key={editing} d={d} qid={editing} locked={usageOf(d, editing).locked} onChange={refresh} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir questionário?</AlertDialogTitle>
            <AlertDialogDescription>As perguntas dele também serão apagadas. Não dá para desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove(deleting)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateDialog({ d, open, onClose, onCreated }: { d: AllData; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"zero" | "base">("base");
  const [base, setBase] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!name.trim()) return toast.error("Informe o nome.");
    if (mode === "base" && !base) return toast.error("Escolha o questionário base.");
    setBusy(true);
    const version = Math.max(0, ...d.questionnaires.map((q) => q.version)) + 1;
    const { data: nq, error } = await supabase.from("questionnaires").insert({ name: name.trim(), version, active: false }).select("id").single();
    if (error || !nq) {
      setBusy(false);
      return toast.error("Não foi possível criar.");
    }
    const src =
      mode === "base"
        ? d.questions.filter((q) => q.questionnaire_id === base).map(({ id: _id, questionnaire_id: _q, ...rest }) => ({ ...rest, questionnaire_id: nq.id }))
        : (() => {
            const nps = d.questions.find((q) => q.key === "nps");
            return nps ? [{ questionnaire_id: nq.id, position: 1, key: "nps", kind: "nps" as const, text: nps.text, required: true, block: nps.block, block_note: nps.block_note, min_chars: null }] : [];
          })();
    if (src.length) {
      const { error: e2 } = await supabase.from("questions").insert(src);
      if (e2) toast.error("O questionário foi criado, mas as perguntas não foram copiadas.");
    }
    setBusy(false);
    setName("");
    setBase("");
    toast.success("Questionário criado. Ele começa inativo.");
    onCreated(nq.id);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo questionário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qn">Nome</Label>
            <Input id="qn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pesquisa NPS 2027" />
          </div>
          <div className="space-y-2">
            {(
              [
                ["zero", "Começar do zero"],
                ["base", "Usar como base"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="radio" checked={mode === k} onChange={() => setMode(k)} /> {l}
              </label>
            ))}
            {mode === "base" && (
              <select value={base} onChange={(e) => setBase(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Escolha um questionário</option>
                {d.questionnaires.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.code} · {q.name} {q.active ? "" : "(inativo)"}
                  </option>
                ))}
              </select>
            )}
            {mode === "zero" && <p className="text-sm text-muted-foreground">A pergunta de NPS entra sempre, travada.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={create} disabled={busy}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Editor({ d, qid, locked, onChange }: { d: AllData; qid: string; locked: boolean; onChange: () => void }) {
  const qs = d.questions.filter((q) => q.questionnaire_id === qid).sort((a, b) => a.position - b.position);
  const qn = d.questionnaires.find((q) => q.id === qid);
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [newQ, setNewQ] = useState({ text: "", kind: "likert", block: qs[qs.length - 1]?.block ?? "" });

  const save = async (q: QuestionRow, patch: Partial<QuestionRow>) => {
    const { error } = await supabase.from("questions").update(patch).eq("id", q.id);
    if (error) return toast.error(error.message.includes("NPS") ? "A pergunta de NPS não pode ser alterada." : "Não foi possível salvar.");
    onChange();
  };
  const reorder = async (from: number, to: number) => {
    if (from === to || to < 0 || to >= qs.length) return;
    const list = [...qs];
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    const npsIdx = list.findIndex((q) => q.key === "nps");
    const npsOrig = qs.findIndex((q) => q.key === "nps");
    if (npsIdx !== npsOrig) return toast.error("A pergunta de NPS não pode ser movida.");
    const positions = qs.map((q) => q.position);
    await Promise.all(list.map((q, i) => (q.position !== positions[i] ? supabase.from("questions").update({ position: positions[i] }).eq("id", q.id) : null)));
    onChange();
  };
  const remove = async (q: QuestionRow) => {
    if (q.key === "nps" || locked) return;
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) return toast.error("Não foi possível remover.");
    onChange();
  };
  const add = async () => {
    if (!newQ.text.trim() || !newQ.block.trim()) return toast.error("Informe o texto e o bloco.");
    let key = newQ.text.trim().split(/\s+/).slice(0, 2).join("_").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, "") || "pergunta";
    while (qs.some((q) => q.key === key)) key += "_2";
    const { error } = await supabase.from("questions").insert({
      questionnaire_id: qid,
      position: Math.max(0, ...qs.map((q) => q.position)) + 1,
      key,
      kind: newQ.kind as never,
      text: newQ.text.trim(),
      required: newQ.kind !== "text",
      block: newQ.block.trim(),
    });
    if (error) return toast.error("Não foi possível adicionar.");
    setNewQ({ ...newQ, text: "" });
    onChange();
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {qn?.code} · {qn?.name}
        </DialogTitle>
      </DialogHeader>
      {locked && (
        <p className="flex items-start gap-2 rounded-md bg-offwhite p-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> {LOCK_NOTE}
        </p>
      )}
      <p className="text-sm text-muted-foreground">Arraste pela alça para mudar a ordem. Clique na pergunta para editar.</p>
      <ol className="space-y-2">
        {qs.map((q, i) => {
          const isNps = q.key === "nps";
          const isOpen = open === q.id;
          return (
            <li
              key={q.id}
              draggable={!isNps}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag != null) reorder(drag, i);
                setDrag(null);
              }}
              className={cn("rounded-lg border bg-background", drag === i && "opacity-50")}
            >
              <div className="flex items-center gap-2 p-3">
                {isNps ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-highlight text-sm text-primary">{i + 1}</span>
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : q.id)}>
                  <p className="truncate">{q.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.block} · {KIND_LABEL[q.kind]}
                  </p>
                </button>
                {!isNps && (
                  <div className="flex shrink-0 gap-1">
                    <button aria-label="Subir" onClick={() => reorder(i, i - 1)} className="rounded p-1 text-primary hover:bg-highlight">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button aria-label="Descer" onClick={() => reorder(i, i + 1)} className="rounded p-1 text-primary hover:bg-highlight">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              {isOpen && <QuestionForm q={q} locked={locked} onSave={(p) => save(q, p)} onRemove={() => remove(q)} />}
            </li>
          );
        })}
      </ol>
      {!locked && (
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <p className="text-sm">Nova pergunta</p>
          <Textarea rows={2} placeholder="Texto da pergunta" value={newQ.text} onChange={(e) => setNewQ({ ...newQ, text: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Bloco" value={newQ.block} onChange={(e) => setNewQ({ ...newQ, block: e.target.value })} />
            <select value={newQ.kind} onChange={(e) => setNewQ({ ...newQ, kind: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {["likert", "likert_nr", "text"].map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={add}>
              <Plus /> Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionForm({ q, locked, onSave, onRemove }: { q: QuestionRow; locked: boolean; onSave: (p: Partial<QuestionRow>) => void; onRemove: () => void }) {
  const isNps = q.key === "nps";
  const [f, setF] = useState({ text: q.text, block: q.block, required: q.required, min_chars: q.min_chars ?? "", kind: q.kind });
  const submit = () => {
    if (!f.text.trim() || !f.block.trim()) return toast.error("Informe o texto e o bloco.");
    const patch: Partial<QuestionRow> = { block: f.block.trim(), required: f.required, min_chars: f.kind === "text" && f.min_chars !== "" ? Number(f.min_chars) : null };
    if (!isNps) patch.text = f.text.trim();
    if (!isNps && !locked) patch.kind = f.kind;
    onSave(patch);
    toast.success("Pergunta salva.");
  };
  return (
    <div className="space-y-3 border-t p-3">
      <div className="space-y-1">
        <Label>Texto</Label>
        <Textarea rows={2} value={f.text} disabled={isNps} onChange={(e) => setF({ ...f, text: e.target.value })} />
        {isNps && <p className="text-xs text-muted-foreground">Pergunta de NPS travada. Texto, posição e tipo não mudam.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Bloco</Label>
          <Input value={f.block} onChange={(e) => setF({ ...f, block: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Tipo de resposta</Label>
          <select value={f.kind} disabled={isNps || locked} onChange={(e) => setF({ ...f, kind: e.target.value as QuestionRow["kind"] })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60">
            {(isNps ? ["nps"] : ["likert", "likert_nr", "text"]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          {locked && !isNps && <p className="text-xs text-muted-foreground">{LOCK_NOTE}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Obrigatória
        </label>
        {f.kind === "text" && (
          <div className="space-y-1">
            <Label>Mínimo de caracteres</Label>
            <Input type="number" min={0} value={f.min_chars} onChange={(e) => setF({ ...f, min_chars: e.target.value })} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submit}>
          Salvar pergunta
        </Button>
        {!isNps && !locked && (
          <Button size="sm" variant="ghost" className="text-negative" onClick={onRemove}>
            <Trash2 /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
