@AGENTS.md

## Codebase Overview

Front-end only do Orbix Declare (impostos cripto em reais para carteiras Solana e Hyperliquid). Todas as telas falam com o back-end por `api.*` (`src/lib/api/index.ts`), que usa a API real (`NEXT_PUBLIC_API_URL`) ou um back-end simulado (`mock.ts`) quando a variável está vazia. Lógica fiscal, segredos e rotas `/api/*` pertencem ao back-end, em outro repositório; não implemente nada disso aqui.

**Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Solana Wallet Adapter, Phosphor Icons, next-themes.
**Structure**: `src/app` (rotas; `(app)/` = área logada), `src/components` (UI e shell), `src/lib` (api, sessão, login com carteira, formatação, CSV/hash).

Visual = mockups em `docs/*.html` (tokens em `src/app/globals.css`). Contrato com o back-end: `docs/API_CONTRACT.md`. Antes de entregar: `npm run check`.

For detailed architecture, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).
