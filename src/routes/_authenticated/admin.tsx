import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const nav = useNavigate();
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id).eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  };

  const linkCls = "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted";
  const active = { className: "rounded-md px-3 py-2 text-sm bg-highlight text-primary" };

  return (
    <div className="min-h-screen bg-subtle">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-2">
          <MatriaLogo className="-ml-3 h-12" />
          <nav className="flex gap-1">
            <Link to="/admin" activeOptions={{ exact: true }} className={linkCls} activeProps={active}>
              Visão geral
            </Link>
            <Link to="/admin/contatos" className={linkCls} activeProps={active}>
              Contatos e links
            </Link>
            <Link to="/admin/pesquisas" className={linkCls} activeProps={active}>
              Pesquisas
            </Link>
            <Link to="/admin/respostas" className={linkCls} activeProps={active}>
              Respostas
            </Link>
            <Link to="/admin/configuracoes" className={linkCls} activeProps={active}>
              Mensagens
            </Link>
            <a href="/r/teste" target="_blank" rel="noopener" className={linkCls}>
              Ver pesquisa (teste)
            </a>
          </nav>
          <button onClick={signOut} className="ml-auto text-sm text-muted-foreground hover:text-foreground">
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {isLoading ? null : isAdmin ? (
          <Outlet />
        ) : (
          <div className="rounded-lg border bg-background p-8">
            <h1 className="text-xl">Acesso restrito</h1>
            <p className="mt-2 text-muted-foreground">Esta conta não tem permissão para ver o painel.</p>
          </div>
        )}
      </main>
    </div>
  );
}
