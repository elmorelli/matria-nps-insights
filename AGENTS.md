<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Matria NPS
- Public survey reads/writes only through security-definer RPCs (survey_status, survey_confirm, survey_decline, survey_submit_by_token); the token is the only credential and anon has no table grants. /r/teste is a client-only preview that saves nothing. Why: links are public, data must not be.
- Questions come from the cycle's questionnaire (questionnaires/questions tables); answers go to response_answers keyed by stable question key. responses.q1_nps/q2_reason stay as the fixed NPS anchor, legacy q3..q12 columns are still filled for compatibility. Every questionnaire always contains the 'nps' question (canonical copy in src/lib/nps-question.ts, inserted on creation and via the editor's repair button), and a DB trigger keeps it uneditable and undeletable on its own while still letting it go with its questionnaire. Why: questionnaire versions must stay comparable across cycles, and the NPS score is read from that question.
- Message templates and targets live on each cycle; the settings table is deprecated.
- Admin pages query tables directly from the browser; RLS allows only users with the admin role in user_roles.
- Follow-ups are created by a database trigger on response insert, so SLA rules live in SQL.
- tsconfig extra-strict flags (exactOptionalPropertyTypes etc.) are off to keep form/data code simple.
- Contact timeline lives in contact_events, written only by DB triggers on contacts/invitations/followups and by survey_confirm/survey_decline, so every step is timestamped server-side.
- Admin pages load one dataset via allDataQuery (src/lib/analytics.ts) and compute every metric client-side with shared helpers (cycleStats, targetFor, cycleReading). Mutations invalidate allDataKey. Why: one source of truth for results, overview, clients and PDF.
- PDF exports use browser print: /relatorio (16:9 slides, filters in search params) and print styles on the client card page. Why: charts render exactly as on screen.
- Questionnaire codes (Q-0001...) come from a DB sequence + trigger on insert and cannot be edited. Why: codes must be sequential and never reused.
- MOM stage was removed from the app; account_products/contact_products.mom_stage and accounts.city stay in the DB as deprecated columns. Why: dropping columns would break the live app.
- App emails use Lovable managed sending: React Email templates in src/lib/email-templates plus a server-only send helper, and the admin preview renders those same template components. Why: one source of truth for how an email looks, so what Eduardo reviews is what gets sent.
