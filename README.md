<p align="center">
  <img src="public/brand/orbix-declare-logo.png" alt="Orbix Declare" height="72">
</p>

<h1 align="center">Orbix Declare — Front-end</h1>

<p align="center">
  <b>Your crypto taxes, calculated in Brazilian reais.</b><br>
  An AI agent reads your Solana and Hyperliquid wallets, converts every event at the PTAX rate
  and prepares the monthly DeCripto filing for Brazil's Federal Revenue (Receita Federal).
</p>

<p align="center">
  Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Solana Wallet Adapter<br>
  Built by <b>Orbix Lab</b> for the <b>Crypto World's Fair Hackathon</b> (Colosseum, 2026)<br>
  Back-end: <a href="https://github.com/ERIKFABIANO/orbix-core"><b>orbix-core</b></a>
</p>

---

## Colosseum submission

**What it does.** Orbix Declare turns on-chain activity into a Brazilian tax filing. Sign in with a Solana wallet,
add your Solana and Hyperliquid addresses (public addresses only, never a key), and the app shows each month in R$:
disposals, capital gain, estimated tax and the R$ 35,000 monthly exemption. It exports the review package and
records the report's SHA-256 hash on Solana, so anyone can verify the report at a public link.

```
Front-end (this repo, Next.js)
        │  HTTPS · /api/*
        ▼
API (orbix-core: ingestion, PTAX, tax engine, AI agent)
        ├──► Solana       (wallet history · report hash via Memo)
        └──► Hyperliquid  (perps, funding, fills)
```

