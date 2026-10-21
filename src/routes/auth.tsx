import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Matria NPS" },
      { name: "description", content: "Acesso ao painel NPS da Matria." },
      { property: "og:title", content: "Entrar | Matria NPS" },
      { property: "og:description", content: "Acesso ao painel NPS da Matria." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg("E-mail ou senha incorretos.");
      nav({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      setBusy(false);
      if (error) return setMsg(error.message);
      setMsg("Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre aqui.");
      setMode("in");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border bg-background p-8">
        <MatriaLogo className="-ml-3 h-14" />
        <h1 className="mt-4 text-xl">{mode === "in" ? "Entrar no painel NPS" : "Criar acesso"}</h1>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Senha</Label>
            <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        {msg && <p className="mt-4 text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
        <button type="button" className="mt-4 w-full text-sm text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
        </button>
      </form>
    </div>
  );
}
