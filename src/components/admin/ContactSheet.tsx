import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allDataKey, type AllData, type Contact } from "@/lib/analytics";
import { useOptions } from "@/lib/options";
import { formatNational, isValidEmail, splitPhone, toIntlPhone, DDI_RULES } from "@/lib/contacts";
import { cn } from "@/lib/utils";

type Form = { full_name: string; ddi: string; phone: string; email: string; job_title: string; account_id: string; papel: string; products: string[] };

/** Right-side panel for creating or editing a contact. `contact` undefined = closed, null = new. */
export function ContactSheet({ d, contact, defaultAccount, onClose }: { d: AllData; contact: Contact | null | undefined; defaultAccount?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const opts = useOptions();
  const [f, setF] = useState<Form>(blank(defaultAccount));
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (contact === undefined) return;
    setErrs({});
    if (contact === null) return setF(blank(defaultAccount));
    const p = splitPhone(contact.phone);
    setF({
      full_name: contact.full_name,
      ddi: p.ddi,
      phone: formatNational(p.ddi, p.national),
      email: contact.email ?? "",
      job_title: contact.job_title ?? "",
      account_id: contact.account_id,
      papel: contact.papel ?? "",
      products: contact.contact_products.map((x) => x.product),
    });
  }, [contact, defaultAccount]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errs = {};
    if (!f.full_name.trim()) e.full_name = "Informe o nome completo.";
    if (!toIntlPhone(f.ddi, f.phone)) e.phone = `Use o formato ${DDI_RULES[f.ddi]?.example ?? "do país"}.`;
    if (!isValidEmail(f.email)) e.email = "Use um e-mail com @ e domínio, como nome@empresa.com.";
    if (!f.account_id) e.account_id = "Escolha a instituição.";
    if (!f.papel) e.papel = "Escolha o papel.";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = {
        full_name: f.full_name.trim(),
        phone: toIntlPhone(f.ddi, f.phone),
        email: f.email.trim().toLowerCase(),
        job_title: f.job_title.trim() || null,
        account_id: f.account_id,
        papel: f.papel,
      };
      let id = contact?.id;
      if (id) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("contacts").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const current = contact?.contact_products ?? [];
      const toRemove = current.filter((p) => !f.products.includes(p.product)).map((p) => p.id);
      const toAdd = f.products.filter((p) => !current.some((c) => c.product === p));
      if (toRemove.length) await supabase.from("contact_products").delete().in("id", toRemove);
      if (toAdd.length) await supabase.from("contact_products").insert(toAdd.map((product) => ({ contact_id: id!, product })));
      if (f.products.length)
        await supabase.from("account_products").upsert(f.products.map((product) => ({ account_id: f.account_id, product })), { onConflict: "account_id,product", ignoreDuplicates: true });
      toast.success("Contato salvo.");
      qc.invalidateQueries({ queryKey: allDataKey });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível salvar o contato.");
    } finally {
      setBusy(false);
    }
  };

  const roleOpts = withCurrent(opts.values("role"), f.papel);
  const prodOpts = [...new Set([...opts.values("product"), ...f.products])];
  const countries = opts.countries.length ? opts.countries : [{ value: "BR", extra: { ddi: "+55", flag: "🇧🇷" } }];

  return (
    <Sheet open={contact !== undefined} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto bg-subtle p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b bg-background px-6 py-5">
          <SheetTitle className="text-xl font-light text-primary">{contact ? "Editar contato" : "Novo contato"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-8 px-6 py-6">
          <section className="space-y-4">
            <h2 className="text-base">Pessoa</h2>
            <Field label="Nome completo" id="cs-name" error={errs.full_name}>
              <Input id="cs-name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} className="bg-background" />
            </Field>
            <Field label="Telefone" id="cs-phone" error={errs.phone}>
              <div className="flex gap-2">
                <select
                  aria-label="Código do país"
                  value={f.ddi}
                  onChange={(e) => {
                    set("ddi", e.target.value);
                    set("phone", formatNational(e.target.value, f.phone));
                  }}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                >
                  {countries.map((c) => (
                    <option key={c.value} value={c.extra.ddi}>
                      {c.extra.flag} {c.extra.ddi}
                    </option>
                  ))}
                </select>
                <Input id="cs-phone" inputMode="tel" placeholder={DDI_RULES[f.ddi]?.example} value={f.phone} onChange={(e) => set("phone", formatNational(f.ddi, e.target.value))} className="flex-1 bg-background" />
              </div>
            </Field>
            <Field label="E-mail" id="cs-email" error={errs.email}>
              <Input id="cs-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className="bg-background" />
            </Field>
            <Field label="Cargo" id="cs-job">
              <Input id="cs-job" value={f.job_title} onChange={(e) => set("job_title", e.target.value)} className="bg-background" />
            </Field>
          </section>
          <section className="space-y-4">
            <h2 className="text-base">Na instituição</h2>
            <Field label="Instituição" id="cs-acc" error={errs.account_id}>
              <select id="cs-acc" value={f.account_id} onChange={(e) => set("account_id", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Escolha</option>
                {d.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Papel" id="cs-role" error={errs.papel}>
              <select id="cs-role" value={f.papel} onChange={(e) => set("papel", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Escolha</option>
                {roleOpts.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <div className="space-y-2">
              <Label className="text-primary">Produtos</Label>
              <div className="flex flex-wrap gap-2">
                {prodOpts.map((p) => {
                  const on = f.products.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("products", on ? f.products.filter((x) => x !== p) : [...f.products, p])}
                      className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-primary hover:bg-highlight")}
                    >
                      {p}
                    </button>
                  );
                })}
                {!prodOpts.length && <p className="text-sm text-muted-foreground">Cadastre produtos em Configurações.</p>}
              </div>
            </div>
          </section>
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t bg-background px-6 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar contato"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function blank(account?: string): Form {
  return { full_name: "", ddi: "+55", phone: "", email: "", job_title: "", account_id: account ?? "", papel: "", products: [] };
}

function withCurrent(list: string[], cur: string) {
  return cur && !list.includes(cur) ? [...list, cur] : list;
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-primary">
        {label}
      </Label>
      {children}
      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}
