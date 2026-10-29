import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Copy, Download, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABEL, surveyLink } from "@/lib/admin-data";
import { fillTemplate, firstName , formatPhone } from "@/lib/contacts";
import { EMPTY_FILTERS, allDataKey, cycleRows, matches, type AllData, type Cycle, type Invitation, type Row } from "@/lib/analytics";
import { TableWrap } from "@/components/admin/charts";
import { FiltersBar, Select } from "@/components/admin/FiltersBar";
import { cn } from "@/lib/utils";

export function nextSendField(inv: Pick<Invitation, "sent_at" | "reminder_1_at" | "reminder_2_at" | "reminder_3_at">) {
  if (!inv.sent_at) return ["sent_at", "primeiro envio", "template_initial"] as const;
  if (!inv.reminder_1_at) return ["reminder_1_at", "lembrete 1", "template_reminder_1"] as const;
  if (!inv.reminder_2_at) return ["reminder_2_at", "lembrete 2", "template_reminder_2"] as const;
  if (!inv.reminder_3_at) return ["reminder_3_at", "lembrete 3", "template_reminder_3"] as const;
  return null;
}

const SENDS = [
  ["sent_at", "Primeiro envio", "template_initial"],
  ["reminder_1_at", "Lembrete 1", "template_reminder_1"],
  ["reminder_2_at", "Lembrete 2", "template_reminder_2"],
  ["reminder_3_at", "Lembrete 3", "template_reminder_3"],
] as const;
type SendField = (typeof SENDS)[number][0];

