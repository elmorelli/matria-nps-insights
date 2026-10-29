import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Text } from "@react-email/components";
import logoUrl from "@/assets/matria-logo-branco.svg.asset.json";

export const PASSWORD_RESET_SUBJECT = "Redefinição de senha";
export const PASSWORD_RESET_PREVIEW = "Use o link abaixo para criar uma nova senha.";

const BLUE = "#073b84";
const INK = "#021125";
const MUTED = "#776e67";
const BORDER = "#d6cbc1";
const FONT = '"DM Sans", Arial, Helvetica, sans-serif';

interface Props {
  name?: string;
  resetUrl?: string;
}

/** Email content, rendered on its own inside the panel preview. */
export function EmailBody({ name = "Eduardo", resetUrl = "https://matria-nps.lovable.app/reset-password" }: Props) {
  return (
    <Container style={{ maxWidth: "560px", width: "100%", backgroundColor: "#ffffff" }}>
      <div style={{ backgroundColor: BLUE, padding: "26px 32px" }}>
        <Img src={logoUrl.url} alt="Matria" height="26" style={{ height: "26px", width: "auto" }} />
      </div>
      <div style={{ padding: "32px" }}>
        <Heading style={{ margin: "0 0 14px", fontSize: "21px", fontWeight: 600, color: INK, fontFamily: FONT }}>
          Redefinição de senha
        </Heading>
        <Text style={{ margin: "0 0 12px", fontSize: "15px", lineHeight: "24px", color: INK, fontFamily: FONT }}>
          Olá, {name}.
        </Text>
        <Text style={{ margin: "0 0 24px", fontSize: "15px", lineHeight: "24px", color: INK, fontFamily: FONT }}>
          Recebemos um pedido para redefinir a senha do seu acesso ao painel NPS da Matria. Toque no botão abaixo e
          escolha uma nova senha.
        </Text>
        <Button
          href={resetUrl}
          style={{
            backgroundColor: BLUE,
            color: "#ffffff",
            fontFamily: FONT,
            fontSize: "15px",
            fontWeight: 600,
            lineHeight: "20px",
            padding: "12px 22px",
            borderRadius: "6px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Redefinir minha senha
        </Button>
        <Text style={{ margin: "26px 0 0", fontSize: "14px", lineHeight: "22px", color: MUTED, fontFamily: FONT }}>
          Este link vale por uma hora e só pode ser usado uma vez. Se você não pediu a troca, ignore este e-mail, sua
          senha atual continua valendo.
        </Text>
        <Text style={{ margin: "16px 0 0", fontSize: "13px", lineHeight: "20px", color: MUTED, fontFamily: FONT }}>
          Se o botão não abrir, copie o endereço abaixo e cole no navegador:
        </Text>
        <Text style={{ margin: "4px 0 0", fontSize: "13px", lineHeight: "20px", fontFamily: FONT }}>
          <Link href={resetUrl} style={{ color: BLUE, textDecoration: "underline" }}>
            {resetUrl}
          </Link>
        </Text>
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "18px 32px" }}>
        <Text style={{ margin: 0, fontSize: "13px", lineHeight: "20px", color: MUTED, fontFamily: FONT }}>
          Matria · Plataforma de coleta e acompanhamento de NPS
        </Text>
      </div>
    </Container>
  );
}

const EmailDocument = (props: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{PASSWORD_RESET_PREVIEW}</Preview>
    <Body style={{ backgroundColor: "#ffffff", margin: 0, padding: 0, fontFamily: FONT }}>
      <EmailBody {...props} />
    </Body>
  </Html>
);

export const template = {
  component: EmailDocument,
  subject: PASSWORD_RESET_SUBJECT,
  displayName: "Redefinição de senha",
  previewData: { name: "Eduardo" },
};
