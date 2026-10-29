import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ACCESS_ROLES, type AccessRole } from "@/lib/access";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Sem permissão.");
}

const roleSchema = z.enum(ACCESS_ROLES);

async function setRole(admin: any, userId: string, role: AccessRole) {
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error("Não foi possível salvar o tipo de acesso.");
}

export const listAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleOf = new Map<string, AccessRole>();
    for (const r of roles ?? []) {
      const cur = roleOf.get(r.user_id);
      if (!cur || r.role === "admin") roleOf.set(r.user_id, r.role as AccessRole);
    }
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    return (data?.users ?? [])
      .filter((u) => roleOf.has(u.id))
      .map((u) => {
        const banned = (u as any).banned_until ? new Date((u as any).banned_until) > new Date() : false;
        return {
          id: u.id,
          email: u.email ?? "",
          name: (u.user_metadata?.full_name as string) ?? "",
          jobTitle: (u.user_metadata?.job_title as string) ?? "",
          role: roleOf.get(u.id)!,
          active: !banned,
          lastSignIn: u.last_sign_in_at ?? null,
          isMe: u.id === context.userId,
        };
      });
  });

export const addAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        email: z.string().trim().email(),
        name: z.string().trim().min(1).max(120),
        jobTitle: z.string().trim().max(120),
        password: z.string().min(8).max(72),
        role: roleSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, job_title: data.jobTitle },
    });
    if (error || !created.user) {
      throw new Error(error?.message?.includes("already") ? "Este e-mail já tem cadastro." : "Não foi possível criar o usuário.");
    }
    await setRole(supabaseAdmin, created.user.id, data.role);
    return { ok: true };
  });

export const updateAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().trim().email(),
        name: z.string().trim().min(1).max(120),
        jobTitle: z.string().trim().max(120),
        password: z.string().max(72),
        role: roleSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.password && data.password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.name, job_title: data.jobTitle },
      ...(data.password ? { password: data.password } : {}),
    });
    if (error) throw new Error(error.message?.includes("already") ? "Este e-mail já tem cadastro." : "Não foi possível salvar.");
    await setRole(supabaseAdmin, data.id, data.role);
    return { ok: true };
  });

export const setAccessActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.active ? "none" : "876000h" });
    if (error) throw new Error("Não foi possível alterar.");
    return { ok: true };
  });

export const removeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Não foi possível excluir.");
    return { ok: true };
  });
