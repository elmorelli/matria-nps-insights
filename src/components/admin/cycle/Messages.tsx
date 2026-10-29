import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fillTemplate } from "@/lib/contacts";
import { allDataKey, type Cycle } from "@/lib/analytics";

const FIELDS = [
  ["template_initial", "Primeiro envio"],
  ["template_reminder_1", "Lembrete 1"],
  ["template_reminder_2", "Lembrete 2"],
  ["template_reminder_3", "Lembrete 3"],
] as const;
type K = (typeof FIELDS)[number][0];

export function Messages({ cycle }: { cycle: Cycle }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<K, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, cycle[k]])) as Record<K, string>);
  useEffect(() => setForm(Object.fromEntries(FIELDS.map(([k]) => [k, cycle[k]])) as Record<K, string>), [cycle]);
  const sample = { nome: "Ana", instituicao: "Hospital Exemplo", link: `${typeof window !== "undefined" ? window.location.origin : ""}/r/teste` };

  const save = async () => {
    const { error } = await supabase.from("cycles").update(form).eq("id", cycle.id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Mensagens salvas.");
    qc.invalidateQueries({ queryKey: allDataKey });
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Estas mensagens valem só para este ciclo. Use {"{nome}"}, {"{instituição}"} e {"{link}"}. A prévia usa um contato de exemplo.
      </p>
      {FIELDS.map(([k, label]) => (
        <div key={k} className="grid gap-4 rounded-lg border bg-background p-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={k}>{label}</Label>
            <Textarea id={k} rows={6} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="flex-1 resize-none [field-sizing:content]" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Prévia</p>
            <div className="flex-1 whitespace-pre-wrap rounded-lg rounded-tl-none border bg-positive-bg p-4 text-sm">{fillTemplate(form[k], sample) || "Mensagem vazia."}</div>
          </div>
        </div>
      ))}
      <Button onClick={save}>Salvar mensagens</Button>
    </div>
  );
}
