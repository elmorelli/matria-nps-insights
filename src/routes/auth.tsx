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
    <div className="flex min-h-screen items-center justify-center bg-subtle px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border bg-background p-8">
        <MatriaLogo className="-ml-3 h-16" />
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
          Entrar
        </Button>
      </form>
    </div>
  );
}
