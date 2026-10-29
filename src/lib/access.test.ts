import { describe, expect, it } from "vitest";
import { canOpen, topRole } from "./access";

describe("tipos de acesso", () => {
  it("Administrador abre tudo", () => {
    expect(canOpen("admin", "/admin/configuracoes")).toBe(true);
  });
  it("IA Deployment abre ciclos e visão geral, nada mais", () => {
    expect(canOpen("deployment", "/admin")).toBe(true);
    expect(canOpen("deployment", "/admin/ciclos/abc")).toBe(true);
    expect(canOpen("deployment", "/admin/clientes")).toBe(false);
    expect(canOpen("deployment", "/admin/configuracoes")).toBe(false);
  });
  it("Visão Geral abre só a visão geral", () => {
    expect(canOpen("viewer", "/admin")).toBe(true);
    expect(canOpen("viewer", "/admin/ciclos")).toBe(false);
  });
  it("o maior acesso vence", () => {
    expect(topRole(["viewer", "admin"])).toBe("admin");
    expect(topRole([])).toBe(null);
  });
});
