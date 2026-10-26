import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { allDataKey, allDataQuery, type AllData } from "@/lib/analytics";
import { LIST_LABEL, optionsKey, optionsQuery, type ListKey, type OptionRow } from "@/lib/options";
import { Card } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

const LISTS: ListKey[] = ["role", "product", "account_status", "account_tier", "account_type", "country"];

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
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Listas de seleção, mensagens padrão, pesquisa e conta.</p>
      </div>
      <ListsSection />
      <TemplatesSection />
      <SurveySection />
      <AccountSection />
    </div>
  );
}

function ListsSection() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(optionsQuery);
  const { data: d } = useQuery(allDataQuery);
  const [tab, setTab] = useState<ListKey>("role");
  const [newVal, setNewVal] = useState("");
  const [newDdi, setNewDdi] = useState("");
  const [newFlag, setNewFlag] = useState("");
  const items = rows.filter((r) => r.list === tab).sort((a, b) => a.position - b.position);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: optionsKey });
    qc.invalidateQueries({ queryKey: allDataKey });
  };

  const add = async () => {
    const v = newVal.trim();
    if (!v) return;
    if (items.some((i) => i.value.toLowerCase() === v.toLowerCase())) return toast.error("Este item já existe.");
    const extra = tab === "country" ? { label: v, ddi: newDdi.startsWith("+") ? newDdi : `+${newDdi.replace(/\D/g, "")}`, flag: newFlag } : {};
    const value = tab === "country" ? v.slice(0, 2).toUpperCase() : v;
    const { error } = await supabase.from("option_lists").insert({ list: tab, value, extra, position: (items.at(-1)?.position ?? 0) + 1 });
    if (error) return toast.error("Não foi possível adicionar.");
    setNewVal("");
    setNewDdi("");
    setNewFlag("");
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
            <Input placeholder="Bandeira" value={newFlag} onChange={(e) => setNewFlag(e.target.value)} className="w-24" />
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

function TemplatesSection() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [f, setF] = useState({ template_initial: "", template_reminder_1: "", template_reminder_2: "", template_reminder_3: "" });
  useEffect(() => {
    if (data) setF({ template_initial: data.template_initial, template_reminder_1: data.template_reminder_1, template_reminder_2: data.template_reminder_2, template_reminder_3: data.template_reminder_3 });
  }, [data]);
  const save = async () => {
    if (!data) return;
    const { error } = await supabase.from("settings").update(f).eq("id", data.id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success("Modelos salvos. Valem para os próximos ciclos.");
    qc.invalidateQueries({ queryKey: settingsKey });
  };
  const labels: [keyof typeof f, string][] = [
    ["template_initial", "Primeiro envio"],
    ["template_reminder_1", "Lembrete 1"],
    ["template_reminder_2", "Lembrete 2"],
    ["template_reminder_3", "Lembrete 3"],
  ];
  return (
    <Card title="Modelos padrão de mensagem" caption="Usados para preencher cada novo ciclo. Mudar aqui não altera ciclos que já existem. Use {nome}, {instituição} e {link}.">
      <div className="grid gap-4 lg:grid-cols-2">
        {labels.map(([k, l]) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={k} className="text-primary">
              {l}
            </Label>
            <Textarea id={k} rows={5} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={save}>
        Salvar modelos
      </Button>
    </Card>
  );
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

function AccountSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setName((data.user?.user_metadata?.full_name as string) ?? "");
    });
  }, []);
  const saveName = async () => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    if (error) return toast.error("Não foi possível salvar o nome.");
    toast.success("Nome salvo.");
  };
  const savePw = async () => {
    if (pw.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return toast.error("As duas senhas não são iguais.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error("Não foi possível alterar a senha.");
    setPw("");
    setPw2("");
    toast.success("Senha alterada.");
  };
  return (
    <Card title="Conta">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nm" className="text-primary">
              Nome
            </Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-primary">E-mail</Label>
            <p className="py-1">{email}</p>
          </div>
          <Button variant="outline" onClick={saveName}>
            Salvar nome
          </Button>
        </div>
        <div className="space-y-4">
          <h3 className="text-base">Alterar senha</h3>
          <div className="space-y-2">
            <Label htmlFor="np" className="text-primary">
              Nova senha
            </Label>
            <Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np2" className="text-primary">
              Repita a nova senha
            </Label>
            <Input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button onClick={savePw}>Alterar senha</Button>
        </div>
      </div>
    </Card>
  );
}
