import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import feixe from "@/assets/feixe-azul.webp.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha | Matria NPS" },
      { name: "description", content: "Defina uma nova senha para o painel NPS da Matria." },
      { property: "og:title", content: "Nova senha | Matria NPS" },
      { property: "og:description", content: "Defina uma nova senha para o painel NPS da Matria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => d.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg("A senha precisa ter pelo menos 8 caracteres.");
    if (pw !== pw2) return setMsg("As duas senhas não são iguais.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg("Não foi possível salvar. Peça um novo link e tente de novo.");
    nav({ to: "/admin" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-primary bg-cover bg-center px-4" style={{ backgroundImage: `url(${feixe.url})` }}>
      <div className="absolute left-8 top-8">
        <MatriaLogo variant="negativo" className="h-14" />
      </div>
      <form onSubmit={submit} className="w-full max-w-[400px] rounded-lg border bg-background p-8">
        <h1 className="mb-4 text-xl text-primary">Criar nova senha</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Abra esta página pelo link enviado ao seu e-mail.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw" className="text-primary">Nova senha</Label>
              <Input id="pw" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2" className="text-primary">Repita a nova senha</Label>
              <Input id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {msg && <p className="text-sm text-negative">{msg}</p>}
            <Button type="submit" className="w-full" disabled={busy}>Salvar nova senha</Button>
          </div>
        )}
      </form>
    </div>
  );
}
