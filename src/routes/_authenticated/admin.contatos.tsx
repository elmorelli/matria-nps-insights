import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Upload } from "lucide-react";
import { allDataKey, allDataQuery } from "@/lib/analytics";
import { CONTACT_STATUS_LABEL } from "@/lib/admin-data";
import { ROLES, type ImportRow } from "@/lib/contacts";
import { ImportDialog, downloadTemplate, parseFile } from "@/components/admin/ImportDialog";
import { ContactsTable } from "@/components/admin/ContactsTable";
import { Select } from "@/components/admin/FiltersBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/contatos")({
  head: () => ({ meta: [{ title: "Contatos | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: ContactsPage,
});

const EMPTY_ROW: ImportRow = { institution: "", full_name: "", phone: "", email: "", job_title: "", role: "", product: "", stage: "", notes: "" };

function ContactsPage() {
  const qc = useQueryClient();
  const { data: d } = useQuery(allDataQuery);
  const [q, setQ] = useState("");
  const [fAcc, setFAcc] = useState("");
  const [fRole, setFRole] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [hideTest, setHideTest] = useState(true);
  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const acc = new Map(d?.accounts.map((a) => [a.id, a.name]) ?? []);
    return (d?.contacts ?? []).filter((c) => {
      if (t && ![c.full_name, acc.get(c.account_id), c.email, c.phone].some((s) => (s ?? "").toLowerCase().includes(t))) return false;
      if (fAcc && c.account_id !== fAcc) return false;
      if (fRole && c.role !== fRole) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (hideTest && c.is_test) return false;
      return true;
    });
  }, [d, q, fAcc, fRole, fStatus, hideTest]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Contatos</h1>
        <p className="mt-1 text-muted-foreground">
          {d?.contacts.length ?? 0} pessoas cadastradas. {d?.contacts.filter((c) => c.status === "active").length ?? 0} ativas. Os envios de cada ciclo ficam em Ciclos, na aba Envios.
        </p>
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar por nome, instituição, e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background" />
        <Select value={fAcc} onChange={setFAcc} label="Todas as instituições" options={(d?.accounts ?? []).map((a) => [a.id, a.name])} />
        <Select value={fRole} onChange={setFRole} label="Todos os papéis" options={ROLES.map((r) => [r, r])} />
        <Select value={fStatus} onChange={setFStatus} label="Todas as situações" options={Object.entries(CONTACT_STATUS_LABEL)} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} /> Ocultar dados de teste
        </label>
      </div>
      {d && <ContactsTable d={d} contacts={rows} />}
      <ImportDialog rows={importRows} setRows={setImportRows} onDone={() => qc.invalidateQueries({ queryKey: allDataKey })} />
    </div>
  );
}
