import { describe, it, expect } from "vitest";
import { normalizePhone, validateRow, fillTemplate } from "./contacts";

const base = { institution: "Fleury", full_name: "Ana", phone: "", email: "a@b.com", job_title: "", role: "Sponsor", product: "", stage: "", notes: "" };

describe("contatos", () => {
  it("normaliza telefone brasileiro para +55", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("+5511987654321");
  });
  it("exige telefone ou e-mail", () => {
    expect(validateRow({ ...base, email: "" })).toContain("Informe telefone ou e-mail");
  });
  it("recusa papel fora da lista", () => {
    expect(validateRow({ ...base, role: "Diretor" })).toContain("Papel fora da lista");
  });
  it("preenche modelo de mensagem", () => {
    expect(fillTemplate("Olá, {nome} de {instituição}: {link}", { nome: "Ana", instituicao: "Fleury", link: "x" })).toBe("Olá, Ana de Fleury: x");
  });
});
