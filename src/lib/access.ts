export const ACCESS_ROLES = ["admin", "deployment", "viewer"] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export const ROLE_LABEL: Record<AccessRole, string> = {
  admin: "Administrador",
  deployment: "IA Deployment",
  viewer: "Visão Geral",
};

export const ROLE_HINT: Record<AccessRole, string> = {
  admin: "Acesso total",
  deployment: "Ciclos (envios e atualizações) e visão geral",
  viewer: "Apenas visão geral",
};

/** Which panel pages each access type can open. */
export function canOpen(role: AccessRole, path: string): boolean {
  if (role === "admin") return true;
  const p = path.replace(/\/+$/, "") || "/admin";
  if (p === "/admin") return true;
  if (role === "deployment") return p === "/admin/ciclos" || p.startsWith("/admin/ciclos/");
  return false;
}

/** Highest access among a user's roles. */
export function topRole(roles: string[]): AccessRole | null {
  for (const r of ACCESS_ROLES) if (roles.includes(r)) return r;
  return null;
}

/**
 * Which rows of the user list can be altered, deactivated or deleted.
 * No access type is exempt and the person's own row is not special:
 * an administrator can manage every registered user.
 */
export function canManageUser(user: { role: AccessRole; isMe: boolean }): boolean {
  return ACCESS_ROLES.includes(user.role);
}

