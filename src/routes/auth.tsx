import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import feixe from "@/assets/feixe-azul.webp.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Matria NPS" },
      { name: "description", content: "Acesso ao painel NPS da Matria." },
      { property: "og:title", content: "Entrar | Matria NPS" },
      { property: "og:description", content: "Acesso ao painel NPS da Matria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const forgot = async () => {
    setMsg(null);
    setInfo(null);
    if (!email) return setMsg("Digite seu e-mail no campo Usuário e clique de novo.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setMsg("Não foi possível enviar agora. Tente de novo em alguns minutos.");
    setInfo("Enviamos um link para o seu e-mail. Confira também a caixa de spam.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg("E-mail ou senha incorretos.");
    nav({ to: "/admin" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-primary bg-cover bg-center px-4" style={{ backgroundImage: `url(${feixe.url})` }}>
      <div className="flex w-full max-w-[400px] flex-col items-center py-12">
        <MatriaLogo variant="negativo" className="h-auto w-full" />
        <p className="mt-6 text-center text-[15px] text-primary-foreground">Plataforma de coleta e acompanhamento de NPS</p>
      <form onSubmit={submit} className="mt-6 w-full rounded-lg border bg-background p-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-primary">Usuário</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw" className="text-primary">Senha</Label>
            <Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        {msg && <p className="mt-4 text-sm text-negative">{msg}</p>}
        {info && <p className="mt-4 text-sm text-primary">{info}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          Entrar
        </Button>
        <button type="button" onClick={forgot} disabled={busy} className="mt-4 w-full text-sm text-primary underline">
          Esqueci minha senha
        </button>
      </form>
      </div>
    </div>
  );
}
