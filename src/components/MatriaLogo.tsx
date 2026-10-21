import positivo from "@/assets/matria-logo-positivo.jpg.asset.json";
import negativo from "@/assets/matria-logo-negativo.jpg.asset.json";
import { cn } from "@/lib/utils";

/** Official Matria logo. The source files include clear space around the mark. */
export function MatriaLogo({ variant = "positivo", className }: { variant?: "positivo" | "negativo"; className?: string }) {
  const src = variant === "negativo" ? negativo.url : positivo.url;
  return <img src={src} alt="Matria" className={cn("h-12 w-auto select-none", className)} draggable={false} />;
}
