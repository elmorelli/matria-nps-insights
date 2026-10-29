import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOptions, matchOption } from "@/lib/options";

const COLS = ["Nome *", "Status *", "Tier *", "Tipo", "País", "IAD", "KAE", "Observações"] as const;
type Row = { name: string; status: string; tier: string; segment: string; country: string; iad: string; kae: string; notes: string };
const KEYS: (keyof Row)[] = ["name", "status", "tier", "segment", "country", "iad", "kae", "notes"];

export function ClientImport({ onDone }: { onDone: () => void }) {
  const opts = useOptions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const countryLabels = opts.countries.map((c) => ({ label: String(c.extra.label ?? c.value), value: c.value }));
  const lists: Partial<Record<keyof Row, string[]>> = {
    status: opts.values("account_status"),
    tier: opts.values("account_tier"),
    segment: opts.values("account_type"),
    country: countryLabels.map((c) => c.label),
    iad: opts.values("iad"),
    kae: opts.values("kae"),
  };

  const download = async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Clientes");
    const ls = wb.addWorksheet("Listas", { state: "veryHidden" });
    ws.addRow([...COLS]);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0057B8" } };
    ws.columns.forEach((c, i) => (c.width = i === 0 || i === 7 ? 36 : 18));
    ws.views = [{ state: "frozen", ySplit: 1 }];
    KEYS.forEach((k, i) => {
      const vals = lists[k];
      if (!vals?.length) return;
      const col = ls.getColumn(i + 1);
      vals.forEach((v, r) => (ls.getCell(r + 1, i + 1).value = v));
      const letter = col.letter;
      for (let r = 2; r <= 1000; r++) {
        ws.getCell(r, i + 1).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`Listas!$${letter}$1:$${letter}$${vals.length}`],
          showErrorMessage: true,
          errorTitle: "Valor inválido",
          error: "Escolha uma opção da lista.",
        };
      }
    });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-clientes-matria.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const pick = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const data = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
    const parsed = data
      .slice(1)
      .filter((r) => r.some((c) => String(c).trim()))
      .map((r) => Object.fromEntries(KEYS.map((k, i) => [k, String(r[i] ?? "").trim()])) as Row);
    if (!parsed.length) return toast.error("A planilha está vazia.");
    setRows(parsed);
  };

  const check = (r: Row) => {
    const e: string[] = [];
    if (!r.name) e.push("Nome em branco");
    if (!r.status) e.push("Status em branco");
    if (!r.tier) e.push("Tier em branco");
    (["status", "tier", "segment", "country", "iad", "kae"] as const).forEach((k) => {
      if (r[k] && !matchOption(lists[k] ?? [], r[k])) e.push(`${COLS[KEYS.indexOf(k)].replace(" *", "")} fora da lista`);
    });
    return e;
  };

  const save = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const valid = rows.filter((r) => check(r).length === 0);
      const { data: accs } = await supabase.from("accounts").select("id,name");
      const byName = new Map((accs ?? []).map((a) => [a.name.toLowerCase(), a.id]));
      let created = 0;
      let updated = 0;
      for (const r of valid) {
        const m = (k: keyof Row) => (r[k] ? matchOption(lists[k] ?? [], r[k]) : null);
        const countryLabel = m("country");
        const payload = {
          name: r.name,
          status: m("status"),
          tier: m("tier"),
          segment: m("segment"),
          country: countryLabel ? (countryLabels.find((c) => c.label === countryLabel)?.value ?? null) : null,
          iad: m("iad"),
          kae: m("kae"),
          notes: r.notes || null,
        };
        const id = byName.get(r.name.toLowerCase());
        const { error } = id ? await supabase.from("accounts").update(payload).eq("id", id) : await supabase.from("accounts").insert(payload);
        if (error) throw error;
        if (id) updated++;
        else created++;
      }
      const skipped = rows.length - valid.length;
      toast.success(`${created} criadas, ${updated} atualizadas${skipped ? `, ${skipped} ignoradas por erro` : ""}.`);
      setRows(null);
      onDone();
    } catch {
      toast.error("Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  };

  const errs = rows?.map(check) ?? [];
  const ok = errs.filter((e) => !e.length).length;

  return (
    <>
      <Button variant="outline" onClick={download}>
        <Download /> Planilha modelo
      </Button>
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload /> Importar planilha
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      <Dialog open={!!rows} onOpenChange={(o) => !o && setRows(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Conferir importação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {ok} de {rows?.length ?? 0} linhas prontas. Instituições com o mesmo nome de uma já cadastrada serão atualizadas.
          </p>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {COLS.slice(0, 7).map((c) => (
                    <th key={c} className="px-2 py-1 text-left font-medium">{c.replace(" *", "")}</th>
                  ))}
                  <th className="px-2 py-1 text-left font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r, i) => (
                  <tr key={i} className="border-t">
                    {KEYS.slice(0, 7).map((k) => (
                      <td key={k} className="px-2 py-1">{r[k]}</td>
                    ))}
                    <td className={errs[i].length ? "px-2 py-1 text-destructive" : "px-2 py-1 text-primary"}>{errs[i].length ? errs[i].join(", ") : "Pronta"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRows(null)}>Cancelar</Button>
            <Button disabled={!ok || busy} onClick={save}>{busy ? "Importando" : `Importar ${ok} instituições`}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