export function Sends({ d, cycle }: { d: AllData; cycle: Cycle }) {
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY_FILTERS);
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ r: Row; field: SendField } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });

  const all = useMemo(() => cycleRows(d, cycle.id, { ...f, showTest: true }).filter((r) => f.showTest || !r.contact.is_test), [d, cycle.id, f]);
  const rows = all.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && ![r.contact.full_name, r.account?.name].some((s) => (s ?? "").toLowerCase().includes(t))) return false;
    if (fStatus && r.inv.status !== fStatus) return false;
    return true;
  });

  const aMap = new Map(d.accounts.map((a) => [a.id, a]));
  const missing = d.contacts.filter((c) => c.status === "active" && !d.invitations.some((i) => i.cycle_id === cycle.id && i.contact_id === c.id) && matches(c, aMap.get(c.account_id), { ...EMPTY_FILTERS, showTest: true }));

  const message = (r: Row) => {
    const nf = nextSendField(r.inv);
    const tpl = cycle[nf?.[2] ?? "template_reminder_3"];
    return fillTemplate(tpl, { nome: firstName(r.contact.full_name), instituicao: r.account?.name ?? "", link: surveyLink(r.inv.token) });
  };

  const generate = async () => {
    if (!missing.length) return toast.info("Todos os contatos ativos já têm link neste ciclo.");
    const { error } = await supabase.from("invitations").insert(missing.map((c) => ({ cycle_id: cycle.id, contact_id: c.id })));
    if (error) return toast.error("Não foi possível gerar os links.");
    toast.success(`${missing.length} links gerados.`);
    refresh();
  };

  const openSend = async (r: Row, field: SendField, tpl: (typeof SENDS)[number][2]) => {
    const text = fillTemplate(cycle[tpl], { nome: firstName(r.contact.full_name), instituicao: r.account?.name ?? "", link: surveyLink(r.inv.token) });
    if (r.contact.phone) window.open(`https://wa.me/${r.contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    else await copy(text, "Contato sem telefone. Mensagem copiada.");
    if (!r.inv[field]) setConfirm({ r, field });
  };

  const markField = async (r: Row, field: SendField) => {
    const patch: Record<string, string> = { [field]: new Date().toISOString() };
    if (r.inv.status === "not_sent") patch.status = "sent";
    const { error } = await supabase.from("invitations").update(patch as never).eq("id", r.inv.id);
    if (error) return toast.error("Não foi possível registrar.");
    toast.success("Envio registrado.");
    refresh();
  };

  const copy = async (t: string, ok: string) => {
    await navigator.clipboard.writeText(t);
    toast.success(ok);
  };

  const exportXlsx = () => {
    const list = selected.size ? rows.filter((r) => selected.has(r.inv.id)) : rows;
    const data = list.map((r) => ({
      "Nome completo": r.contact.full_name,
      Telefone: formatPhone(r.contact.phone),
      "E-mail": r.contact.email ?? "",
      Instituição: r.account?.name ?? "",
      Papel: r.contact.papel ?? "",
      Link: surveyLink(r.inv.token),
      Mensagem: message(r),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Envio");
    XLSX.writeFile(wb, `envio-${cycle.name}.xlsx`);
  };

  const allSel = rows.length > 0 && rows.every((r) => selected.has(r.inv.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-4">
        <Button onClick={generate} disabled={cycle.closed}>
          <Link2 /> Gerar links {missing.length ? `(${missing.length} sem link)` : ""}
        </Button>
        <Button variant="outline" onClick={exportXlsx} disabled={!rows.length}>
          <Download /> Exportar planilha {selected.size ? `(${selected.size})` : "(todos)"}
        </Button>
        <p className="text-sm text-muted-foreground">Cadastro de pessoas fica em Contatos. Aqui ficam só os envios deste ciclo.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por nome ou instituição" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background" />
        <Select value={fStatus} onChange={setFStatus} label="Status" options={Object.entries(STATUS_LABEL)} />
        <FiltersBar d={d} f={f} set={setF} />
      </div>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-subtle text-left">
            <tr>
              <th className="w-10 px-3 py-3">
                <Checkbox checked={allSel} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.inv.id)) : new Set())} aria-label="Selecionar todos" />
              </th>
              {["Nome", "Instituição", "Telefone", "Status", "Envios", "Próximo passo", "Ações"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const nf = nextSendField(r.inv);
              const done = r.inv.status === "answered";
              const count = [r.inv.sent_at, r.inv.reminder_1_at, r.inv.reminder_2_at, r.inv.reminder_3_at].filter(Boolean).length;
              return (
                <tr key={r.inv.id} className={cn("border-t", r.contact.status !== "active" && "text-muted-foreground")}>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.has(r.inv.id)}
                      onCheckedChange={(v) => {
                        const s = new Set(selected);
                        if (v) s.add(r.inv.id);
                        else s.delete(r.inv.id);
                        setSelected(s);
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.contact.full_name}
                    {r.contact.is_test && <span className="ml-2 text-xs text-info">teste</span>}
                  </td>
                  <td className="px-3 py-2">{r.account?.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatPhone(r.contact.phone)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", done ? "bg-positive-bg text-positive" : r.inv.status === "not_sent" ? "bg-offwhite text-muted-foreground" : "bg-highlight text-info")}>
                      {STATUS_LABEL[r.inv.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{count ? `${count} de 4` : "Nenhum"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{done ? "Concluído" : nf ? nf[1] : "Lembretes esgotados"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Icon label="Copiar link" onClick={() => copy(surveyLink(r.inv.token), "Link copiado.")}>
                        <Copy />
                      </Icon>
                      {SENDS.map(([field, label, tpl], i) => {
                        const at = r.inv[field];
                        return (
                          <button
                            key={field}
                            title={done ? "Já respondeu" : at ? `${label} registrado em ${new Date(at).toLocaleDateString("pt-BR")}. Abrir de novo` : `${label}: abrir mensagem no WhatsApp`}
                            disabled={done}
                            onClick={() => openSend(r, field, tpl)}
                            className={cn("h-8 min-w-8 rounded-md border px-2 text-xs disabled:opacity-40", at ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary hover:bg-highlight")}
                          >
                            {i === 0 ? "1º envio" : `Lembrete ${i}`}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                  Nenhum link gerado ainda. Use "Gerar links".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar envio de hoje?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">{confirm && `Marcar ${SENDS.find((x) => x[0] === confirm.field)?.[1]} para ${confirm.r.contact.full_name} com a data de hoje.`}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Agora não
            </Button>
            <Button
              onClick={async () => {
                if (confirm) await markField(confirm.r, confirm.field);
                setConfirm(null);
              }}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Icon({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} disabled={disabled} onClick={onClick} className="rounded-md p-2 text-primary hover:bg-highlight disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4">
      {children}
    </button>
  );
}
