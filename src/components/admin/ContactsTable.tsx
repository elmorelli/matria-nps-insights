import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ContactTimeline } from "@/components/admin/ContactTimeline";
import { CONTACT_STATUS_LABEL } from "@/lib/admin-data";
import { formatPhone } from "@/lib/contacts";
import { ContactSheet } from "@/components/admin/ContactSheet";
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
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const [timelineOf, setTimelineOf] = useState<Contact | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: allDataKey });
  const accName = useMemo(() => new Map(d.accounts.map((a) => [a.id, a.name])), [d.accounts]);

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("contacts").update(patch as never).eq("id", id);
    if (error) return toast.error("Não foi possível salvar.");
    refresh();
  };

  const heads = ["Nome", ...(showAccount ? ["Instituição"] : []), "Cargo", "Papel", "Telefone", "E-mail", "Produtos", "Situação", "Teste", ""];
  return (
    <>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-subtle text-left">
            <tr>
              {heads.map((h, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className={cn("border-t align-top", c.status !== "active" && "text-muted-foreground")}>
                <td className="px-3 py-2 font-medium text-primary">
                  <button onClick={() => setEditing(c)} className="text-left hover:underline">
                    {c.full_name}
                  </button>
                </td>
                {showAccount && <td className="px-3 py-2">{accName.get(c.account_id)}</td>}
                <td className="px-3 py-2">{c.job_title}</td>
                <td className="whitespace-nowrap px-3 py-2">{c.papel ?? <span className="text-muted-foreground">Sem papel</span>}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatPhone(c.phone)}</td>
                <td className="px-3 py-2">{c.email}</td>
                <td className="px-3 py-2">
                  {c.contact_products.length ? (
                    c.contact_products.map((p) => (
                      <div key={p.id} className="whitespace-nowrap">
                        {p.product}
                      </div>
                    ))
                  ) : (
                    <span className="text-muted-foreground">Nenhum</span>
                  )}
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
                <td className="whitespace-nowrap px-3 py-2">
                  <button title="Editar" aria-label="Editar" onClick={() => setEditing(c)} className="rounded-md p-2 text-primary hover:bg-highlight">
                    <Pencil className="h-4 w-4" />
                  </button>
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
      <ContactSheet d={d} contact={editing} onClose={() => setEditing(undefined)} />
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

