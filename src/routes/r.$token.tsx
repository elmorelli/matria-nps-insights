import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, ListChecks, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";
import { LIKERT_LABELS, SEED_QUESTIONS, groupBlocks, isAnswered, type AnswerMap, type Question } from "@/lib/survey";
import { firstName } from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { getSurveyMeta, DEFAULT_META } from "@/lib/survey-meta.functions";
import feixeAzul from "@/assets/feixe-azul.webp.asset.json";
import fotoMaos from "@/assets/medico-maos-paciente.webp.asset.json";
import fotoMedica from "@/assets/medica-paciente-02.webp.asset.json";
import assinatura from "@/assets/assinatura-eduardo.png.asset.json";

export const Route = createFileRoute("/r/$token")({
  loader: () => getSurveyMeta(),
  head: ({ loaderData }) => {
    const m = loaderData ?? { origin: "", ...DEFAULT_META };
    const ogTitle = `Pesquisa NPS Matria. ${m.title.replace(/^Pesquisa( NPS)? Matria\.?\s*/i, "")}`.replace(/\.\s*$/, "");
    const img = m.origin ? `${m.origin}/og-pesquisa.jpg` : undefined;
    return {
      meta: [
        { title: ogTitle },
        { name: "description", content: m.description },
        { property: "og:title", content: ogTitle },
        { property: "og:description", content: m.description },
        { property: "og:type", content: "website" },
        ...(img
          ? [
              { property: "og:image", content: img },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { name: "twitter:image", content: img },
            ]
          : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: SurveyPage,
});

type Info = { state: "loading" | "open" | "answered" | "closed" | "not_found" | "error"; name?: string; account?: string };

function SurveyPage() {
  const { token } = Route.useParams();
  const meta = Route.useLoaderData();
  const duration = meta?.duration ?? DEFAULT_META.duration;
  const preview = token === "teste";
  const [info, setInfo] = useState<Info>({ state: "loading" });
  const [confirmed, setConfirmed] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<Question[]>(SEED_QUESTIONS);
  const [stage, setStage] = useState<"intro" | "q" | "review" | "done">("intro");
  const [returnToReview, setReturnToReview] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());
  const draftKey = `matria-nps-draft2-${token}`;
  const okKey = `matria-nps-ok-${token}`;
  const blocks = useMemo(() => groupBlocks(questions), [questions]);

  const confirm = async () => {
    if (preview) {
      setConfirmed(true);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("survey_confirm", { _token: token });
    setBusy(false);
    const d = data as unknown as (Info & { questions?: Question[] }) | null;
    if (error || !d) return setInfo({ state: "error" });
    if (d.state !== "open") return setInfo(d);
    if (d.questions?.length) setQuestions(d.questions);
    setInfo({ state: "open", name: d.name, account: d.account });
    localStorage.setItem(okKey, "1");
    setConfirmed(true);
  };

  const decline = async () => {
    if (!preview) await supabase.rpc("survey_decline", { _token: token });
    localStorage.removeItem(okKey);
    setDeclined(true);
  };

  useEffect(() => {
    if (preview) {
      setInfo({ state: "open", name: "Visitante de teste", account: "Instituição de teste" });
      const qid = new URLSearchParams(window.location.search).get("q");
      if (qid) {
        supabase
          .from("questions")
          .select("key,kind,text,required,min_chars,block,block_note")
          .eq("questionnaire_id", qid)
          .order("position")
          .then(({ data }) => {
            if (data?.length) setQuestions(data as Question[]);
          });
      }
      return;
    }
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      setInfo({ state: "not_found" });
      return;
    }
    supabase.rpc("survey_status", { _token: token }).then(({ data, error }) => {
      if (error) return setInfo({ state: "error" });
      const s = data as unknown as Info;
      setInfo(s);
      if (s.state === "open" && localStorage.getItem(okKey)) confirm();
    });
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        setAnswers(d.answers ?? {});
        if (typeof d.idx === "number") setIdx(d.idx);
        if (d.started) {
          setStage("q");
          startRef.current = d.started;
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, draftKey]);

  const save = (a: AnswerMap, i: number) => {
    if (preview) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers: a, idx: i, started: startRef.current }));
    } catch {
      /* ignore */
    }
  };

  const update = (key: string, patch: AnswerMap[string]) => {
    setAnswers((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      save(next, idx);
      return next;
    });
  };

  const goto = (i: number) => {
    setIdx(i);
    save(answers, i);
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    if (preview) return setStage("done");
    setSubmitting(true);
    setErr(null);
    const payload = {
      answers,
      duration_seconds: Math.round((Date.now() - startRef.current) / 1000),
      user_agent: navigator.userAgent,
    };
    const { error } = await supabase.rpc("survey_submit_by_token", { _token: token, _a: payload as never });
    setSubmitting(false);
    if (error) {
      setErr("Não conseguimos enviar agora. Verifique a conexão e tente de novo.");
      return;
    }
    localStorage.removeItem(draftKey);
    setStage("done");
  };

  const name = info.name ? firstName(info.name) : "";
  const lead = duration.replace(/^Leva\s+/i, "").replace(/\.$/, "").toLowerCase();

  if (info.state === "loading") return <Shell><p className="text-muted-foreground">Carregando…</p></Shell>;
  if (info.state === "not_found" || info.state === "error")
    return (
      <Shell>
        <h1 className="text-2xl">Link não encontrado</h1>
        <p className="mt-3 text-muted-foreground">Confira se o link está completo ou fale com o seu contato na Matria.</p>
      </Shell>
    );
  if (info.state === "closed")
    return (
      <Shell>
        <h1 className="text-2xl">Esta pesquisa foi encerrada</h1>
        <p className="mt-3 text-muted-foreground">Obrigado pelo interesse.</p>
      </Shell>
    );
  if (info.state === "answered" && stage !== "done")
    return (
      <ThankYou name={name} account={info.account} />
    );
  if (stage === "done") return <ThankYou name={name} account={info.account} />;

  if (declined)
    return (
      <Shell>
        <p className="text-base leading-relaxed">Obrigado por avisar. Vamos corrigir isso com o seu contato na Matria.</p>
      </Shell>
    );

  if (!confirmed)
    return (
      <PhotoScreen account={info.account ?? ""} photo={fotoMaos.url} position="50% 40%">
        {preview && <PreviewBadge />}
        <h1 className="text-2xl leading-snug">Olá{name ? `, ${name}` : ""}.</h1>
        <p className="mt-4 text-base leading-relaxed">
          Sou o Eduardo Morelli, COO da Matria e responsável pela experiência dos nossos clientes. Esta pesquisa leva {lead} e eu leio cada resposta
          pessoalmente. O que você disser aqui volta para você por escrito.
        </p>
        <p className="mt-4 text-base leading-relaxed">Desde já, obrigado pelo seu tempo.</p>
        <div className="mt-8">
          <img src={assinatura.url} alt="Assinatura de Eduardo Morelli" className="h-28 w-auto object-contain" />
          <p className="mt-2 text-base text-primary">Eduardo Morelli</p>
          <p className="text-sm text-muted-foreground">COO - Matria</p>
        </div>
        <PrimaryButton className="mt-8" disabled={busy} onClick={confirm}>
          {busy ? "Abrindo…" : "Sou eu, começar"}
        </PrimaryButton>
        <button
          type="button"
          onClick={decline}
          className="mt-4 min-h-14 w-full rounded-md border border-primary/40 bg-transparent px-6 text-sm text-primary hover:bg-primary/5"
        >
          Não sou eu
        </button>
      </PhotoScreen>
    );

  if (stage === "intro")
    return (
      <Shell account={info.account}>
        {preview && <PreviewBadge />}
        <p className="text-sm text-primary">Pesquisa de relacionamento</p>
        <h1 className="mt-2 text-3xl leading-tight">Olá, {name}.</h1>
        <p className="mt-4 text-base leading-relaxed">
          Esta pesquisa é sobre a experiência de {info.account} com a Matria como parceira, desde o início da nossa relação. {duration.replace(/\.$/, "")}. Se alguma pergunta falar de uma etapa que a sua organização ainda não viveu conosco, marque a opção 'Ainda não chegamos nesta etapa'.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-2 text-center">
          {[
            [<Clock key="c" />, duration.replace(/^Leva (uns |cerca de )?/i, "").replace(/\.$/, "")],
            [<ListChecks key="l" />, `${questions.length} perguntas`],
            [<Save key="s" />, "Salva sozinha"],
          ].map(([icon, label], i) => (
            <div key={i} className="rounded-lg bg-highlight px-2 py-4 text-sm text-primary [&_svg]:mx-auto [&_svg]:mb-2 [&_svg]:h-5 [&_svg]:w-5">
              {icon}
              {label}
            </div>
          ))}
        </div>
        <ol className="mt-8 space-y-3">
          {blocks.map((b, i) => (
            <li key={b.title} className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-brand-light text-sm text-primary">{i + 1}</span>
              <span>{b.title}</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {b.to - b.from + 1} {b.to - b.from === 0 ? "pergunta" : "perguntas"}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted-foreground">A sua resposta é identificada e lida pela liderança da Matria.</p>
        <PrimaryButton
          className="mt-6"
          onClick={() => {
            startRef.current = Date.now();
            setStage("q");
            save(answers, idx);
          }}
        >
          Começar
        </PrimaryButton>
      </Shell>
    );

  if (stage === "review")
    return (
      <Shell account={info.account}>
        {preview && <PreviewBadge />}
        <p className="text-sm text-primary">Último passo</p>
        <h1 className="mt-2 text-2xl leading-snug">Confira as suas respostas</h1>
        <p className="mt-2 text-muted-foreground">Se quiser mudar algo, toque em Alterar. Depois é só confirmar o envio.</p>
        <div className="mt-8 space-y-8">
          {blocks.map((b) => (
            <section key={b.title}>
              <h2 className="text-sm text-muted-foreground">{b.title}</h2>
              <ul className="mt-3 divide-y divide-border rounded-lg border">
                {questions.slice(b.from, b.to + 1).map((s, i) => {
                  const qi = b.from + i;
                  return (
                    <li key={s.key} className="flex items-start gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">
                          {qi + 1}. {s.text}
                        </p>
                        <p className="mt-1 break-words">{reviewAnswer(s, answers)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnToReview(true);
                          setStage("q");
                          goto(qi);
                        }}
                        className="shrink-0 rounded-md px-2 py-1 text-sm text-primary hover:bg-highlight"
                      >
                        Alterar
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        {err && <p className="mt-6 rounded-md bg-negative-bg p-3 text-sm text-foreground">{err}</p>}
        <PrimaryButton className="mt-10" disabled={submitting} onClick={submit}>
          {submitting ? "Enviando…" : "Confirmar e enviar"}
        </PrimaryButton>
      </Shell>
    );

  const step = questions[Math.min(idx, questions.length - 1)];
  const cur = answers[step.key] ?? {};
  const ok = isAnswered(step, answers);
  const last = idx >= questions.length - 1;
  const blkIndex = blocks.findIndex((b) => idx >= b.from && idx <= b.to);
  const blk = blocks[blkIndex];
  const advance = () => {
    if (returnToReview || last) {
      setReturnToReview(false);
      setStage("review");
      window.scrollTo({ top: 0 });
    } else goto(idx + 1);
  };
  const autoAdvance = () => {
    if (returnToReview || last) return;
    window.setTimeout(() => goto(idx + 1), 280);
  };

  return (
    <Shell account={info.account} footer={false}>
      {preview && <PreviewBadge />}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => (idx === 0 ? setStage("intro") : goto(idx - 1))}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <span>
            Pergunta {idx + 1} de {questions.length}
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {blocks.map((b) => {
            const total = b.to - b.from + 1;
            const done = Math.min(total, Math.max(0, idx - b.from + 1));
            return (
              <div key={b.title} className="h-1.5 overflow-hidden rounded-full bg-offwhite" style={{ flex: total }}>
                <div className="h-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            );
          })}
        </div>
      </div>

      <p className="inline-flex rounded-full bg-highlight px-3 py-1 text-sm text-primary">
        Bloco {blkIndex + 1} · {blk?.title}
      </p>
      <h2 className="mt-4 text-xl font-normal leading-snug text-primary sm:text-2xl">{step.text}</h2>

      <div className="mt-8">
        {step.kind === "nps" && <NpsScale value={cur.num ?? undefined} onChange={(v) => update(step.key, { num: v })} />}
        {step.kind === "likert" && (
          <Likert
            value={cur.num ?? undefined}
            onChange={(v) => {
              update(step.key, { num: v });
              autoAdvance();
            }}
          />
        )}
        {step.kind === "likert_nr" && (
          <>
            <Likert
              value={cur.num ?? undefined}
              onChange={(v) => {
                update(step.key, { num: v, nr: false });
                autoAdvance();
              }}
            />
            <button
              type="button"
              onClick={() => {
                update(step.key, { num: null, nr: true });
                autoAdvance();
              }}
              className={cn(
                "mt-6 w-full rounded-lg border border-dashed px-4 py-4 text-left text-base",
                cur.nr ? "border-primary bg-highlight text-primary" : "border-border bg-subtle hover:bg-offwhite",
              )}
            >
              Ainda não chegamos nesta etapa
            </button>
          </>
        )}
        {step.kind === "text" && (
          <>
            <textarea
              value={cur.text ?? ""}
              onChange={(e) => update(step.key, { text: e.target.value })}
              rows={6}
              className="w-full rounded-lg border border-input bg-background p-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-highlight"
              placeholder={step.required ? "Conte com as suas palavras" : "Opcional. Pode deixar em branco"}
            />
            {step.required && step.min_chars && (
              <p className="mt-2 text-sm text-muted-foreground">
                {Math.max(0, step.min_chars - (cur.text ?? "").trim().length) > 0 ? `Escreva pelo menos ${step.min_chars} caracteres.` : " "}
              </p>
            )}
          </>
        )}
      </div>

      <PrimaryButton className="mt-10" disabled={!ok} onClick={advance}>
        {returnToReview || last ? "Revisar respostas" : "Continuar"}
      </PrimaryButton>
    </Shell>
  );
}

function reviewAnswer(s: Question, a: AnswerMap): string {
  const v = a[s.key] ?? {};
  if (s.kind === "nps") return typeof v.num === "number" ? String(v.num) : "Sem resposta";
  if (s.kind === "likert_nr" && v.nr) return "Ainda não chegamos nesta etapa";
  if (s.kind === "likert" || s.kind === "likert_nr") return typeof v.num === "number" ? `${v.num} · ${LIKERT_LABELS[v.num - 1]}` : "Sem resposta";
  return (v.text ?? "").trim() || "Sem resposta";
}

function Shell({ children, account, footer = true }: { children: React.ReactNode; account?: string; footer?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-1">
          <MatriaLogo className="h-12" />
          {account && <span className="truncate text-sm text-primary">{account}</span>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="py-8 text-center text-sm text-muted-foreground">{footer ? "Data for better care." : " "}</footer>
    </div>
  );
}

function PrimaryButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        "flex min-h-14 w-full items-center justify-center rounded-md bg-primary px-6 text-base text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    />
  );
}

function NpsScale({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const nums = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  return (
    <div>
      <div className="grid grid-cols-11 gap-1 sm:gap-2" role="radiogroup" aria-label="Nota de 0 a 10">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-12 items-center justify-center rounded-md border text-base sm:h-14 sm:text-lg",
              value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary hover:bg-highlight",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-11 gap-1 sm:gap-2" aria-hidden>
        <div className="col-span-7 h-1 rounded-full bg-negative-bg" />
        <div className="col-span-2 h-1 rounded-full bg-attention-bg" />
        <div className="col-span-2 h-1 rounded-full bg-positive-bg" />
      </div>
      <div className="mt-3 flex justify-between text-sm text-muted-foreground">
        <span>Nada provável</span>
        <span>Muito provável</span>
      </div>
    </div>
  );
}

function Likert({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {LIKERT_LABELS.map((label, i) => {
        const v = i + 1;
        const sel = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(v)}
            className={cn(
              "flex min-h-13 items-center gap-4 rounded-md border px-4 py-3 text-left text-base",
              sel ? "border-primary bg-highlight text-primary" : "border-border bg-background hover:bg-subtle",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm",
                sel ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {v}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PreviewBadge() {
  return (
    <p className="mb-6 rounded-md bg-highlight px-3 py-2 text-sm text-info">
      Modo de teste. Nada do que você responder aqui será salvo.
    </p>
  );
}

function ThankYou({ name, account }: { name: string; account?: string }) {
  return (
    <PhotoScreen account={account ?? ""} photo={fotoMedica.url} position="30% 35%">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-light text-green-dark">
        <Check className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-3xl leading-tight">{name ? `Obrigado, ${name}.` : "Obrigado."}</h1>
      <p className="mt-4 text-lg font-light leading-relaxed text-primary">Você vai receber da Matria, por escrito, o que ouvimos e o que vamos fazer a respeito.</p>
    </PhotoScreen>
  );
}

/** Reduced blue band (logo, institution) over a full-bleed photo with a white card. */
function PhotoScreen({ account, photo, position, children }: { account: string; photo: string; position: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-[88px] shrink-0 items-center justify-between gap-4 bg-primary bg-cover bg-center px-5 sm:h-[104px] sm:px-10" style={{ backgroundImage: `url(${feixeAzul.url})` }}>
        <div className="relative aspect-[4.167/1] h-11 shrink-0 overflow-hidden sm:h-16">
          <MatriaLogo variant="negativo" className="absolute left-1/2 top-1/2 h-[219%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-right text-lg font-light leading-tight text-primary-foreground sm:text-[22px]">{account}</p>
      </header>
      <div className="relative flex flex-1 items-start justify-center px-6 pt-16 pb-8 sm:pt-24">
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
        <main className="relative w-full max-w-[440px] rounded-lg border bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
