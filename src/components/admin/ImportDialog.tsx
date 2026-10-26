import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TEMPLATE_COLUMNS, normalizePhone, validateRow, type ImportRow, type Role, type Stage } from "@/lib/contacts";
import { cn } from "@/lib/utils";

const KEYS: (keyof ImportRow)[] = ["institution", "full_name", "phone", "email", "job_title", "role", "product", "stage", "notes"];

export function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...TEMPLATE_COLUMNS],
    ["Hospital Exemplo", "Maria Silva", "(11) 98765-4321", "maria@hospital.com.br", "Diretora de Operações", "Sponsor", "Agendamento com IA", "Sustentação", ""],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  XLSX.writeFile(wb, "modelo-contatos-matria.xlsx");
}

export async function parseFile(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });
  return rows
    .slice(1)
    .filter((r) => r.some((c) => String(c).trim()))
    .map((r) => Object.fromEntries(KEYS.map((k, i) => [k, String(r[i] ?? "").trim()])) as ImportRow);
}

export function ImportDialog({ rows, setRows, onDone }: { rows: ImportRow[] | null; setRows: (r: ImportRow[] | null) => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!rows) return null;
  const errors = rows.map(validateRow);
  const validCount = errors.filter((e) => e.length === 0).length;

  const edit = (i: number, k: keyof ImportRow, v: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [k]: v };
    setRows(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      const valid = rows.filter((_, i) => errors[i].length === 0);
      const skipped = rows.length - valid.length;

      // accounts
      const { data: accs } = await supabase.from("accounts").select("id,name");
      const accMap = new Map((accs ?? []).map((a) => [a.name.toLowerCase(), a.id]));
      const missing = [...new Set(valid.map((r) => r.institution))].filter((n) => !accMap.has(n.toLowerCase()));
      if (missing.length) {
        const { data: created, error } = await supabase.from("accounts").insert(missing.map((name) => ({ name }))).select("id,name");
        if (error) throw error;
        created?.forEach((a) => accMap.set(a.name.toLowerCase(), a.id));
      }

      const { data: existing } = await supabase.from("contacts").select("id,account_id,email,phone");
      const list = [...(existing ?? [])];
      let created = 0;
      let updated = 0;
      const touched = new Set<string>();

      for (const r of valid) {
        const account_id = accMap.get(r.institution.toLowerCase())!;
        const phone = normalizePhone(r.phone);
        const email = r.email.trim().toLowerCase() || null;
        const match = list.find(
          (c) => c.account_id === account_id && ((email && c.email?.toLowerCase() === email) || (phone && c.phone === phone)),
        );
        const payload = {
          account_id,
          full_name: r.full_name.trim(),
          phone,
          email,
          job_title: r.job_title || null,
          role: r.role.trim() as Role,
          notes: r.notes || null,
        };
        let id: string;
        if (match) {
          id = match.id;
          const { error } = await supabase.from("contacts").update(payload).eq("id", id);
          if (error) throw error;
          if (!touched.has(id)) updated++;
        } else {
          const { data, error } = await supabase.from("contacts").insert(payload).select("id,account_id,email,phone").single();
          if (error) throw error;
          id = data.id;
          list.push(data);
          created++;
        }
        touched.add(id);
        if (r.product.trim()) {
          const { error } = await supabase
            .from("contact_products")
            .upsert({ contact_id: id, product: r.product.trim(), mom_stage: r.stage.trim() as Stage }, { onConflict: "contact_id,product" });
          if (error) throw error;
        }
      }
      toast.success(`${created} criados, ${updated} atualizados, ${skipped} ignorados por erro.`);
      setRows(null);
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao salvar a importação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && setRows(null)}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Revisar importação</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {rows.length} linhas. {validCount} prontas para salvar. Linhas em vermelho precisam de correção. Clique em uma célula para corrigir.
        </p>
        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-subtle">
              <tr>
                {TEMPLATE_COLUMNS.map((c) => (
                  <th key={c} className="px-2 py-2 text-left font-medium">
                    {c}
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-medium">Problemas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={cn("border-t", errors[i].length && "bg-negative-bg/40")}>
                  {KEYS.map((k) => (
                    <td key={k} className="px-1 py-1">
                      <input
                        value={r[k]}
                        onChange={(e) => edit(i, k, e.target.value)}
                        className="w-full min-w-24 rounded border border-transparent bg-transparent px-1 py-1 hover:border-border focus:border-primary focus:outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-negative">{errors[i].join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRows(null)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy || validCount === 0}>
            {busy ? "Salvando…" : `Salvar ${validCount} linhas`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
