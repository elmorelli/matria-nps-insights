import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { newWorkbook, addSheet, type SheetSpec } from "./xlsx-brand";

type Paint = { pattern?: string; fgColor?: { argb?: string } };
const paint = (c: ExcelJS.Cell) => c.fill as unknown as Paint;

const sheets: SheetSpec[] = [
  { name: "Clientes", columns: ["Nome *", "Status *", "Observações"], rows: [["Fleury", "Ativo", "x"], ["Albert Einstein", "Inativo", "yy"]] },
];

async function roundTrip() {
  const wb = await newWorkbook();
  sheets.forEach((s) => addSheet(wb, s));
  const buf = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buf as ArrayBuffer);
  return back.getWorksheet("Clientes")!;
}

describe("visual das planilhas", () => {
  it("cabeçalho azul com letra branca em negrito", async () => {
    const ws = await roundTrip();
    const a1 = ws.getCell("A1");
    expect(paint(a1).pattern).toBe("solid");
    expect(paint(a1).fgColor?.argb).toBe("FF073B84");
    expect(a1.font.bold).toBe(true);
    expect(a1.font.color?.argb).toBe("FFFFFFFF");
    expect(a1.font.name).toBe("Arial");
  });

  it("linhas do corpo em azul-escuro com zebra", async () => {
    const ws = await roundTrip();
    expect(ws.getCell("A2").font.color?.argb).toBe("FF021125");
    expect(paint(ws.getCell("A3")).pattern).toBe("solid");
    expect(paint(ws.getCell("A3")).fgColor?.argb).toBe("FFF2F7FF");
    expect(paint(ws.getCell("A2")).pattern).not.toBe("solid");
  });

  it("cabeçalho congelado, filtros e larguras dentro do limite", async () => {
    const ws = await roundTrip();
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    for (let c = 1; c <= 3; c++) {
      const w = ws.getColumn(c).width ?? 0;
      expect(w).toBeGreaterThanOrEqual(10);
      expect(w).toBeLessThanOrEqual(42);
    }
  });
});
