import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Copy, MessageCircle, Send, Upload, Download, Plus, Link2, History } from "lucide-react";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchContacts,
  fetchCycles,
  fetchSettings,
  surveyLink,
  STATUS_LABEL,
  CONTACT_STATUS_LABEL,
  type ContactRow,
} from "@/lib/admin-data";
import { ROLES, fillTemplate, firstName, normalizePhone, isValidEmail, isValidPhone, type ImportRow } from "@/lib/contacts";
import { ImportDialog, downloadTemplate, parseFile } from "@/components/admin/ImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/contatos")({
  component: ContactsPage,
});

type Inv = ContactRow["invitations"][number];
const EMPTY_ROW: ImportRow = { institution: "", full_name: "", phone: "", email: "", job_title: "", role: "", product: "", stage: "", notes: "" };

function nextSendField(inv: Inv) {
  if (!inv.sent_at) return ["sent_at", "primeiro envio"] as const;
  if (!inv.reminder_1_at) return ["reminder_1_at", "lembrete 1"] as const;
  if (!inv.reminder_2_at) return ["reminder_2_at", "lembrete 2"] as const;
  if (!inv.reminder_3_at) return ["reminder_3_at", "lembrete 3"] as const;
  return null;
}

function ContactsPage() {
  const qc = useQueryClient();
  const { data: cycles } = useQuery({ queryKey: ["cycles"], queryFn: fetchCycles });
  const { data: contacts } = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [cycleId, setCycleId] = useState<string>("");
  const cycle = cycles?.find((c) => c.id === cycleId) ?? cycles?.find((c) => !c.closed);

  const [q, setQ] = useState("");
  const [fAcc, setFAcc] = useState("");
  const [fRole, setFRole] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [confirm, setConfirm] = useState<{ inv: Inv; name: string } | null>(null);
  const [statusEdit, setStatusEdit] = useState<ContactRow | null>(null);
  const [timelineOf, setTimelineOf] = useState<ContactRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["contacts"] });

  const invFor = (c: ContactRow) => c.invitations.find((i) => i.cycle_id === cycle?.id);

  const accounts = useMemo(() => [...new Set((contacts ?? []).map((c) => c.accounts?.name ?? ""))].sort(), [contacts]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (contacts ?? []).filter((c) => {
      const inv = invFor(c);
      if (term && !c.full_name.toLowerCase().includes(term) && !(c.accounts?.name ?? "").toLowerCase().includes(term)) return false;
      if (fAcc && c.accounts?.name !== fAcc) return false;
      if (fRole && c.role !== fRole) return false;
      if (fStatus) {
        if (fStatus.startsWith("c:")) {
          if (c.status !== fStatus.slice(2)) return false;
        } else if ((inv?.status ?? "none") !== fStatus) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, q, fAcc, fRole, fStatus, cycle?.id]);

  const messageFor = (c: ContactRow, inv: Inv) => {
    if (!settings) return "";
    const nf = nextSendField(inv);
    const tpl =
      nf?.[0] === "reminder_1_at"
        ? settings.template_reminder_1
        : nf?.[0] === "reminder_2_at"
          ? settings.template_reminder_2
          : nf?.[0] === "reminder_3_at"
            ? settings.template_reminder_3
            : settings.template_initial;
    return fillTemplate(tpl, { nome: firstName(c.full_name), instituicao: c.accounts?.name ?? "", link: surveyLink(inv.token) });
  };

  const generateLinks = async () => {
    if (!cycle) return;
    const missing = (contacts ?? []).filter((c) => c.status === "active" && !invFor(c));
    if (!missing.length) return toast.info("Todos os contatos ativos já têm link neste ciclo.");
    const { error } = await supabase.from("invitations").insert(missing.map((c) => ({ cycle_id: cycle.id, contact_id: c.id })));
    if (error) return toast.error("Não foi possível gerar os links.");
    toast.success(`${missing.length} links gerados.`);
    refresh();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const parsed = await parseFile(f);
      if (!parsed.length) return toast.error("A planilha está vazia.");
      setImportRows(parsed);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const copyText = async (t: string, ok: string) => {
    await navigator.clipboard.writeText(t);
    toast.success(ok);
  };

  const markSent = async (inv: Inv) => {
    const nf = nextSendField(inv);
    if (!nf) return toast.info("Todos os lembretes já foram registrados.");
    const patch: Record<string, string> = { [nf[0]]: new Date().toISOString() };
    if (inv.status === "not_sent") patch.status = "sent";
    const { error } = await supabase.from("invitations").update(patch as never).eq("id", inv.id);
    if (error) return toast.error("Não foi possível registrar.");
    toast.success(`Registrado: ${nf[1]}.`);
    refresh();
  };

  const updateContact = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("contacts").update(patch as never).eq("id", id);
    if (error) return toast.error("Não foi possível salvar.");
    refresh();
  };

  const exportSelected = () => {
    const list = (contacts ?? []).filter((c) => selected.has(c.id));
    const data = list.map((c) => {
      const inv = invFor(c);
      return {
        "Nome completo": c.full_name,
        Telefone: c.phone ?? "",
        "E-mail": c.email ?? "",
        Instituição: c.accounts?.name ?? "",
        Papel: c.role ?? "",
        Link: inv ? surveyLink(inv.token) : "",
        Mensagem: inv ? messageFor(c, inv) : "",
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Envio");
    XLSX.writeFile(wb, `envio-${cycle?.name ?? "ciclo"}.xlsx`);
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Contatos e links</h1>
          <p className="mt-1 text-muted-foreground">
            {contacts?.length ?? 0} contatos. {contacts?.filter((c) => c.status === "active").length ?? 0} ativos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="cycle" className="text-sm text-muted-foreground">
            Ciclo
          </Label>
          <select
            id="cycle"
            value={cycle?.id ?? ""}
            onChange={(e) => setCycleId(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {cycles?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-4">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload /> Importar planilha
        </Button>
        <Button variant="ghost" onClick={downloadTemplate}>
          <Download /> Baixar modelo
        </Button>
        <Button variant="ghost" onClick={() => setImportRows([{ ...EMPTY_ROW }])}>
          <Plus /> Adicionar contato
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={!selected.size} onClick={exportSelected}>
            <Download /> Exportar selecionados ({selected.size})
          </Button>
          <Button onClick={generateLinks} disabled={!cycle || cycle.closed}>
            <Link2 /> Gerar links do ciclo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por nome ou instituição" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background" />
        <FilterSelect value={fAcc} onChange={setFAcc} label="Todas as instituições" options={accounts.map((a) => [a, a])} />
        <FilterSelect value={fRole} onChange={setFRole} label="Todos os papéis" options={ROLES.map((r) => [r, r])} />
        <FilterSelect
          value={fStatus}
          onChange={setFStatus}
          label="Todos os status"
          options={[
            ["none", "Sem link"],
            ...Object.entries(STATUS_LABEL),
            ["c:left_organization", "Saiu da organização"],
            ["c:excluded_from_base", "Excluído da base"],
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left">
            <tr>
              <th className="w-10 px-3 py-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())}
                  aria-label="Selecionar todos"
                />
              </th>
              {["Nome", "Instituição", "Cargo", "Papel", "Telefone", "E-mail", "Produtos e estágios", "Status", "Ações"].map((h) => (
                <th key={h} className="px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const inv = invFor(c);
              const inactive = c.status !== "active";
              return (
                <tr key={c.id} className={cn("border-t align-top", inactive && "text-muted-foreground")}>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={(v) => {
                        const s = new Set(selected);
                        if (v) s.add(c.id);
                        else s.delete(c.id);
                        setSelected(s);
                      }}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Cell value={c.full_name} onSave={(v) => v.trim() && updateContact(c.id, { full_name: v.trim() })} />
                    {c.is_test && <span className="ml-2 text-xs text-info">teste</span>}
                  </td>
                  <td className="px-3 py-2">{c.accounts?.name}</td>
                  <td className="px-1 py-1">
                    <Cell value={c.job_title ?? ""} onSave={(v) => updateContact(c.id, { job_title: v || null })} />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={c.role ?? ""}
                      onChange={(e) => updateContact(c.id, { role: e.target.value })}
                      className="rounded border border-transparent bg-transparent px-1 py-1 hover:border-border"
                    >
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <Cell
                      value={c.phone ?? ""}
                      onSave={(v) => {
                        const p = normalizePhone(v);
                        if (!isValidPhone(p)) return toast.error("Telefone fora do padrão.");
                        updateContact(c.id, { phone: p });
                      }}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Cell
                      value={c.email ?? ""}
                      onSave={(v) => {
                        if (!isValidEmail(v.trim() || null)) return toast.error("E-mail inválido.");
                        updateContact(c.id, { email: v.trim().toLowerCase() || null });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {c.contact_products.map((p) => (
                      <div key={p.id} className="whitespace-nowrap">
                        {p.product} <span className="text-muted-foreground">· {p.mom_stage}</span>
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setStatusEdit(c)} className="text-left hover:underline">
                      {inactive ? (
                        <StatusPill tone="muted">{CONTACT_STATUS_LABEL[c.status]}</StatusPill>
                      ) : inv ? (
                        <StatusPill tone={inv.status === "answered" ? "positive" : inv.status === "not_sent" ? "muted" : "info"}>
                          {STATUS_LABEL[inv.status]}
                          {inv.status === "answered" && inv.responses?.q1_nps != null ? ` · ${inv.responses.q1_nps}` : ""}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="muted">Sem link</StatusPill>
                      )}
                    </button>
                    {inv?.sent_at && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Enviado {new Date(inv.sent_at).toLocaleDateString("pt-BR")}
                        {[inv.reminder_1_at, inv.reminder_2_at, inv.reminder_3_at].filter(Boolean).length > 0 &&
                          ` · ${[inv.reminder_1_at, inv.reminder_2_at, inv.reminder_3_at].filter(Boolean).length} lembrete(s)`}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <IconBtn label="Linha do tempo" onClick={() => setTimelineOf(c)}>
                      <History />
                    </IconBtn>
                    {inv && !inactive && (
                      <div className="flex gap-1">
                        <IconBtn label="Copiar link" onClick={() => copyText(surveyLink(inv.token), "Link copiado.")}>
                          <Copy />
                        </IconBtn>
                        <IconBtn
                          label="Copiar mensagem de WhatsApp"
                          onClick={async () => {
                            await copyText(messageFor(c, inv), "Mensagem copiada.");
                            if (inv.status !== "answered") setConfirm({ inv, name: c.full_name });
                          }}
                        >
                          <MessageCircle />
                        </IconBtn>
                        <IconBtn
                          label="Abrir no WhatsApp"
                          disabled={!c.phone}
                          onClick={() => {
                            const url = `https://wa.me/${(c.phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(messageFor(c, inv))}`;
                            window.open(url, "_blank", "noopener");
                            if (inv.status !== "answered") setConfirm({ inv, name: c.full_name });
                          }}
                        >
                          <Send />
                        </IconBtn>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">
                  Nenhum contato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ContactTimeline contact={timelineOf} onClose={() => setTimelineOf(null)} />
      <ImportDialog rows={importRows} setRows={setImportRows} onDone={refresh} />

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar envio de hoje?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {confirm && `Marcar ${nextSendField(confirm.inv)?.[1] ?? "envio"} para ${confirm.name} com a data de hoje.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Agora não
            </Button>
            <Button
              onClick={async () => {
                if (confirm) await markSent(confirm.inv);
                setConfirm(null);
              }}
            >
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StatusDialog
        contact={statusEdit}
        inv={statusEdit ? invFor(statusEdit) : undefined}
        onClose={() => setStatusEdit(null)}
        onMark={markSent}
        onSave={async (patch) => {
          if (statusEdit) await updateContact(statusEdit.id, patch);
          setStatusEdit(null);
        }}
      />
    </div>
  );
}

function StatusDialog({
  contact,
  inv,
  onClose,
  onSave,
  onMark,
}: {
  contact: ContactRow | null;
  inv?: Inv;
  onClose: () => void;
  onSave: (p: Record<string, unknown>) => void;
  onMark: (inv: Inv) => Promise<unknown>;
}) {
  const [status, setStatus] = useState("active");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (contact && loadedFor !== contact.id) {
    setLoadedFor(contact.id);
    setStatus(contact.status);
    setReason(contact.status_reason ?? "");
  }
  if (!contact) return null;
  const nf = inv ? nextSendField(inv) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact.full_name}</DialogTitle>
        </DialogHeader>
        {inv && inv.status !== "answered" && contact.status === "active" && (
          <div className="rounded-md bg-subtle p-4">
            <p className="text-sm text-muted-foreground">Envio no ciclo</p>
            <Button className="mt-2" variant="outline" disabled={!nf} onClick={async () => { await onMark(inv); onClose(); }}>
              {nf ? `Marcar ${nf[1]} hoje` : "Todos os lembretes registrados"}
            </Button>
          </div>
        )}
        <div className="space-y-3">
          <Label>Situação do contato</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            {Object.entries(CONTACT_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {status !== "active" && (
            <>
              <Label htmlFor="sd">Data</Label>
              <Input id="sd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Label htmlFor="sr">Motivo</Label>
              <Textarea id="sr" value={reason} onChange={(e) => setReason(e.target.value)} />
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave(
                status === "active"
                  ? { status, status_reason: null, status_changed_at: null }
                  : { status, status_reason: reason || null, status_changed_at: date },
              )
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Cell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [orig, setOrig] = useState(value);
  if (value !== orig) {
    setOrig(value);
    setV(value);
  }
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="w-full min-w-28 rounded border border-transparent bg-transparent px-2 py-1 hover:border-border focus:border-primary focus:outline-none"
    />
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
      <option value="">{label}</option>
      {options.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

function StatusPill({ tone, children }: { tone: "positive" | "info" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-sm",
        tone === "positive" && "bg-positive-bg text-positive",
        tone === "info" && "bg-highlight text-info",
        tone === "muted" && "bg-offwhite text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function IconBtn({ label, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...p}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-highlight disabled:opacity-30 [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </button>
  );
}
