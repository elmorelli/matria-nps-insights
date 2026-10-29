import type { Workbook, Worksheet } from "exceljs";

// Identidade visual única de toda planilha baixada pela plataforma:
// cabeçalho azul-marinho com letra branca, linhas zebradas, cabeçalho congelado.
const FONT = "Arial";
const PRIMARY = "FF073B84";
const PRIMARY_DARK = "FF052A5E";
const INK = "FF021125";
const GRID = "FFDCE3EE";
const ZEBRA = "FFF2F7FF";
const MIN_W = 10;
const MAX_W = 42;

export type Cell = string | number | null | undefined;
export type SheetSpec = { name: string; columns: string[]; rows: Cell[][]; widths?: number[] };

export async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Matria";
  wb.created = new Date();
  return wb;
}

/** Aplica o visual padrão da Matria a uma folha já montada. */
export function styleSheet(ws: Worksheet, columns: string[], rowCount: number) {
  const header = ws.getRow(1);
  header.height = 26;
  for (let c = 1; c <= columns.length; c++) {
    const cell = header.getCell(c);
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARY } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: PRIMARY_DARK } } };
  }

  for (let r = 2; r <= Math.max(2, rowCount); r++) {
    const row = ws.getRow(r);
    row.height = 18;
    const zebra = r % 2 === 1;
    for (let c = 1; c <= columns.length; c++) {
      const cell = row.getCell(c);
      cell.font = { name: FONT, size: 10, color: { argb: INK } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = { bottom: { style: "thin", color: { argb: GRID } }, right: { style: "thin", color: { argb: GRID } } };
      if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  ws.properties.tabColor = { argb: PRIMARY };
}

export function addSheet(wb: Workbook, spec: SheetSpec): Worksheet {
  const ws = wb.addWorksheet(spec.name);
  ws.addRow(spec.columns);
  spec.rows.forEach((r) => ws.addRow(r));
  const rowCount = spec.rows.length + 1;
  styleSheet(ws, spec.columns, rowCount);
  spec.columns.forEach((_, i) => {
    const longest = spec.rows.reduce((m, r) => Math.max(m, String(r[i] ?? "").length), spec.columns[i].length);
    ws.getColumn(i + 1).width = spec.widths?.[i] ?? Math.min(MAX_W, Math.max(MIN_W, longest + 2));
  });
  return ws;
}

/** Salva a pasta de trabalho no computador do usuário. */
export async function writeWorkbook(wb: Workbook, fileName: string) {
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Monta e baixa uma planilha já no padrão visual da Matria. */
export async function downloadStyledWorkbook(fileName: string, sheets: SheetSpec[]) {
  const wb = await newWorkbook();
  sheets.forEach((s) => addSheet(wb, s));
  await writeWorkbook(wb, fileName);
}
