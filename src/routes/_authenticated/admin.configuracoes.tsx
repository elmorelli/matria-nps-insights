import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchSettings } from "@/lib/admin-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: SettingsPage,
});

const FIELDS = [
  ["template_initial", "Mensagem do primeiro envio"],
  ["template_reminder_1", "Lembrete 1"],
  ["template_reminder_2", "Lembrete 2"],
  ["template_reminder_3", "Lembrete 3"],
] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setForm(data as unknown as Record<string, string>);
  }, [data]);

  const save = async () => {
    const { error } = await supabase
      .from("settings")
      .update({
        template_initial: form.template_initial,
        template_reminder_1: form.template_reminder_1,
        template_reminder_2: form.template_reminder_2,
        template_reminder_3: form.template_reminder_3,
      })
      .eq("id", 1);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Mensagens salvas.");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Mensagens de WhatsApp</h1>
        <p className="mt-1 text-muted-foreground">Use {"{nome}"}, {"{instituição}"} e {"{link}"} para personalizar.</p>
      </div>
      {FIELDS.map(([k, label]) => (
        <div key={k} className="space-y-2">
          <Label htmlFor={k}>{label}</Label>
          <Textarea id={k} rows={4} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        </div>
      ))}
      <Button onClick={save}>Salvar</Button>
    </div>
  );
}
