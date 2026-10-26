import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const DEFAULT_META = { title: "Pesquisa Matria. 3 minutos", description: "Sua opinião sobre a parceria com a Matria.", duration: "Leva uns 3 minutos" };

/** Public link preview texts (editable in Configurações) plus the request origin for absolute og:image URLs. */
export const getSurveyMeta = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  const url = new URL(req.url);
  const sandboxHost = url.hostname === "localhost" ? req.headers.get("x-forwarded-host") : null;
  const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
  try {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data } = await sb.rpc("survey_preview_meta");
    const row = Array.isArray(data) ? data[0] : null;
    return { origin, title: row?.title || DEFAULT_META.title, description: row?.description || DEFAULT_META.description, duration: row?.duration || DEFAULT_META.duration };
  } catch {
    return { origin, ...DEFAULT_META };
  }
});
