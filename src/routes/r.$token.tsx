import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";
import { STEPS, LIKERT_LABELS, isStepAnswered, type Answers } from "@/lib/survey";
import { firstName } from "@/lib/contacts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Pesquisa Matria" },
      { name: "description", content: "Conte como tem sido a parceria com a Matria." },
      { property: "og:title", content: "Pesquisa Matria" },
      { property: "og:description", content: "Conte como tem sido a parceria com a Matria. Leva uns 3 minutos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SurveyPage,
});

type Info = { state: "loading" | "open" | "answered" | "closed" | "not_found" | "error"; name?: string; account?: string };

function SurveyPage() {
  const { token } = Route.useParams();
  const preview = token === "teste";
  const [info, setInfo] = useState<Info>({ state: "loading" });
  const [verified, setVerified] = useState(false);
  const [ident, setIdent] = useState({ first: "", email: "" });
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState<"intro" | "q" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());
  const draftKey = `matria-nps-draft-${token}`;
  const idKey = `matria-nps-id-${token}`;

  const verify = async (first: string, email: string, silent = false) => {
    if (preview) {
      setInfo({ state: "open", name: first || "Visitante", account: "Instituição de teste" });
      setVerified(true);
      return;
    }
    setChecking(true);
    setGateErr(null);
    const { data, error } = await supabase.rpc("survey_verify", { _token: token, _first: first, _email: email });
    setChecking(false);
    const d = data as unknown as { ok: boolean; name?: string; account?: string; answered?: boolean } | null;
    if (error || !d?.ok) {
      if (!silent) setGateErr("Não encontramos esses dados para este link. Confira o primeiro nome e o e-mail.");
      localStorage.removeItem(idKey);
      return;
    }
    localStorage.setItem(idKey, JSON.stringify({ first, email }));
    setIdent({ first, email });
    setInfo({ state: d.answered ? "answered" : "open", name: d.name, account: d.account });
    setVerified(true);
  };

  useEffect(() => {
    if (preview) {
      setInfo({ state: "open", account: "Instituição de teste" });
      return;
    }
    const isUuid = /^[0-9a-f-]{36}$/i.test(token);
    if (!isUuid) {
      setInfo({ state: "not_found" });
      return;
    }
    supabase.rpc("survey_status", { _token: token }).then(({ data, error }) => {
      if (error) return setInfo({ state: "error" });
      const s = data as unknown as Info;
      setInfo(s);
      if (s.state === "open") {
        try {
          const saved = JSON.parse(localStorage.getItem(idKey) ?? "null");
          if (saved?.first) verify(saved.first, saved.email ?? "", true);
        } catch {
          /* ignore */
        }
      }
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

  const save = (a: Answers, i: number) => {
    if (preview) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers: a, idx: i, started: startRef.current }));
    } catch {
      /* ignore */
    }
  };

  const update = (patch: Partial<Answers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
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
      ...answers,
      duration_seconds: Math.round((Date.now() - startRef.current) / 1000),
      user_agent: navigator.userAgent,
    };
    const { error } = await supabase.rpc("survey_submit_verified", {
      _token: token,
      _first: ident.first,
      _email: ident.email,
      _a: payload as never,
    });
    setSubmitting(false);
    if (error) {
      setErr("Não conseguimos enviar agora. Verifique a conexão e tente de novo.");
      return;
    }
    localStorage.removeItem(draftKey);
    setStage("done");
  };

  const name = info.name ? firstName(info.name) : "";

  if (info.state === "loading") return <Shell account={undefined}><p className="text-muted-foreground">Carregando…</p></Shell>;
  if (info.state === "not_found" || info.state === "error")
    return (
      <Shell>
        <h1 className="text-2xl">Link não encontrado</h1>
        <p className="mt-3 text-muted-foreground">Confira se o link está completo ou fale com o seu contato na Matria.</p>
      </Shell>
    );
  if (info.state === "closed")
    return (
      <Shell account={info.account}>
        <h1 className="text-2xl">Esta pesquisa foi encerrada</h1>
        <p className="mt-3 text-muted-foreground">Obrigado pelo interesse.</p>
      </Shell>
    );
  if (info.state === "answered" && !verified)
    return (
      <Shell account={info.account}>
        <h1 className="text-2xl leading-snug">Obrigado.</h1>
        <p className="mt-4 text-base leading-relaxed">Esta pesquisa já foi respondida. Você vai receber da Matria, por escrito, o que ouvimos e o que vamos fazer a respeito.</p>
      </Shell>
    );
  if (info.state === "answered" || stage === "done") return <ThankYou name={name} account={info.account} />;

  if (!verified)
    return (
      <Shell account={info.account}>
        {preview && <PreviewBadge />}
        <h1 className="text-2xl leading-snug">Pesquisa de relacionamento Matria</h1>
        <p className="mt-4 text-base leading-relaxed">Para começar, confirme o seu primeiro nome e o e-mail em que você recebe as comunicações da Matria.</p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            verify(ident.first.trim(), ident.email.trim());
          }}
        >
          <div>
            <label htmlFor="g-first" className="text-sm">Primeiro nome</label>
            <input
              id="g-first"
              required
              autoComplete="given-name"
              value={ident.first}
              onChange={(e) => setIdent({ ...ident, first: e.target.value })}
              className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-highlight"
            />
          </div>
          <div>
            <label htmlFor="g-email" className="text-sm">E-mail completo</label>
            <input
              id="g-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={ident.email}
              onChange={(e) => setIdent({ ...ident, email: e.target.value })}
              className="mt-2 h-12 w-full rounded-md border border-input bg-background px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-highlight"
            />
          </div>
          {gateErr && <p className="rounded-md bg-negative-bg p-3 text-sm text-foreground">{gateErr}</p>}
          <PrimaryButton type="submit" disabled={checking}>
            {checking ? "Conferindo…" : "Acessar a pesquisa"}
          </PrimaryButton>
        </form>
      </Shell>
    );

  if (stage === "intro")
    return (
      <Shell account={info.account}>
        {preview && <PreviewBadge />}
        <h1 className="text-2xl leading-snug">Olá, {name}.</h1>
        <p className="mt-4 text-base leading-relaxed">
          Esta pesquisa é sobre a experiência de {info.account} com a Matria como parceira, desde o início da nossa relação. Leva uns 3 minutos. Se alguma pergunta falar de uma etapa que a sua organização ainda não viveu conosco, marque a opção 'Ainda não chegamos nesta etapa'.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">A sua resposta é identificada e lida pela liderança da Matria.</p>
        <PrimaryButton
          className="mt-8"
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

  const step = STEPS[idx];
  const ok = isStepAnswered(step, answers);
  const last = idx === STEPS.length - 1;

  return (
    <Shell account={info.account} footer={false}>
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
            {idx + 1} de {STEPS.length}
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-offwhite" aria-hidden>
          <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="text-xl leading-snug">{step.text}</h2>

      <div className="mt-8">
        {step.kind === "nps" && <NpsScale value={answers.q1_nps} onChange={(v) => update({ q1_nps: v })} />}
        {step.kind === "likert" && <Likert value={answers[step.key]} onChange={(v) => update({ [step.key]: v })} />}
        {step.kind === "likert_nr" && (
          <>
            <Likert value={answers[step.key] ?? undefined} onChange={(v) => update({ [step.key]: v, [step.nrKey]: false })} />
            <button
              type="button"
              onClick={() => update({ [step.key]: null, [step.nrKey]: true })}
              aria-pressed={answers[step.nrKey] === true}
              className={cn(
                "mt-6 w-full rounded-md border border-dashed px-4 py-4 text-left text-base",
                answers[step.nrKey] ? "border-primary bg-highlight text-primary" : "border-border bg-subtle",
              )}
            >
              Ainda não chegamos nesta etapa
            </button>
          </>
        )}
        {step.kind === "text" && (
          <>
            <textarea
              value={answers[step.key] ?? ""}
              onChange={(e) => update({ [step.key]: e.target.value })}
              rows={6}
              className="w-full rounded-md border border-input bg-background p-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-highlight"
              placeholder={step.required ? "Escreva aqui" : "Opcional"}
            />
            {step.required && step.min && (
              <p className="mt-2 text-sm text-muted-foreground">
                {Math.max(0, step.min - (answers[step.key] ?? "").trim().length) > 0
                  ? `Escreva pelo menos ${step.min} caracteres.`
                  : " "}
              </p>
            )}
          </>
        )}
      </div>

      {err && <p className="mt-6 rounded-md bg-negative-bg p-3 text-sm text-foreground">{err}</p>}

      <PrimaryButton className="mt-10" disabled={!ok || submitting} onClick={() => (last ? submit() : goto(idx + 1))}>
        {last ? (submitting ? "Enviando…" : "Enviar respostas") : "Continuar"}
      </PrimaryButton>
    </Shell>
  );
}

function Shell({ children, account, footer = true }: { children: React.ReactNode; account?: string; footer?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="bg-primary">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-2">
          <MatriaLogo variant="negativo" className="h-12" />
          {account && <span className="truncate text-sm text-primary-foreground">{account}</span>}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">{children}</main>
      {footer && (
        <footer className="py-8 text-center text-sm text-muted-foreground">Data for Better Care</footer>
      )}
    </div>
  );
}

function ThankYou({ name, account }: { name: string; account?: string }) {
  return (
    <Shell account={account}>
      <h1 className="text-2xl leading-snug">Obrigado, {name}.</h1>
      <p className="mt-4 text-base leading-relaxed">
        Você vai receber da Matria, por escrito, o que ouvimos e o que vamos fazer a respeito.
      </p>
    </Shell>
  );
}

function PrimaryButton({ className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        "flex min-h-14 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    />
  );
}

function NpsScale({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const nums = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  return (
    <div>
      <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="Nota de 0 a 10">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-12 items-center justify-center rounded-md border text-base",
              value === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-highlight",
            )}
          >
            {n}
          </button>
        ))}
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
