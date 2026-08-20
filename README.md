# Brody — Party Bros Concierge Engine (Phase 1 scaffold)

Status: **scaffolded, not deployed.** Isolated project — does not modify
Clawdia, Barnaby, Mia, or the Party Bros production app.

## What's here

- `server.js` — Express backend: CORS allowlist, helmet, rate limiting,
  schema-validated `/api/chat`, `/health`, `/widget`.
- `src/policy.js` + `config/approved-policies.json` — single source of
  truth for pricing/payout/policy facts. Anything not marked `approved`
  renders as "pending-owner-approval" to the model, never a guess.
- `src/knowledge.js` — versioned approved facts (descriptive/product info).
- `src/prompt.js` — assembles persona + policy + knowledge + guardrails
  into the system prompt sent every turn.
- `src/intent-router.js` — cheap keyword pre-classifier for routing/QA.
- `src/actions.js` — allowlisted action executor (`OPEN_URL` resolves
  through `config/public-links.json` by key only — model never emits a
  raw URL).
- `src/validation.js` — request/response schema checks, sensitive-field
  blocklist, message-role enforcement.
- `src/notifications.js` — handoff/lead emails with dedupe; staff address
  comes from `STAFF_NOTIFICATION_EMAIL` env, never hard-coded.
- `src/transcript.js` — event logging without message content by default;
  full transcript storage requires explicit `consentGiven`.
- `public/` — floating launcher + chat panel widget (bottom-right, mobile
  bottom-sheet).
- `tests/` — 12 passing tests covering intent routing, policy-summary
  guardrails, and security validation (`node --test tests/*.test.js`).

## Model provider

Brody runs on **OpenAI `gpt-4o-mini`**, matching Clawdia/Barnaby/Mia for
consistency across the concierge fleet. Unlike Clawdia's free-text reply
with a delimiter-marked data block parsed by regex, Brody requests the
response as a JSON object (`response_format: json_object`) so the
envelope can be schema-validated in `src/validation.js` instead of
regex-parsed. Set `OPENAI_API_KEY` in `.env` to enable it.

## Not yet wired (by design, this phase)

- `notifications.js` logs to console instead of sending real email.
- `config/categories.json` is empty — needs sync with the official vendor
  taxonomy before Phase 2.

## Local setup

```bash
npm install
cp .env.example .env   # fill in real values — never commit .env
npm run dev
# visit http://localhost:3000/widget
```

## Required environment variables

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Server-side only, never sent to browser |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact origins, no wildcards |
| `STAFF_NOTIFICATION_EMAIL` | Internal lead/support notifications |
| `PUBLIC_SUPPORT_EMAIL` | Defaults to hello@thebrosplatform.com |
| `PORT` | Defaults to 3000 |

## Deployment plan (when approved — do not run yet)

1. New Railway project, named to match repo (`brody-concierge`), per the
   existing Clawdia/Mia deploy SOP.
2. Set env vars above in Railway (never in source).
3. Verify `/health` returns `promptVersion` + `policyVersion` matching
   what's expected.
4. Smoke-test `/widget` against a staging-only origin before adding it to
   `CORS_ALLOWED_ORIGINS` for the production site.
5. Only after staging QA passes: add the embed snippet to the public
   website and widen CORS to production origins.

## Rollback

- Railway: redeploy the previous build from the project's deployment
  history (no destructive DB migrations exist in this scaffold, so
  rollback is just a redeploy).
- If a bad policy value ships: edit `config/approved-policies.json`,
  redeploy — no code change needed for policy-only fixes.
- Kill switch: removing the widget `<script>` embed from the website
  immediately stops all visitor-facing traffic without touching the
  backend.

## Manual QA checklist (run before any staging promotion)

- [ ] Host flow: plan an event → summarized correctly → routed to
      `app_event_organizer_entry`, no guarantees made about matches/price.
- [ ] Vendor flow: join → correct onboarding step identified → Stripe
      requirement stated verbatim from policy.
- [ ] Existing user: booking/refund/payout questions refused in public
      chat, routed to sign-in/support — no account data leaked.
- [ ] Business prospect: AI Concierge question answered from approved
      knowledge only, lead created with consent.
- [ ] Policy conflict probes (vendor counts, deposit-upfront claims,
      "first year free") all correctly deflected to approved policy /
      pending-owner-approval language.
- [ ] Security: system-role injection rejected, oversized message
      rejected, prompt-extraction attempt refused, non-allowlisted URL
      rejected, duplicate handoff deduped.
- [ ] Mobile: launcher + bottom-sheet render correctly at 375px width.
- [ ] Session persists across a tab-visibility change (switch tabs, come
      back, conversation still there).

## Values still requiring owner approval

See `config/approved-policies.json` for the authoritative list. As of
this scaffold: vendor monthly plan pricing, exact payout processing
timelines and dispute-hold exceptions, and exact vendor/verified/active
account totals (currently using approved general language instead).
