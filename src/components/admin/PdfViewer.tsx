import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type PdfFormat = "16:9" | "a4";
const SIZE: Record<PdfFormat, { w: number; h: number }> = { "16:9": { w: 1280, h: 720 }, a4: { w: 794, h: 1123 } };

/**
 * Full-screen preview of fixed-size pages and real PDF download.
 * Each page is rendered at native pixel size, captured at 2x with html2canvas and placed one per PDF page.
 */
export function PdfViewer({ pages, format, filename, back }: { pages: React.ReactNode[]; format: PdfFormat; filename: string; back: () => void }) {
  const size = SIZE[format];
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  void router;

  useLayoutEffect(() => {
    const fit = () => {
      const w = wrap.current?.clientWidth ?? size.w;
      setScale(Math.min(1, (w - 32) / size.w));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size.w]);

  useEffect(() => {
    document.body.style.overflow = "";
  }, []);

  const download = async () => {
    setBusy(true);
    try {
      await document.fonts.ready;
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas-pro")]);
      const pdf = new jsPDF({ orientation: format === "a4" ? "portrait" : "landscape", unit: "px", format: [size.w, size.h], hotfixes: ["px_scaling"], compress: true });
      const els = refs.current.filter(Boolean) as HTMLDivElement[];
      for (let i = 0; i < els.length; i++) {
        const canvas = await html2canvas(els[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff", width: size.w, height: size.h, windowWidth: size.w, onclone: (doc, el) => {
          // Capture at native size: drop the preview scale on the cloned page.
          (el.parentElement as HTMLElement).style.transform = "none";
          void doc;
        } });
        if (i > 0) pdf.addPage([size.w, size.h], format === "a4" ? "portrait" : "landscape");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, size.w, size.h);
      }
      pdf.save(filename);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <Button variant="ghost" onClick={back}>
          <ArrowLeft /> Voltar
        </Button>
        <span className="text-sm text-muted-foreground">
          {pages.length} {pages.length === 1 ? "página" : "páginas"}
        </span>
        <Button onClick={download} disabled={busy}>
          <Download /> {busy ? "Gerando…" : "Baixar PDF"}
        </Button>
      </div>
      <div ref={wrap} className="flex flex-col items-center gap-6 px-4 py-6">
        {pages.map((p, i) => (
          <div key={i} style={{ width: size.w * scale, height: size.h * scale }} className="shrink-0">
            <div style={{ width: size.w, height: size.h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <div ref={(el) => void (refs.current[i] = el)} style={{ width: size.w, height: size.h }} className="overflow-hidden border bg-background">
                {p}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const pdfDate = () => new Date().toLocaleDateString("pt-BR").replaceAll("/", "-");
