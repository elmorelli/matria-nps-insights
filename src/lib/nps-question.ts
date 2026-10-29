// A pergunta de NPS é fixa: texto, bloco e tipo não mudam, e ela abre todo questionário.
// Fica aqui para que a criação de um questionário nunca dependa de existir uma cópia no banco.
export const NPS_KEY = "nps";

export type NewQuestion = {
  questionnaire_id: string;
  position: number;
  key: string;
  kind: "nps" | "likert" | "likert_nr" | "text";
  text: string;
  required: boolean;
  min_chars: number | null;
  block: string;
  block_note: string | null;
};

export const NPS_QUESTION = {
  key: NPS_KEY,
  kind: "nps" as const,
  text: "Em uma escala de 0 a 10, o quanto você recomendaria a Matria para um colega de outra instituição de saúde?",
  required: true,
  min_chars: null as number | null,
  block: "Sua nota",
  block_note: "Obrigatório",
};

export function hasNps<T extends { key: string }>(questions: T[]) {
  return questions.some((q) => q.key === NPS_KEY);
}

export function npsRow(questionnaire_id: string, position: number): NewQuestion {
  return { ...NPS_QUESTION, questionnaire_id, position };
}

// Garante que a lista de perguntas de um questionário novo comece pela pergunta de NPS.
export function withNps(rows: Omit<NewQuestion, "questionnaire_id">[], questionnaire_id: string): NewQuestion[] {
  const full = rows.map((r) => ({ ...r, questionnaire_id }));
  if (hasNps(full)) return full;
  return [npsRow(questionnaire_id, 1), ...full.map((r) => ({ ...r, position: r.position + 1 }))];
}
