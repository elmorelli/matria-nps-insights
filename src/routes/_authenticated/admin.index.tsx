import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchContacts, fetchCycles } from "@/lib/admin-data";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function Overview() {
  const { data: cycles } = useQuery({ queryKey: ["cycles"], queryFn: fetchCycles });
  const { data: contacts } = useQuery({ queryKey: ["contacts"], queryFn: fetchContacts });
  const cycle = cycles?.find((c) => !c.closed);
  const prev = cycles?.find((c) => c.closed);

  const valid = (contacts ?? []).filter((c) => c.status === "active");
  const invs = valid.flatMap((c) => c.invitations.filter((i) => i.cycle_id === cycle?.id));
  const answered = invs.filter((i) => i.status === "answered");
  const scores = answered.map((i) => i.responses?.q1_nps).filter((n): n is number => typeof n === "number");
  const promo = scores.filter((s) => s >= 9).length;
  const detr = scores.filter((s) => s <= 6).length;
  const nps = scores.length ? Math.round(((promo - detr) / scores.length) * 100) : null;
  const rate = valid.length ? Math.round((answered.length / valid.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">{cycle?.name ?? "Sem ciclo ativo"}</h1>
        <p className="mt-1 text-muted-foreground">Prévia. O painel completo de resultados vem na próxima etapa.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="NPS" value={nps === null ? "–" : (nps > 0 ? "+" : "") + nps} note={prev?.reference_nps != null ? `Ciclo anterior +${prev.reference_nps}` : undefined} />
        <Kpi label="Taxa de resposta" value={`${rate}%`} note={`Meta ${cycle?.target_response_rate ?? 75}%`} />
        <Kpi label="Respostas" value={String(answered.length)} note={`de ${valid.length} contatos válidos`} />
        <Kpi label="Links gerados" value={String(invs.length)} />
      </div>
      {scores.length > 0 && scores.length < 10 && (
        <p className="rounded-md border border-attention bg-background p-3 text-sm">Amostra pequena (n &lt; 10). Leia os números com cautela.</p>
      )}
      <Link to="/admin/contatos" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Ir para contatos e links
      </Link>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border bg-background p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
