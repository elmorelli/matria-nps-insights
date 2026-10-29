import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allDataKey, allDataQuery, type AllData } from "@/lib/analytics";
import { LIST_LABEL, optionsKey, optionsQuery, type ListKey, type OptionRow } from "@/lib/options";
import { Card } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { listAccess, addAccess, updateAccess, setAccessActive, removeAccess } from "@/lib/access.functions";
import { ACCESS_ROLES, ROLE_HINT, ROLE_LABEL, type AccessRole } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

const LISTS: ListKey[] = ["role", "product", "account_status", "account_tier", "account_type", "country", "iad", "kae", "block"];

/** How many records use a list value. Items in use can only be deactivated. */
function usage(d: AllData | undefined, list: ListKey, value: string) {
  if (!d) return 0;
  switch (list) {
    case "role":
      return d.contacts.filter((c) => c.papel === value).length;
    case "product":
      return d.contacts.filter((c) => c.contact_products.some((p) => p.product === value)).length + d.accountProducts.filter((p) => p.product === value).length;
    case "account_status":
      return d.accounts.filter((a) => a.status === value).length;
    case "account_tier":
      return d.accounts.filter((a) => a.tier === value).length;
    case "account_type":
      return d.accounts.filter((a) => a.segment === value).length;
    case "country":
      return d.accounts.filter((a) => a.country === value).length;
    case "iad":
      return d.accounts.filter((a) => a.iad === value).length;
    case "kae":
      return d.accounts.filter((a) => a.kae === value).length;
    case "block":
      return 0;
  }
}

async function renameEverywhere(list: ListKey, from: string, to: string) {
  if (list === "role") await supabase.from("contacts").update({ papel: to }).eq("papel", from);
  if (list === "product") {
    await supabase.from("contact_products").update({ product: to }).eq("product", from);
    await supabase.from("account_products").update({ product: to }).eq("product", from);
  }
  if (list === "account_status") await supabase.from("accounts").update({ status: to }).eq("status", from);
  if (list === "account_tier") await supabase.from("accounts").update({ tier: to }).eq("tier", from);
  if (list === "account_type") await supabase.from("accounts").update({ segment: to }).eq("segment", from);
  if (list === "iad") await supabase.from("accounts").update({ iad: to }).eq("iad", from);
  if (list === "kae") await supabase.from("accounts").update({ kae: to }).eq("kae", from);
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Listas de seleção, metas de programa, pesquisa e usuários.</p>
      </div>
      <ListsSection />

      <SurveySection />
      <AccessSection />
    </div>
  );
}

type AccessUser = Awaited<ReturnType<typeof listAccess>>[number];
const EMPTY_FORM = { name: "", jobTitle: "", email: "", password: "", role: "viewer" as AccessRole };

