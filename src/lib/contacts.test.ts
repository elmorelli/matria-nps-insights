import { describe, it, expect } from "vitest";
import { toIntlPhone, formatPhone, validateRow, fillTemplate, isValidEmail } from "./contacts";

const lists = { roles: ["Sponsor", "Champion"], products: ["Agendamento com IA", "Todos"] };
const base = { institution: "Fleury", full_name: "Ana", ddi: "+55", phone: "(11) 98765-4321", email: "a@b.com", job_title: "", role: "Sponsor", product: "" };

describe("contatos", () => {
  it("aceita celular e fixo do Brasil", () => {
    expect(toIntlPhone("+55", "(11) 98765-4321")).toBe("+5511987654321");
    expect(toIntlPhone("+55", "(11) 3456-7890")).toBe("+551134567890");
  });
  it("México exige 10 dígitos", () => {
    expect(toIntlPhone("+52", "55 1234 5678")).toBe("+525512345678");
    expect(toIntlPhone("+52", "551234567")).toBeNull();
  });
  it("recusa telefone brasileiro curto", () => {
    expect(toIntlPhone("+55", "98765-4321")).toBeNull();
  });
  it("mostra DDI e número formatado", () => {
    expect(formatPhone("+5511987654321")).toBe("+55 (11) 98765-4321");
  });
  it("e-mail precisa de @ e domínio com ponto", () => {
    expect(isValidEmail("ana@empresa")).toBe(false);
    expect(isValidEmail("ana@empresa.com")).toBe(true);
  });
  it("papel e produto comparados sem diferenciar maiúsculas", () => {
    expect(validateRow({ ...base, role: "sponsor", product: "agendamento com ia" }, lists)).toEqual([]);
    expect(validateRow({ ...base, role: "Diretor" }, lists)).toContain("Papel fora da lista");
  });
  it("preenche modelo de mensagem", () => {
    expect(fillTemplate("Olá, {nome} de {instituição}: {link}", { nome: "Ana", instituicao: "Fleury", link: "x" })).toBe("Olá, Ana de Fleury: x");
  });
});
