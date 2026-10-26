import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, ClipboardList, LogOut, Menu, Building2, Users, X, FileText, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MatriaLogo } from "@/components/MatriaLogo";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Visão geral", icon: BarChart3, exact: true },
  { to: "/admin/ciclos", label: "Ciclos", icon: ClipboardList },
  { to: "/admin/clientes", label: "Clientes", icon: Building2 },
  { to: "/admin/contatos", label: "Contatos", icon: Users },
  { to: "/admin/questionarios", label: "Questionários", icon: FileText },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings2 },
] as const;

function AdminLayout() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
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

  const item = "flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2.5 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground";

  const sidebar = (
    <div className="flex h-full flex-col bg-primary px-4 py-6">
      <div className="flex items-center justify-between px-2">
        <MatriaLogo variant="negativo" className="h-14" />
        <button className="text-primary-foreground lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: "exact" in n }}
            className={item}
            activeProps={{ className: cn(item, "border-primary-foreground bg-primary-foreground/10 text-primary-foreground") }}
            onClick={() => setOpen(false)}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        ))}
      </nav>
      <button onClick={signOut} className={item}>
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-subtle lg:pl-64 print:bg-background print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-primary px-4 py-3 lg:hidden print:hidden">
        <button className="text-primary-foreground" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
        <MatriaLogo variant="negativo" className="h-8" />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {isLoading ? null : isAdmin ? (
          <TooltipProvider>
            <Outlet />
          </TooltipProvider>
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
