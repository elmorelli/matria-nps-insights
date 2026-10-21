import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABEL, CONTACT_STATUS_LABEL, surveyLink } from "@/lib/admin-data";
import { EMPTY_FILTERS, allDataKey, answerLabel, cycleRows, questionsOf, type AllData, type Cycle } from "@/lib/analytics";

export function Settings({ d, cycle }: { d: AllData; cycle: Cycle }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(cycle);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => setForm(cycle), [cycle]);
  const hasLinks = d.invitations.some((i) => i.cycle_id === cycle.id);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });

  const save = async () => {
    if (!form.name.trim() || !form.start_date) return toast.error("Informe nome e data de início.");
    if (!form.target_nps && form.target_nps !== 0) return toast.error("Informe a meta de NPS.");
    const { error } = await supabase
      .from("cycles")
      .update({
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        target_nps: Number(form.target_nps),
        target_response_rate: Number(form.target_response_rate),
        questionnaire_id: form.questionnaire_id,
        closed: form.closed,
      })
      .eq("id", cycle.id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Ciclo atualizado.");
    refresh();
  };

  const deleteTest = async () => {
    const testContacts = d.contacts.filter((c) => c.is_test).map((c) => c.id);
    if (!testContacts.length) {
      setConfirmDel(false);
      return toast.info("Não há dados de teste.");
    }
    const invIds = d.invitations.filter((i) => testContacts.includes(i.contact_id)).map((i) => i.id);
    const respIds = d.invitations.filter((i) => invIds.includes(i.id) && i.responses).map((i) => i.responses!.id);
    const steps = [
      respIds.length ? supabase.from("followups").delete().in("response_id", respIds) : null,
      respIds.length ? supabase.from("responses").delete().in("id", respIds) : null,
      supabase.from("contact_events").delete().in("contact_id", testContacts),
      invIds.length ? supabase.from("invitations").delete().in("id", invIds) : null,
      supabase.from("contact_products").delete().in("contact_id", testContacts),
      supabase.from("contacts").delete().in("id", testContacts),
    ];
    for (const s of steps) {
      if (!s) continue;
      const { error } = await s;
      if (error) {
        toast.error("Não foi possível apagar tudo. Tente de novo.");
        refresh();
        return;
      }
    }
    toast.success(`${testContacts.length} contatos de teste apagados com convites e respostas.`);
    setConfirmDel(false);
    refresh();
  };

  const exportXlsx = () => {
    const qs = questionsOf(d, cycle);
    const rows = cycleRows(d, cycle.id, { ...EMPTY_FILTERS, showTest: true });
    const resp = rows
      .filter((r) => r.answered)
      .map((r) => ({
        Nome: r.contact.full_name,
        Instituição: r.account?.name ?? "",
        Papel: r.contact.role ?? "",
        Cargo: r.contact.job_title ?? "",
        Data: new Date(r.inv.answered_at ?? r.inv.responses!.created_at).toLocaleString("pt-BR"),
        Teste: r.contact.is_test ? "Sim" : "Não",
        ...Object.fromEntries(qs.map((q, i) => [`${i + 1}. ${q.key}`, q.kind === "text" ? (r.answers[q.key]?.text ?? "") : r.answers[q.key]?.nr ? "Ainda não" : (r.answers[q.key]?.num ?? "")])),
      }));
    const inv = rows.map((r) => ({
      Nome: r.contact.full_name,
      Instituição: r.account?.name ?? "",
      Status: STATUS_LABEL[r.inv.status],
      Link: surveyLink(r.inv.token),
      "Primeiro envio": r.inv.sent_at ?? "",
      "Lembrete 1": r.inv.reminder_1_at ?? "",
      "Lembrete 2": r.inv.reminder_2_at ?? "",
      "Lembrete 3": r.inv.reminder_3_at ?? "",
      Abertura: r.inv.opened_at ?? "",
      Resposta: r.inv.answered_at ?? "",
    }));
    const aMap = new Map(d.accounts.map((a) => [a.id, a.name]));
    const con = d.contacts.map((c) => ({
      Nome: c.full_name,
      Instituição: aMap.get(c.account_id) ?? "",
      Cargo: c.job_title ?? "",
      Papel: c.role ?? "",
      Telefone: c.phone ?? "",
      "E-mail": c.email ?? "",
      "Produtos e estágios": c.contact_products.map((p) => `${p.product} (${p.mom_stage})`).join("; "),
      Situação: CONTACT_STATUS_LABEL[c.status],
      Teste: c.is_test ? "Sim" : "Não",
    }));
    const acc = d.accounts.map((a) => ({ Nome: a.name, Segmento: a.segment ?? "", País: a.country ?? "", Cidade: a.city ?? "", Responsável: a.owner_name ?? "", "Receita anual estimada": a.estimated_annual_revenue ?? "" }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resp), "Respostas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inv), "Convites");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(con), "Contatos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(acc), "Instituições");
    XLSX.writeFile(wb, `dados-${cycle.name}.xlsx`);
    void answerLabel;
  };

  const activeQs = d.questionnaires.filter((q) => q.active || q.id === cycle.questionnaire_id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 rounded-lg border bg-background p-6 lg:col-span-2">
        <div className="space-y-2">
          <Label htmlFor="n">Nome</Label>
          <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="s">Início</Label>
            <Input id="s" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e">Término</Label>
            <Input id="e" type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tn">Meta de NPS</Label>
            <Input id="tn" type="number" value={form.target_nps} onChange={(e) => setForm({ ...form, target_nps: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tr">Meta de taxa de resposta (%)</Label>
            <Input id="tr" type="number" value={form.target_response_rate} onChange={(e) => setForm({ ...form, target_response_rate: Number(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q">Questionário</Label>
          <select id="q" disabled={hasLinks} value={form.questionnaire_id ?? ""} onChange={(e) => setForm({ ...form, questionnaire_id: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60">
            {activeQs.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name} (versão {q.version})
              </option>
            ))}
          </select>
          {hasLinks && <p className="text-sm text-muted-foreground">Os links já foram gerados. O questionário não pode mais mudar neste ciclo.</p>}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.closed} onChange={(e) => setForm({ ...form, closed: e.target.checked })} /> Coleta encerrada
        </label>
        <Button onClick={save}>Salvar</Button>
      </div>
      <div className="space-y-3">
        <a href={`/r/teste?q=${cycle.questionnaire_id ?? ""}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg border bg-background p-4 text-primary hover:bg-highlight">
          <Eye className="h-4 w-4" /> Ver pesquisa como teste
        </a>
        <button onClick={exportXlsx} className="flex w-full items-center gap-2 rounded-lg border bg-background p-4 text-left text-primary hover:bg-highlight">
          <Download className="h-4 w-4" /> Exportar dados do ciclo (xlsx)
        </button>
        <button onClick={() => setConfirmDel(true)} className="flex w-full items-center gap-2 rounded-lg border bg-background p-4 text-left text-negative hover:bg-negative-bg">
          <Trash2 className="h-4 w-4" /> Apagar dados de teste
        </button>
      </div>
      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar dados de teste?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Vamos apagar {d.contacts.filter((c) => c.is_test).length} contatos marcados como teste, com seus convites e respostas em todos os ciclos. Não dá para desfazer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={deleteTest}>
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
