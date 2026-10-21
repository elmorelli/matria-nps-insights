import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" });
  },
  head: () => ({
    meta: [
      { title: "Matria NPS" },
      { name: "description", content: "Pesquisa de relacionamento e painel NPS da Matria." },
      { property: "og:title", content: "Matria NPS" },
      { property: "og:description", content: "Pesquisa de relacionamento e painel NPS da Matria." },
    ],
  }),
});
