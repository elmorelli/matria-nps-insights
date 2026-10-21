export type Answers = {
  q1_nps?: number;
  q2_reason?: string;
  q3?: number; q4?: number; q5?: number; q6?: number; q7?: number; q8?: number;
  q9?: number | null; q9_not_reached?: boolean;
  q10?: number | null; q10_not_reached?: boolean;
  q11_start?: string;
  q12_keep?: string;
};

export type Step =
  | { kind: "nps"; key: "q1_nps"; text: string }
  | { kind: "text"; key: "q2_reason" | "q11_start" | "q12_keep"; text: string; required: boolean; min?: number }
  | { kind: "likert"; key: "q3" | "q4" | "q5" | "q6" | "q7" | "q8"; text: string }
  | { kind: "likert_nr"; key: "q9" | "q10"; nrKey: "q9_not_reached" | "q10_not_reached"; text: string };

export const STEPS: Step[] = [
  { kind: "nps", key: "q1_nps", text: "Em uma escala de 0 a 10, o quanto você recomendaria a Matria para um colega de outra instituição de saúde?" },
  { kind: "text", key: "q2_reason", text: "O que mais pesou na sua nota?", required: true, min: 10 },
  { kind: "likert", key: "q3", text: "A Matria comunica com clareza o que vai acontecer, quando e quem é responsável." },
  { kind: "likert", key: "q4", text: "Tenho confiança de que a Matria vai entregar o que foi combinado." },
  { kind: "likert", key: "q5", text: "Quando preciso de algo, o time da Matria responde com agilidade." },
  { kind: "likert", key: "q6", text: "Quando preciso de algo, o time da Matria resolve com qualidade." },
  { kind: "likert", key: "q7", text: "O time da Matria entende a realidade da minha instituição." },
  { kind: "likert", key: "q8", text: "É fácil tratar assuntos com a Matria (contatos certos, sem retrabalho)." },
  { kind: "likert_nr", key: "q9", nrKey: "q9_not_reached", text: "A solução da Matria funciona de forma estável no meu dia a dia." },
  { kind: "likert_nr", key: "q10", nrKey: "q10_not_reached", text: "A solução da Matria já está gerando os resultados que esperávamos ao contratar." },
  { kind: "text", key: "q11_start", text: "O que a Matria deveria começar a fazer ou fazer diferente?", required: false },
  { kind: "text", key: "q12_keep", text: "O que a Matria faz hoje que você não gostaria que mudasse?", required: false },
];

export const LIKERT_LABELS = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];

export function isStepAnswered(step: Step, a: Answers): boolean {
  switch (step.kind) {
    case "nps":
      return typeof a.q1_nps === "number";
    case "text":
      if (!step.required) return true;
      return (a[step.key] ?? "").trim().length >= (step.min ?? 1);
    case "likert":
      return typeof a[step.key] === "number";
    case "likert_nr":
      return typeof a[step.key] === "number" || a[step.nrKey] === true;
  }
}

export const BLOCKS = [
  { title: "Sua nota", from: 0, to: 1, note: "Obrigatório" },
  { title: "Relacionamento", from: 2, to: 7, note: "Escala de 1 a 5" },
  { title: "Solução", from: 8, to: 9, note: "Escala de 1 a 5 ou 'Ainda não chegamos nesta etapa'" },
  { title: "Para fechar", from: 10, to: 11, note: "Opcional" },
] as const;

export function blockOf(idx: number) {
  const i = BLOCKS.findIndex((b) => idx >= b.from && idx <= b.to);
  return { ...BLOCKS[i], index: i };
}
