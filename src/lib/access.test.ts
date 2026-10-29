import { describe, expect, it } from "vitest";
import { ACCESS_ROLES, ROLE_LABEL, canManageUser, canOpen, topRole } from "./access";

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

describe("gestão de usuários na lista", () => {
  for (const role of ACCESS_ROLES) {
    it(`${ROLE_LABEL[role]} pode ser alterado, desativado ou excluído`, () => {
      expect(canManageUser({ role, isMe: false })).toBe(true);
      expect(canManageUser({ role, isMe: true })).toBe(true);
    });
  }
});

