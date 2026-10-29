import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EmailBody,
  PASSWORD_RESET_PREVIEW,
  PASSWORD_RESET_SUBJECT,
} from "@/lib/email-templates/password-reset";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({ meta: [{ title: "E-mails | Matria NPS" }, { name: "robots", content: "noindex" }] }),
  component: EmailsPage,
});

const SAMPLE_URL = "https://matria-nps.lovable.app/reset-password";

function EmailsPage() {
  const [name, setName] = useState("Eduardo");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl" style={{ fontWeight: 600 }}>
          E-mails
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          O único e-mail que a plataforma envia sozinha é este, de redefinir senha. Convites e lembretes continuam
          saindo por vocês, pelo WhatsApp ou pelo próprio e-mail, com o link gerado em Ciclos e Envios.
        </p>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="space-y-1 border-b px-5 py-4 text-sm">
          <p>
            <span className="text-muted-foreground">De: </span>
            <span style={{ fontWeight: 600 }}>Matria NPS</span> <span className="text-muted-foreground">&lt;no-reply@qualina.com.br&gt;</span>
          </p>
          <p>
            <span className="text-muted-foreground">Assunto: </span>
            <span style={{ fontWeight: 600 }}>{PASSWORD_RESET_SUBJECT}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Aparece antes de abrir: </span>
            {PASSWORD_RESET_PREVIEW}
          </p>
        </div>

        <div className="bg-subtle px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-[560px] overflow-hidden rounded-md border bg-background">
            <EmailBody name={name || "Eduardo"} resetUrl={SAMPLE_URL} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-background p-5">
        <div className="w-56">
          <Label htmlFor="sample-name">Nome que aparece no e-mail</Label>
          <Input id="sample-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          Troque o nome para ver como fica com o nome de cada pessoa. Nada é enviado ao mexer aqui.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-5">
        <h2 className="text-base" style={{ fontWeight: 600 }}>
          Para este e-mail sair com este visual
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Falta conectar o domínio de envio deste projeto. O qualina.com.br já está verificado e pronto, e ao conectar
          o e-mail passa a sair dele, com o mesmo layout que você está vendo acima.
        </p>
      </div>
    </div>
  );
}
