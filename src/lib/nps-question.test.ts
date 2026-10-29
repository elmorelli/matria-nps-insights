import { describe, expect, it } from "vitest";
import { NPS_QUESTION, hasNps, npsRow, withNps } from "./nps-question";

const semNps = [
  { position: 1, key: "clareza", kind: "likert" as const, text: "A Matria comunica com clareza.", required: true, min_chars: null, block: "Relacionamento", block_note: null },
];
const comNps = [
  { position: 1, key: "nps", kind: "nps" as const, text: NPS_QUESTION.text, required: true, min_chars: null, block: "Sua nota", block_note: "Obrigatório" },
  semNps[0],
];

describe("pergunta de NPS no questionário novo", () => {
  it("entra em primeiro quando a lista não tem NPS", () => {
    const src = withNps(semNps, "q1");
    expect(src.map((q) => q.key)).toEqual(["nps", "clareza"]);
    expect(src[0]).toMatchObject({ questionnaire_id: "q1", position: 1, kind: "nps", required: true, block: "Sua nota" });
    expect(src[1].position).toBe(2);
  });

  it("não é duplicada quando já existe", () => {
    const src = withNps(comNps, "q1");
    expect(src.filter((q) => q.key === "nps")).toHaveLength(1);
    expect(src.map((q) => q.key)).toEqual(["nps", "clareza"]);
  });

  it("aparece mesmo quando não há nenhuma pergunta no banco", () => {
    const src = withNps([], "q1");
    expect(src).toHaveLength(1);
    expect(src[0]).toMatchObject({ key: "nps", kind: "nps", position: 1, text: NPS_QUESTION.text });
  });

  it("usa o texto fixo da pergunta de NPS", () => {
    expect(npsRow("q9", 1)).toMatchObject({
      questionnaire_id: "q9",
      key: "nps",
      kind: "nps",
      block: "Sua nota",
      text: "Em uma escala de 0 a 10, o quanto você recomendaria a Matria para um colega de outra instituição de saúde?",
    });
    expect(hasNps([{ key: "clareza" }])).toBe(false);
    expect(hasNps(comNps)).toBe(true);
  });
});