function AccessSection() {
  const qc = useQueryClient();
  const list = useServerFn(listAccess);
  const add = useServerFn(addAccess);
  const update = useServerFn(updateAccess);
  const setActive = useServerFn(setAccessActive);
  const remove = useServerFn(removeAccess);
  const { data: users = [] } = useQuery({ queryKey: ["access"], queryFn: () => list() });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["access"] });
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome.");
    if (!editing && form.password.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    setBusy(true);
    try {
      if (editing) {
        const orig = users?.find((u) => u.id === editing);
        if (orig && orig.email !== form.email.trim() && !confirm(`Atenção: você está ALTERANDO o usuário ${orig.name || orig.email}, não criando um novo. O e-mail dele vai mudar para ${form.email}. Para cadastrar outra pessoa, clique em Cancelar e use "Cadastrar usuário". Continuar mesmo assim?`)) {
          setBusy(false);
          return;
        }
        await update({ data: { id: editing, ...form } });
        toast.success("Usuário atualizado.");
      } else {
        await add({ data: form });
        toast.success("Usuário criado. Envie o e-mail e a senha para a pessoa.");
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
    setBusy(false);
  };
  const edit = (u: AccessUser) => {
    setEditing(u.id);
    setForm({ name: u.name, jobTitle: u.jobTitle, email: u.email, password: "", role: u.role });
  };
  const toggle = async (u: AccessUser) => {
    try {
      await setActive({ data: { id: u.id, active: !u.active } });
      toast.success(u.active ? "Usuário desativado." : "Usuário reativado.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar.");
    }
  };
  const del = async (u: AccessUser) => {
    if (!confirm(`Excluir o usuário ${u.name || u.email}? Esta ação não pode ser desfeita.`)) return;
    try {
      await remove({ data: { id: u.id } });
      toast.success("Usuário excluído.");
      if (editing === u.id) { setEditing(null); setForm(EMPTY_FORM); }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

  return (
    <Card title="Cadastro de usuários" caption="Cada pessoa cadastrada vira uma linha na lista. Clique na situação (Ativo ou Inativo) para alternar, ou use os botões Alterar, Desativar e Excluir na linha. O seu acesso não pode ser desativado nem excluído.">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="acc-nm" className="text-primary">Nome</Label>
          <Input id="acc-nm" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acc-jt" className="text-primary">Cargo</Label>
          <Input id="acc-jt" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acc-em" className="text-primary">E-mail</Label>
          <Input id="acc-em" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acc-pw" className="text-primary">{editing ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
          <Input id="acc-pw" type="text" autoComplete="off" value={form.password} onChange={(e) => set("password", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acc-tp" className="text-primary">Tipo</Label>
          <select id="acc-tp" value={form.role} onChange={(e) => set("role", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {ACCESS_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]} ({ROLE_HINT[r]})</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={save} disabled={busy || !form.email}>
            {editing ? <><Save className="h-4 w-4" /> Salvar alterações</> : <><Plus className="h-4 w-4" /> Cadastrar usuário</>}
          </Button>
          {editing && (
            <Button variant="outline" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>Cancelar</Button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-primary">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Cargo</th>
              <th className="px-4 py-3 font-semibold">E-mail</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Situação</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className={cn(!u.active && "text-muted-foreground")}>
                <td className="px-4 py-3">{u.name || "Sem nome"} {u.isMe && <span className="text-muted-foreground">(você)</span>}</td>
                <td className="px-4 py-3">{u.jobTitle || "Não informado"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3">
                  {u.isMe ? (
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", u.active ? "bg-green-light text-green-dark" : "bg-destructive text-destructive-foreground")}>
                      {u.active ? "Ativo" : "Inativo"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggle(u)}
                      title={u.active ? "Clique para tornar inativo" : "Clique para tornar ativo"}
                      className={cn("inline-flex cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-80", u.active ? "bg-green-light text-green-dark" : "bg-destructive text-destructive-foreground")}
                    >
                      {u.active ? "Ativo" : "Inativo"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => edit(u)}><Pencil className="h-4 w-4" /> Alterar</Button>
                    {!u.isMe && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => toggle(u)}>
                          <Power className="h-4 w-4" /> {u.active ? "Desativar" : "Reativar"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => del(u)}><Trash2 className="h-4 w-4" /> Excluir</Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ListsSection() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(optionsQuery);
  const { data: d } = useQuery(allDataQuery);
  const [tab, setTab] = useState<ListKey>("role");
  const [newVal, setNewVal] = useState("");
  const [newDdi, setNewDdi] = useState("");
  const items = rows.filter((r) => r.list === tab).sort((a, b) => a.position - b.position);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: optionsKey });
    qc.invalidateQueries({ queryKey: allDataKey });
  };

  const add = async () => {
    const v = newVal.trim();
    if (!v) return;
    if (items.some((i) => i.value.toLowerCase() === v.toLowerCase())) return toast.error("Este item já existe.");
    const extra = tab === "country" ? { label: v, ddi: newDdi.startsWith("+") ? newDdi : `+${newDdi.replace(/\D/g, "")}` } : {};
    const value = tab === "country" ? v.slice(0, 2).toUpperCase() : v;
    const { error } = await supabase.from("option_lists").insert({ list: tab, value, extra, position: (items.at(-1)?.position ?? 0) + 1 });
    if (error) return toast.error("Não foi possível adicionar.");
    setNewVal("");
    setNewDdi("");
    refresh();
  };

  const rename = async (it: OptionRow, v: string) => {
    v = v.trim();
    if (!v || v === (tab === "country" ? it.extra.label : it.value)) return;
    if (tab === "country") {
      await supabase.from("option_lists").update({ extra: { ...it.extra, label: v } }).eq("id", it.id);
    } else {
      const { error } = await supabase.from("option_lists").update({ value: v }).eq("id", it.id);
      if (error) return toast.error("Não foi possível renomear.");
      await renameEverywhere(tab, it.value, v);
    }
    toast.success("Item renomeado.");
    refresh();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const a = items[i];
    const b = items[i + dir];
    if (!a || !b) return;
    await Promise.all([supabase.from("option_lists").update({ position: b.position }).eq("id", a.id), supabase.from("option_lists").update({ position: a.position }).eq("id", b.id)]);
    refresh();
  };

  const toggle = async (it: OptionRow) => {
    await supabase.from("option_lists").update({ active: !it.active }).eq("id", it.id);
    refresh();
  };

  const remove = async (it: OptionRow) => {
    if (usage(d, tab, it.value) > 0) return toast.error("Este item está em uso. Desative em vez de excluir.");
    await supabase.from("option_lists").delete().eq("id", it.id);
    refresh();
  };

  return (
    <Card title="Listas de seleção" caption="Itens em uso não podem ser excluídos. Desativados saem das listas, mas continuam nos cadastros antigos.">
      <div className="flex flex-wrap gap-1 border-b pb-3">
        {LISTS.map((l) => (
          <button key={l} onClick={() => setTab(l)} className={cn("rounded-md px-3 py-1.5 text-sm", tab === l ? "bg-primary text-primary-foreground" : "text-primary hover:bg-highlight")}>
            {LIST_LABEL[l]}
          </button>
        ))}
      </div>
      <ul className="mt-3 divide-y rounded-lg border">
        {items.map((it, i) => {
          const used = usage(d, tab, it.value);
          return (
            <li key={it.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !it.active && "bg-subtle text-muted-foreground")}>
              <div className="flex flex-col">
                <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="text-primary disabled:opacity-30">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button aria-label="Descer" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="text-primary disabled:opacity-30">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              {tab === "country" && (
                <span className="w-24 text-sm">
                  {it.extra.flag} {it.extra.ddi}
                </span>
              )}
              <InlineText value={tab === "country" ? (it.extra.label ?? it.value) : it.value} onSave={(v) => rename(it, v)} />
              <span className="text-xs text-muted-foreground">{used ? `Em uso em ${used}` : "Sem uso"}</span>
              <button onClick={() => toggle(it)} className="rounded-md px-2 py-1 text-sm text-primary hover:bg-highlight">
                {it.active ? "Desativar" : "Reativar"}
              </button>
              <button onClick={() => remove(it)} disabled={used > 0} className="rounded-md px-2 py-1 text-sm text-negative hover:bg-negative-bg disabled:cursor-not-allowed disabled:opacity-30">
                Excluir
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder={tab === "country" ? "Nome do país" : "Novo item"} value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="max-w-xs" />
        {tab === "country" && (
          <>
            <Input placeholder="DDI, como +54" value={newDdi} onChange={(e) => setNewDdi(e.target.value)} className="w-32" />
          </>
        )}
        <Button variant="outline" onClick={add}>
          <Plus /> Adicionar
        </Button>
      </div>
    </Card>
  );
}

function InlineText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="min-w-40 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-primary hover:border-border focus:border-primary focus:outline-none"
    />
  );
}

const settingsKey = ["app-settings"] as const;
function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").order("id").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}


function SurveySection() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [f, setF] = useState({ preview_title: "", preview_description: "", duration_text: "" });
  useEffect(() => {
    if (data) setF({ preview_title: data.preview_title, preview_description: data.preview_description, duration_text: data.duration_text });
  }, [data]);
  const save = async () => {
    if (!data) return;
    if (!f.preview_title.trim() || !f.preview_description.trim() || !f.duration_text.trim()) return toast.error("Preencha os três campos.");
    const { error } = await supabase.from("settings").update(f).eq("id", data.id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Textos da pesquisa salvos.");
    qc.invalidateQueries({ queryKey: settingsKey });
  };
  return (
    <Card title="Pesquisa" caption="Textos da prévia do link no WhatsApp e no e-mail, e o tempo estimado mostrado na abertura.">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pt" className="text-primary">
              Título da prévia
            </Label>
            <Input id="pt" value={f.preview_title} onChange={(e) => setF({ ...f, preview_title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pd" className="text-primary">
              Descrição da prévia
            </Label>
            <Input id="pd" value={f.preview_description} onChange={(e) => setF({ ...f, preview_description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="du" className="text-primary">
              Tempo estimado
            </Label>
            <Input id="du" value={f.duration_text} onChange={(e) => setF({ ...f, duration_text: e.target.value })} />
          </div>
          <Button onClick={save}>Salvar textos</Button>
        </div>
        <div className="overflow-hidden rounded-lg border bg-subtle">
          <img src="/og-pesquisa.jpg" alt="Imagem da prévia do link" className="aspect-[1200/630] w-full object-cover" />
          <div className="p-3">
            <p className="text-sm font-medium text-primary">{f.preview_title}</p>
            <p className="text-sm text-muted-foreground">{f.preview_description}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

