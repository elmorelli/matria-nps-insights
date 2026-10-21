import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { allDataQuery } from "@/lib/analytics";
import { Results } from "@/components/admin/cycle/Results";
import { Respondents } from "@/components/admin/cycle/Respondents";
import { Sends } from "@/components/admin/cycle/Sends";
import { Messages } from "@/components/admin/cycle/Messages";
import { Settings } from "@/components/admin/cycle/Settings";
import { cn } from "@/lib/utils";

const TABS = [
  ["resultados", "Resultados"],
  ["respondentes", "Respondentes"],
  ["envios", "Envios"],
  ["mensagens", "Mensagens"],
  ["configuracoes", "Configurações"],
] as const;
type Tab = (typeof TABS)[number][0];

export const Route = createFileRoute("/_authenticated/admin/ciclos/$id")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => ({ tab: TABS.some(([k]) => k === s.tab) ? (s.tab as Tab) : undefined }),
  head: () => ({ meta: [{ title: "Ciclo | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: CyclePage,
});

function CyclePage() {
  const { id } = Route.useParams();
  const { tab = "resultados" } = Route.useSearch();
  const { data: d } = useQuery(allDataQuery);
  const cycle = d?.cycles.find((c) => c.id === id);
  if (!d) return <p className="text-muted-foreground">Carregando...</p>;
  if (!cycle) return <p>Ciclo não encontrado.</p>;
  const fmtD = (s: string) => new Date(s + "T12:00").toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/ciclos" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> Ciclos
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl">{cycle.name}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtD(cycle.start_date)}
            {cycle.end_date ? ` até ${fmtD(cycle.end_date)}` : ""} · {cycle.closed ? "Encerrado" : "Em coleta"} · Meta NPS +{cycle.target_nps} · Meta resposta {cycle.target_response_rate}%
          </p>
        </div>
      </div>
      <nav className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1">
          {TABS.map(([k, l]) => (
            <Link
              key={k}
              to="/admin/ciclos/$id"
              params={{ id }}
              search={{ tab: k }}
              className={cn("whitespace-nowrap border-b-2 px-4 py-2 text-sm", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {l}
            </Link>
          ))}
        </div>
      </nav>
      {tab === "resultados" && <Results d={d} cycle={cycle} />}
      {tab === "respondentes" && <Respondents d={d} cycle={cycle} />}
      {tab === "envios" && <Sends d={d} cycle={cycle} />}
      {tab === "mensagens" && <Messages cycle={cycle} />}
      {tab === "configuracoes" && <Settings d={d} cycle={cycle} />}
    </div>
  );
}
