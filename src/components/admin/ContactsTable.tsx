import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Package, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { CONTACT_STATUS_LABEL } from "@/lib/admin-data";
import { ROLES, STAGES, normalizePhone, isValidEmail, isValidPhone } from "@/lib/contacts";
import { allDataKey, type AllData, type Contact } from "@/lib/analytics";
import { TableWrap } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ContactsTable({ d, contacts, showAccount = true }: { d: AllData; contacts: Contact[]; showAccount?: boolean }) {
  const qc = useQueryClient();
  const [statusEdit, setStatusEdit] = useState<Contact | null>(null);
  const [prodEdit, setProdEdit] = useState<Contact | null>(null);
  const [timelineOf, setTimelineOf] = useState<Contact | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });
  const accName = useMemo(() => new Map(d.accounts.map((a) => [a.id, a.name])), [d.accounts]);

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("contacts").update(patch as never).eq("id", id);
    if (error) return toast.error("Não foi possível salvar.");
    refresh();
  };

  const heads = ["Nome", ...(showAccount ? ["Instituição"] : []), "Cargo", "Papel", "Telefone", "E-mail", "Produtos e estágios", "Situação", "Teste", ""];
  return (
    <>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-subtle text-left">
            <tr>
              {heads.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className={cn("border-t align-top", c.status !== "active" && "text-muted-foreground")}>
                <td className="px-1 py-1">
                  <Cell value={c.full_name} onSave={(v) => v.trim() && update(c.id, { full_name: v.trim() })} />
                </td>
                {showAccount && (
                  <td className="px-1 py-1">
                    <select value={c.account_id} onChange={(e) => update(c.id, { account_id: e.target.value })} className="max-w-48 rounded border border-transparent bg-transparent px-1 py-1 hover:border-border">
                      {d.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <span className="sr-only">{accName.get(c.account_id)}</span>
                  </td>
                )}
                <td className="px-1 py-1">
                  <Cell value={c.job_title ?? ""} onSave={(v) => update(c.id, { job_title: v || null })} />
                </td>
                <td className="px-1 py-1">
                  <select value={c.role ?? ""} onChange={(e) => update(c.id, { role: e.target.value || null })} className="rounded border border-transparent bg-transparent px-1 py-1 hover:border-border">
                    <option value="">Sem papel</option>
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
                      update(c.id, { phone: p });
                    }}
                  />
                </td>
                <td className="px-1 py-1">
                  <Cell
                    value={c.email ?? ""}
                    onSave={(v) => {
                      if (!isValidEmail(v.trim() || null)) return toast.error("E-mail inválido.");
                      update(c.id, { email: v.trim().toLowerCase() || null });
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setProdEdit(c)} className="text-left hover:underline">
                    {c.contact_products.length ? (
                      c.contact_products.map((p) => (
                        <div key={p.id} className="whitespace-nowrap">
                          {p.product} <span className="text-muted-foreground">· {p.mom_stage}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Adicionar</span>
                    )}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setStatusEdit(c)} className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs", c.status === "active" ? "bg-positive-bg text-positive" : "bg-offwhite text-muted-foreground")}>
                    {CONTACT_STATUS_LABEL[c.status]}
                  </button>
                  {c.status !== "active" && c.status_changed_at && <div className="mt-1 text-xs">{new Date(c.status_changed_at + "T12:00").toLocaleDateString("pt-BR")}</div>}
                </td>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={c.is_test} onChange={(e) => update(c.id, { is_test: e.target.checked })} aria-label="Contato de teste" />
                </td>
                <td className="px-3 py-2">
                  <button title="Linha do tempo" aria-label="Linha do tempo" onClick={() => setTimelineOf(c)} className="rounded-md p-2 text-primary hover:bg-highlight">
                    <History className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={heads.length} className="px-3 py-12 text-center text-muted-foreground">
                  Nenhum contato encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <ContactTimeline contact={timelineOf as never} onClose={() => setTimelineOf(null)} />
      <StatusDialog
        contact={statusEdit}
        onClose={() => setStatusEdit(null)}
        onSave={async (p) => {
          if (statusEdit) await update(statusEdit.id, p);
          setStatusEdit(null);
        }}
      />
      <ProductsDialog contact={prodEdit} onClose={() => setProdEdit(null)} onChanged={refresh} />
    </>
  );
}

function StatusDialog({ contact, onClose, onSave }: { contact: Contact | null; onClose: () => void; onSave: (p: Record<string, unknown>) => void }) {
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
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact.full_name}</DialogTitle>
        </DialogHeader>
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
          <Button onClick={() => onSave(status === "active" ? { status, status_reason: null, status_changed_at: null } : { status, status_reason: reason || null, status_changed_at: date })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductsDialog({ contact, onClose, onChanged }: { contact: Contact | null; onClose: () => void; onChanged: () => void }) {
  const [product, setProduct] = useState("");
  const [stage, setStage] = useState<string>(STAGES[0]);
  if (!contact) return null;
  const add = async () => {
    if (!product.trim()) return toast.error("Informe o produto.");
    const { error } = await supabase.from("contact_products").insert({ contact_id: contact.id, product: product.trim(), mom_stage: stage as never });
    if (error) return toast.error("Não foi possível adicionar.");
    setProduct("");
    onChanged();
    onClose();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("contact_products").delete().eq("id", id);
    if (error) return toast.error("Não foi possível remover.");
    onChanged();
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Produtos e estágios de {contact.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {contact.contact_products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>
                <Package className="mr-2 inline h-4 w-4 text-primary" />
                {p.product} <span className="text-muted-foreground">· {p.mom_stage}</span>
              </span>
              <button onClick={() => remove(p.id)} aria-label="Remover" className="text-negative">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Produto" value={product} onChange={(e) => setProduct(e.target.value)} className="flex-1" />
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button onClick={add}>
            <Plus /> Adicionar
          </Button>
        </div>
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
