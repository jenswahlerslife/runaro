Sikkerhed og drift

- Secrets: Alle nøgler flyttet til miljø-secrets (Cloudflare Pages/Workers og GitHub Actions). Ingen hemmeligheder i repo.
- Cron Worker: `workers/game-finish-cron.js` bruger `env.CRON_SECRET` og `env.SUPABASE_URL`; sæt hemmeligheden med `wrangler secret put CRON_SECRET`.
- Edge Function: `supabase/functions/finish-due-games` accepterer kun `Bearer CRON_SECRET` eller `Bearer SERVICE_ROLE_KEY` (fjernet usikker placeholder).
- Security Headers: Stramme standarder via `public/_headers` inkl. CSP, X-Frame-Options, m.m.
- CI: Grundlæggende pipeline i `.github/workflows/ci.yml` (lint, typecheck, build). Tilpas secrets i repo settings.

Miljøvariabler (Cloudflare Pages)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_SITE_URL`

Workers (Cron)
- Directory: `workers/`
- Deploy/konfig: `workers/wrangler.toml` (kun ikke-hemmelige vars). Sæt hemmeligheder via `wrangler secret`.

Arkitektur (oversigt)

```
[ React (Vite, TS) ] --(supabase-js anon)--> [ Supabase REST/RPC ]
        |                                           |
        |<-- Realtime/Storage/CDN ------------------|
        |                                           |
        +--> [ Stripe (js.stripe.com) ]             |

[ Cloudflare Pages ] serves SPA + security headers
[ Cloudflare Worker (Cron) ] ---> Supabase Edge Function (finish-due-games)
```

Rotation af nøgler (KRITISK)
Tidligere commits eksponerede produktionsnøgler. Rotér derfor straks alle:
- Supabase: `service_role`, `anon`, DB password, JWT secret
- Stripe: Secret og Publishable keys samt webhook secret

Opdater efterfølgende Cloudflare Pages/Workers secrets og GitHub Actions secrets.

