import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL } from "@/lib/admin-data";
import { npsBand } from "@/lib/nps";
import { EMPTY_FILTERS, answerLabel, cycleRows, questionsOf, type AllData, type Cycle, type Row, type QuestionRow } from "@/lib/analytics";
import { BAND_TEXT, ScorePill, TableWrap } from "@/components/admin/charts";
import { FiltersBar } from "@/components/admin/FiltersBar";
import { cn } from "@/lib/utils";

const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "–");
const dur = (s: number | null | undefined) => (s ? `${Math.floor(s / 60)}min ${s % 60}s` : "–");

export function AnswersList({ row, questions }: { row: Row; questions: QuestionRow[] }) {
  return (
    <ol className="space-y-4">
      {questions.map((q, i) => (
        <li key={q.key}>
          <p className="text-sm text-muted-foreground">
            {i + 1}. {q.text}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{answerLabel(q, row.answers[q.key])}</p>
        </li>
      ))}
    </ol>
  );
}

export function Respondents({ d, cycle }: { d: AllData; cycle: Cycle }) {
  const [f, setF] = useState(EMPTY_FILTERS);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const questions = questionsOf(d, cycle);
  const stageOf = (product: string, accountId: string) => d.accountProducts.find((ap) => ap.account_id === accountId && ap.product === product)?.mom_stage ?? "Sem estágio";
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return cycleRows(d, cycle.id, f).filter((r) => !t || [r.contact.full_name, r.account?.name, r.reason].some((s) => (s ?? "").toLowerCase().includes(t)));
  }, [d, cycle.id, f, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar por nome, instituição ou palavra" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs bg-background" />
        <FiltersBar d={d} f={f} set={setF} />
      </div>
      <p className="text-sm text-muted-foreground">
        {rows.length} convidados · {rows.filter((r) => r.answered).length} responderam. Clique em uma linha para ler as respostas.
      </p>
      <TableWrap>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-subtle text-left">
            <tr>
              {["", "Nome", "Instituição", "Cargo", "Papel", "Estágios e produtos", "Status", "Envio e lembretes", "Abertura", "NPS", "Duração"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open === r.inv.id;
              const reminders = [r.inv.reminder_1_at, r.inv.reminder_2_at, r.inv.reminder_3_at].filter(Boolean) as string[];
              return (
                <Fragment key={r.inv.id}>
                  <tr className={cn("cursor-pointer border-t align-top hover:bg-subtle", isOpen && "bg-subtle")} onClick={() => setOpen(isOpen ? null : r.inv.id)}>
                    <td className="px-3 py-3">{r.answered ? isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : null}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {r.contact.full_name}
                      {r.contact.is_test && <span className="ml-2 text-xs text-info">teste</span>}
                    </td>
                    <td className="px-3 py-3">{r.account?.name}</td>
                    <td className="px-3 py-3">{r.contact.job_title}</td>
                    <td className="whitespace-nowrap px-3 py-3">{r.contact.papel}</td>
                    <td className="px-3 py-3">
                      {r.contact.contact_products.map((p) => (
                        <div key={p.id} className="whitespace-nowrap">
                          {stageOf(p.product, r.contact.account_id)} <span className="text-muted-foreground">· {p.product}</span>
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{STATUS_LABEL[r.inv.status]}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {dt(r.inv.sent_at)}
                      {reminders.map((x, i) => (
                        <div key={i}>
                          L{i + 1} {dt(x)}
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{dt(r.inv.opened_at)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {r.score != null ? (
                        <span className="flex items-center gap-2">
                          <ScorePill score={r.score} />
                          <span className={cn("text-xs", BAND_TEXT[npsBand(r.score >= 9 ? 100 : r.score >= 7 ? 50 : -100)])}>
                            {r.score >= 9 ? "Promotor" : r.score >= 7 ? "Neutro" : "Detrator"}
                          </span>
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{dur(r.inv.responses?.duration_seconds)}</td>
                  </tr>
                  {isOpen && r.answered && (
                    <tr className="border-t bg-subtle">
                      <td colSpan={11} className="px-6 py-6">
                        <AnswersList row={r} questions={questions} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">
                  Nenhum convidado neste ciclo com estes filtros. Gere os links na aba Envios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