- **Back-end repository:** [ERIKFABIANO/orbix-core](https://github.com/ERIKFABIANO/orbix-core)
- **Submitted commit (October 12, 2026 deadline):** [`2170dab`](https://github.com/DPViega/orbix-declare/commit/2170dab5376bac468cb0b6a47f679bcb3036ef20), tagged [`colosseum-submission`](https://github.com/DPViega/orbix-declare/tree/colosseum-submission)

### What changed after October 12

- **Official DeCripto file:** generated in the Receita Federal layout (Section 6, record 0210). This is the most important addition, because it closes the last manual step of the process.
- **Calculation certificate:** a printable summary of the month.
- **New dashboard:** monthly chart and real token icons.
- **Pricing page:** Free, Pro and Accountant plans.
- **Privacy page, error handling and the first front-end tests.**

---

This repository contains **only the front-end**. All processing (on-chain reads, prices, tax engine, AI agent,
Solana hash records, files) happens in the back-end, [**orbix-core**](https://github.com/ERIKFABIANO/orbix-core).
The front-end talks to it through the HTTP API documented in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

Without a back-end, the app runs in **demo mode** with sample data, and every screen can be explored.

## Contents

- [Run in 2 minutes](#run-in-2-minutes)
- [Environment variables](#environment-variables)
- [Screens and routes](#screens-and-routes)
- [How the front-end talks to the back-end](#how-the-front-end-talks-to-the-back-end)
- [Languages (PT / EN)](#languages-pt--en)
- [Folder structure](#folder-structure)
- [Scripts](#scripts)
- [Deploy](#deploy)
- [Front-end vs. back-end](#front-end-vs-back-end)
- [More documentation](#more-documentation)
- [Third-party code and licenses](#third-party-code-and-licenses)

## Run in 2 minutes

Requirements: **Node.js 20.9+** (tested with Node 24) and npm.

```bash
git clone https://github.com/DPViega/orbix-declare.git
cd orbix-declare
npm install
npm run dev
```

Open <http://localhost:3000>. Without `.env.local`, the app runs in **demo mode**:

- On the sign-in screen, choose **"Enter demo mode"**. With Phantom or Solflare installed you can also sign in with your wallet; the signature is real but validated by the mock.
- The simulated sync takes about 14 seconds and ends on the dashboard.
- The report CSV is generated in the browser, and the public verification link (`/v/<id>`) checks the real hash: download the CSV in *Reports → September 2026* and drop it on the verification page.

To use the real back-end:

```bash
cp .env.example .env.local
# edit NEXT_PUBLIC_API_URL=https://your-api
npm run dev
```

## Environment variables

All of them are `NEXT_PUBLIC_*`, which means they are **public** (shipped to the browser). Template in [`.env.example`](.env.example).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | empty → demo mode | Back-end API base URL, no trailing `/` |
| `NEXT_PUBLIC_USE_MOCKS` | no | `false` | `true` forces demo mode |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | no | `mainnet-beta` | network used in Solana Explorer links |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | no | public mainnet RPC | RPC used by the Wallet Adapter |
| `NEXT_PUBLIC_APP_URL` | no | page domain | base of the public verification link |

> **Never** put Helius, Supabase, R2, AI model keys or any other secret here. They belong to the back-end.
> An RPC URL with a key in it is also a secret and must not come here.

## Screens and routes

Screens follow the mockups in [`docs/`](docs/), in light and dark themes. The theme follows the system by default and can be changed in *Settings*.

| Screen | Route | Access |
|---|---|---|
| Opening animation (3D logo in three.js) | every load except `/v/*` (skip with click or Esc; calm version with reduced motion) | — |
| Sign-in | `/login` | public |
| Sync | `/sincronizacao` | signed in |
| Welcome | after sync, on **Go to dashboard** | signed in |
| Wallets | `/carteiras` | signed in |
| Monthly dashboard | `/painel?mes=YYYY-MM` | signed in |
| Report history | `/relatorios` | signed in |
| Monthly report | `/relatorios/YYYY-MM` | signed in |
| Calculation certificate | `/relatorios/YYYY-MM/certificado` | signed in |
| AI agent (Lume) | `/agente` | signed in |
| Settings | `/configuracoes` | signed in |
| Pricing | `/precos` | public |
| Privacy | `/privacidade` | public |
| Public verification | `/v/<id>` | public |

Empty and error states appear where they happen: no wallet extension on `/login`, wallet without history on `/carteiras`, missing price on `/painel`. There is also a 404 page, a generic error screen and loading skeletons.

The layout is responsive. Below 1024px the sidebar becomes a top bar with a menu, and tables scroll horizontally inside their panel.

## How the front-end talks to the back-end

```
Screen  ──►  api.*  (src/lib/api/index.ts)
               ├── real mode:  fetch  NEXT_PUBLIC_API_URL + /api/...   (Authorization: Bearer <token>)
               └── demo mode:  src/lib/api/mock.ts   (sample data, in memory)
```

- **Single entry point.** No screen calls `fetch` directly; they all use `api.*`. Integrating only requires `NEXT_PUBLIC_API_URL`.
- **Typed contract.** Request and response shapes live in [`src/lib/api/types.ts`](src/lib/api/types.ts), routes in [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).
- **Sign-In With Solana.** The front-end requests a nonce, the wallet signs the message, and the back-end validates the signature and returns a token. The front-end never decides whether a login is valid. See [`src/lib/wallet-login.ts`](src/lib/wallet-login.ts).
- **Errors.** The back-end answers `{ "error": { "code", "message" } }` with the message in the requested language, and the front-end shows it. A `401` ends the session and returns to sign-in.
- **Language.** Every request sends `Accept-Language` (`pt-BR` or `en-US`).

## Languages (PT / EN)

The whole interface exists in **Portuguese** and **English**.

| Piece | File |
|---|---|
| Texts (Portuguese is the source of truth) | [`src/lib/i18n/messages/pt.ts`](src/lib/i18n/messages/pt.ts) |
| English texts (same keys; TypeScript flags any missing text) | [`src/lib/i18n/messages/en.ts`](src/lib/i18n/messages/en.ts) |
| `useI18n()` hook → `{ t, locale, setLocale }` | [`src/lib/i18n/index.tsx`](src/lib/i18n/index.tsx) |
| Server-side language (tab titles, `<html lang>`) | [`src/lib/i18n/server.ts`](src/lib/i18n/server.ts) |

- **Language choice:** `orbix.locale` cookie, set by the switcher; without it, English. The server renders in the right language, with no flash.
- **Numbers and dates** follow the language, but values stay **in reais** and in **Brasília time**, which is what the tax authority uses.
- **Always in Portuguese:** the official report CSV (it goes to the Receita) and tax terms (DeCripto, PTAX, DARF, LGPD), with a short explanation in English.
- **New UI text:** add the key to `pt.ts` and `en.ts` and use `t.section.key` in the component.

## Folder structure

```
src/
├── app/                         # Routes (App Router)
│   ├── layout.tsx               # Fonts, metadata, providers
│   ├── globals.css              # Light/dark theme tokens
│   ├── login/, sincronizacao/
│   ├── (app)/                   # Signed-in area (sidebar + session guard)
│   │   ├── painel/, carteiras/, agente/, configuracoes/
│   │   └── relatorios/          # history, [mes] report and certificate
│   ├── precos/, privacidade/
│   ├── v/[id]/                  # Public verification
│   └── not-found.tsx, error.tsx
├── components/                  # UI kit, app shell, tables, dialogs, providers
└── lib/
    ├── api/                     # api.* (real or mock), types, client, mock
    ├── session.tsx, wallet-login.ts
    ├── report-file.ts           # CSV + SHA-256 in the browser
    ├── format.ts, use-api.ts, config.ts
    └── i18n/
docs/
├── API_CONTRACT.md              # Routes, shapes, auth, CORS (for the back-end)
├── RELATORIO_DESENVOLVIMENTO.md # How the front-end was built (Portuguese)
├── CODEBASE_MAP.md              # Architecture map
└── Orbix Declare - *.html       # Original mockups
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server on `localhost:3000` |
| `npm run build` | production build |
| `npm start` | serves the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | generates Next route types and runs `tsc` |
| `npm test` | Vitest |
| `npm run check` | typecheck, lint, tests and build (run before a PR) |

## Deploy

A standard Next.js app.

- **Vercel:** import the repository and set the `NEXT_PUBLIC_*` variables.
- **Any Node host:** `npm ci && npm run build && npm start` behind Nginx or Caddy with HTTPS, kept alive by PM2 or systemd.

After deploying, allow the front-end domain in the back-end **CORS**, and point `NEXT_PUBLIC_APP_URL` to the final domain, because it is the link printed on reports.

## Front-end vs. back-end

| Front-end (this repo) | Back-end (orbix-core) |
|---|---|
| Screens, themes, responsiveness, loading/empty/error states | `/api/*` routes |
| Connect the wallet and request the message signature | Issue the nonce, **validate** the signature, create the session |
| Show numbers from the API | Helius/Hyperliquid ingestion, prices, PTAX, average cost, tax |
| Agent chat UI | AI model calls (the key stays on the back-end) |
| Recompute a file's SHA-256 **in the browser** | Generate the official DeCripto file, write the hash on Solana (Memo), store files |
| Start downloads from a URL | Issue temporary (presigned) URLs |

Secrets and tax rules never run in the browser.

## More documentation

- [**orbix-core**](https://github.com/ERIKFABIANO/orbix-core): back-end repository (API, on-chain ingestion, tax engine, AI agent, Solana records).
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md): every route the front-end calls, with JSON examples, auth, CORS and errors. **Start here if you work on the back-end.**
- [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md): architecture, flows (sign-in, sync, verification) and where to change what.
- [`docs/BRAND_GUIDE.md`](docs/BRAND_GUIDE.md): palette, typography and brand colors.
- [`docs/RELATORIO_DESENVOLVIMENTO.md`](docs/RELATORIO_DESENVOLVIMENTO.md): build log, decisions and known limits (Portuguese).
- [`docs/TESTE_USUARIOS.md`](docs/TESTE_USUARIOS.md): user and accountant test script (Portuguese).
- [`examples/`](examples/): reproducible synthetic cases with expected results (`npx tsx examples/verify-demo.ts`).

## Third-party code and licenses

Per the hackathon rules (section 9), we declare the third-party code we used. All code in `src/` was written by the
team, starting during the event (Sep 14 – Oct 12, 2026), from the `create-next-app` skeleton, using the open-source
dependencies below without modifying them:

| Package | Version | License | Use |
|---|---|---|---|
| next | 16.3.8 | MIT | framework |
| react / react-dom | 19.2.8 | MIT | UI |
| tailwindcss | 4.x | MIT | styles |
| @solana/wallet-adapter-react / -base | 0.15 / 0.9 | Apache-2.0 | wallet connection |
| @solana/web3.js | 1.99 | MIT | Solana types and public keys |
| @phosphor-icons/react | 2.1 | MIT | icons |
| next-themes | 0.4 | MIT | light/dark theme |
| three | 0.186 | MIT | 3D logos and login planet (loaded on demand) |
| recharts | 3.10 | MIT | dashboard monthly chart |
| bs58 | 6.0 | MIT | signature encoding |
| Outfit, DM Sans, JetBrains Mono fonts | — | SIL OFL 1.1 | via `next/font/google` |

The sign-in layout was **inspired by the `auth-5` block from [Efferd](https://efferd.com)**. We did not install the block:
we rewrote it with our own components and tokens, and the animated lines (`src/components/floating-paths.tsx`)
reuse the original geometry, animated with SVG and CSS only.

The logo and mockups (`docs/`) belong to Orbix Lab. The code in this repository is released under the [MIT](LICENSE) license.
