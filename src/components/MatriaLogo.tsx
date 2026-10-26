import positivo from "@/assets/matria-logo-positivo.svg.asset.json";
import negativo from "@/assets/matria-logo-branco.svg.asset.json";
import pb from "@/assets/matria-logo-pb-positivo.svg";
import { cn } from "@/lib/utils";

/** "negativo" is the white logo with a transparent background, for Matria Blue areas, feixe backgrounds and dark photos. Official Matria logo. The source files include clear space around the mark. "pb" is the monochrome version, for PDF exports only. */
export function MatriaLogo({ variant = "positivo", className }: { variant?: "positivo" | "negativo" | "pb"; className?: string }) {
  const src = variant === "negativo" ? negativo.url : variant === "pb" ? pb : positivo.url;
  return <img src={src} alt="Matria" className={cn("h-12 min-h-5 w-auto select-none", className)} draggable={false} />;
}
