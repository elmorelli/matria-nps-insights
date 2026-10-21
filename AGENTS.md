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
- Public survey reads/writes only through security-definer RPCs (survey_status, survey_verify, survey_submit_verified) keyed by token plus first name + email check; anon has no table grants. /r/teste is a client-only preview that saves nothing. Why: links are public, data must not be.
- Admin pages query tables directly from the browser; RLS allows only users with the admin role in user_roles.
- Follow-ups are created by a database trigger on response insert, so SLA rules live in SQL.
- tsconfig extra-strict flags (exactOptionalPropertyTypes etc.) are off to keep form/data code simple.
- Contact timeline lives in contact_events, written only by DB triggers on contacts/invitations/followups and by survey_verify, so every step is timestamped server-side.
