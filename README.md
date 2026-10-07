<p align="center">
  <img src="public/brand/orbix-declare-logo.png" alt="Orbix Declare" height="72">
</p>

<h1 align="center">Orbix Declare — Front-end</h1>

<p align="center">
  <b>Seus impostos cripto, calculados em reais.</b><br>
  Um agente de IA lê suas carteiras Solana e Hyperliquid, converte cada evento pela PTAX
  e prepara a DeCripto do mês para a Receita Federal.
</p>

<p align="center">
  Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Solana Wallet Adapter<br>
  Projeto da <b>Orbix Lab</b> para o <b>Crypto World's Fair Hackathon</b> (Colosseum, 2026)<br>
  Back-end: <a href="https://github.com/ERIKFABIANO/orbix-core"><b>orbix-core</b></a>
</p>

---

Este repositório contém **apenas o front-end** do Orbix Declare. Todo o processamento (leitura on-chain,
cotações, motor fiscal, agente de IA, registro do hash na Solana, arquivos) é feito pelo back-end, no
repositório [**orbix-core**](https://github.com/ERIKFABIANO/orbix-core). O front conversa com ele por uma API HTTP documentada em
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

Sem back-end, o app roda em **modo demonstração**, com os mesmos dados dos mockups, e permite navegar por todas as telas.

## Sumário

- [Rodar em 2 minutos](#rodar-em-2-minutos)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Telas e rotas](#telas-e-rotas)
- [Como o front fala com o back-end](#como-o-front-fala-com-o-back-end)
- [Idiomas (PT / EN)](#idiomas-pt--en)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Scripts](#scripts)
- [Deploy](#deploy)
- [O que é front e o que é back](#o-que-é-front-e-o-que-é-back)
- [Documentação adicional](#documentação-adicional)
- [Código de terceiros e licenças](#código-de-terceiros-e-licenças)

## Rodar em 2 minutos

Pré-requisitos: **Node.js 20.9+** (testado com Node 24) e npm.

```bash
git clone <url-deste-repositório>
cd Sys-Front
npm install
npm run dev
```

Abra <http://localhost:3000>. Sem `.env.local`, o app entra em **modo demonstração**:

- Na tela de login, use **"Entrar no modo demonstração"**. Se você tiver a Phantom ou a Solflare, também pode entrar com a carteira; a assinatura é real, mas é validada pelo mock.
- A sincronização simulada leva cerca de 14 segundos e termina no painel.
- O CSV do relatório é gerado no navegador, e o link de verificação pública (`/v/<id>`) confere o hash de verdade: baixe o CSV em *Relatórios → Setembro 2026* e arraste-o na página de verificação.

Para usar o back-end real:

```bash
cp .env.example .env.local
# edite NEXT_PUBLIC_API_URL=https://sua-api
npm run dev
```

## Variáveis de ambiente

Todas são `NEXT_PUBLIC_*`, ou seja, **públicas** (vão para o navegador). Modelo em [`.env.example`](.env.example).

| Variável | Obrigatória | Padrão | Para que serve |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | não | vazia → modo demo | URL base da API do back-end, sem `/` no final |
| `NEXT_PUBLIC_USE_MOCKS` | não | `false` | `true` força o modo demonstração |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | não | `mainnet-beta` | rede usada nos links do Solana Explorer |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | não | RPC público mainnet | RPC usado pelo Wallet Adapter |
| `NEXT_PUBLIC_APP_URL` | não | domínio da página | base do link público de verificação |

> **Nunca** coloque aqui `HELIUS_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, chaves do R2
> ou qualquer segredo. Elas são do back-end. Um RPC com chave na URL também é segredo e não deve vir para cá.

## Telas e rotas

Todas as telas seguem os mockups em [`docs/`](docs/), nos temas claro e escuro. O tema segue o sistema por padrão e pode ser trocado em *Configurações*.

| # | Tela do mockup | Rota | Acesso |
|---|---|---|---|
| 00 | Abertura (recriação de `docs/Orbix Loading.mp4` e `docs/brave_1pMbtqUtLW.mp4`, com a logo 3D `public/od-logo.glb` em three.js) | a cada carregamento (5 s na primeira visita do navegador, 2,5 s nas seguintes; pula com clique/Esc; com redução de movimento, versão calma), exceto `/v/*` | — |
| 01 | Login | `/login` | público |
| 02 | Sincronização | `/sincronizacao` | logado |
| 02b | Boas-vindas (logo 3D `public/orbix-declare.glb`; referência `docs/Orbix Welcome.mp4`, fora do repositório) | depois de "Tudo pronto.", ao clicar em **Ir para o painel** (4 s na primeira vez neste navegador, 1,8 s nas seguintes; pula com clique/Esc; com redução de movimento, versão calma); termina abrindo `/painel` | logado |
| 03 | Carteiras | `/carteiras` | logado |
| 04 | Painel mensal | `/painel?mes=AAAA-MM` | logado |
| 05 | Histórico de relatórios | `/relatorios` | logado |
| 06 | Relatório mensal | `/relatorios/AAAA-MM` | logado |
| 07 | Agente IA | `/agente` | logado |
| 08 | Configurações | `/configuracoes` | logado |
| 09 | Estados vazios e de erro | integrados nas telas (ver abaixo) | — |
| 10 | Verificação pública | `/v/<id>` | público |

Os estados da tela 09 aparecem onde acontecem:

- **Sem extensão de carteira**: no `/login`, quando nenhuma carteira é detectada.
- **Carteira sem histórico**: no `/carteiras`.
- **Preço não encontrado**: no `/painel`, ao clicar no selo "Sem preço".

Também há 404, tela de erro genérica e esqueletos de carregamento.

O layout é responsivo. Abaixo de 1024px a sidebar vira barra superior com menu, e as tabelas rolam na horizontal dentro do próprio painel.

## Como o front fala com o back-end

```
Tela  ──►  api.*  (src/lib/api/index.ts)
              ├── modo real:  fetch  NEXT_PUBLIC_API_URL + /api/...   (Authorization: Bearer <token>)
              └── modo demo:  src/lib/api/mock.ts   (dados dos mockups, em memória)
```

- **Uma única porta de entrada.** Nenhuma tela chama `fetch` direto; todas usam `api.*`. Para integrar, basta configurar `NEXT_PUBLIC_API_URL`, sem mudar nenhuma tela.
- **Contrato tipado.** Os formatos de request e response estão em [`src/lib/api/types.ts`](src/lib/api/types.ts) e as rotas em [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).
- **Login com carteira (Sign-In With Solana).** O front pede um nonce, a carteira assina a mensagem e o back-end valida a assinatura e devolve um token. O front nunca decide se o login é válido. Ver [`src/lib/wallet-login.ts`](src/lib/wallet-login.ts).
- **Erros.** O back-end responde `{ "error": { "code", "message" } }` com a mensagem no idioma pedido, e o front mostra essa mensagem ao usuário. Um `401` encerra a sessão e leva ao login.
- **Idioma.** Toda requisição leva `Accept-Language` (`pt-BR` ou `en-US`); os textos que vêm do back-end devem respeitar esse header (detalhes em [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)).

## Idiomas (PT / EN)

A interface inteira existe em **português** e **inglês**. O seletor PT | EN fica no login, na barra lateral, em Configurações, na tela de sincronização e na página pública de verificação.

| Peça | Arquivo |
|---|---|
| Textos (fonte da verdade em português) | [`src/lib/i18n/messages/pt.ts`](src/lib/i18n/messages/pt.ts) |
| Textos em inglês (mesmas chaves; o TypeScript acusa qualquer texto faltando) | [`src/lib/i18n/messages/en.ts`](src/lib/i18n/messages/en.ts) |
| Hook `useI18n()` → `{ t, locale, setLocale }` | [`src/lib/i18n/index.tsx`](src/lib/i18n/index.tsx) |
| Idioma no servidor (títulos da aba, `<html lang>`) | [`src/lib/i18n/server.ts`](src/lib/i18n/server.ts) |

- **Como o idioma é escolhido:** cookie `orbix.locale` (gravado pelo seletor); sem cookie, inglês (padrão). O servidor já renderiza no idioma certo, sem piscar.
- **Números e datas** seguem o idioma (`R$ 28.940,13` / `R$28,940.13`, `30/09/2026` / `Sep 30, 2026`), mas os valores continuam **em reais** e no **fuso de Brasília**: é o que vale para o fisco.
- **Ficam em português nos dois idiomas:** o CSV oficial do relatório (vai para a Receita) e os nomes próprios do fisco (DeCripto, PTAX, DARF, LGPD), com uma explicação curta no texto em inglês.
- **Novo texto na interface:** adicione a chave em `pt.ts` e em `en.ts` e use `t.secao.chave` no componente.

## Estrutura de pastas

```
src/
├── app/                         # Rotas (App Router)
│   ├── layout.tsx               # Fontes, metadados, providers
│   ├── globals.css              # Tokens dos temas claro/escuro (valores dos mockups)
│   ├── login/                   # 01 Login
│   ├── sincronizacao/           # 02 Sincronização
│   ├── (app)/                   # Área logada (sidebar + guarda de sessão)
│   │   ├── painel/              # 04
│   │   ├── carteiras/           # 03
│   │   ├── relatorios/          # 05 e 06 ([mes])
│   │   ├── agente/              # 07
│   │   └── configuracoes/       # 08
│   ├── v/[id]/                  # 10 Verificação pública
│   ├── not-found.tsx, error.tsx
│   └── icon.png                 # Favicon (logo)
├── components/
│   ├── ui.tsx                   # Button, Badge, Card, Panel, Input, Kicker, StateBlock...
│   ├── app-shell.tsx            # Sidebar (desktop) + barra/gaveta (mobile)
│   ├── table.tsx                # Tabela no padrão dos mockups
│   ├── month-picker.tsx, price-dialog.tsx
│   └── providers.tsx            # Tema, Wallet Adapter, sessão
└── lib/
    ├── api/
    │   ├── index.ts             # api.* — real ou mock
    │   ├── types.ts             # Contrato de dados com o back-end
    │   ├── client.ts            # fetch + token + erros
    │   └── mock.ts              # Back-end simulado (modo demonstração)
    ├── session.tsx              # Sessão (token) no navegador
    ├── wallet-login.ts          # Fluxo Sign-In With Solana
    ├── report-file.ts           # CSV + SHA-256 no navegador
    ├── format.ts                # R$, datas, meses, endereços (pt-BR)
    ├── use-api.ts               # Hook de busca de dados
    └── config.ts                # Variáveis públicas
docs/
├── API_CONTRACT.md              # Rotas, formatos, autenticação, CORS — para o back-end
├── RELATORIO_DESENVOLVIMENTO.md # Como o front foi feito, decisões e pendências
├── CODEBASE_MAP.md              # Mapa da arquitetura e guia de navegação
└── Orbix Declare - *.html       # Mockups originais (abrir no navegador)
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento em `localhost:3000` |
| `npm run build` | build de produção |
| `npm start` | serve o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | gera os tipos de rota do Next e roda o `tsc` |
| `npm run check` | typecheck, lint e build (use antes de abrir PR) |

## Deploy

O front é um app Next.js comum.

- **Vercel**: importe o repositório e defina as variáveis `NEXT_PUBLIC_*`. Nenhuma configuração extra é necessária.
- **DigitalOcean Droplet** (como no plano do Hub): `npm ci && npm run build && npm start` atrás de um Nginx ou Caddy com HTTPS. Use PM2 ou systemd para manter o processo no ar.

Depois do deploy, o domínio do front precisa estar liberado no **CORS** do back-end, e `NEXT_PUBLIC_APP_URL` deve apontar para o domínio final, porque esse é o link que vai nos relatórios.

## O que é front e o que é back

| Front-end (este repo) | Back-end (outro repo) |
|---|---|
| Telas, temas, responsividade e estados de carregamento/vazio/erro | Rotas `/api/*` |
| Conectar a carteira e pedir a assinatura da mensagem | Gerar o nonce e **validar** a assinatura, emitir a sessão |
| Mostrar números que vêm da API | Ingestão Helius/Hyperliquid, preços (CoinGecko), PTAX, custo médio, imposto |
| Chat do agente (UI) | Chamada ao Claude com `ANTHROPIC_API_KEY` |
| Recalcular o SHA-256 de um arquivo **no navegador** | Gerar o CSV/DeCripto oficial, gravar o hash na Solana (Memo), guardar no R2 |
| Disparar downloads a partir de uma URL | Gerar URLs temporárias (presigned) |

Se alguém pedir para fazer uma dessas coisas do back-end aqui, a resposta é não: segredos e regras fiscais não podem rodar no navegador.

## Documentação adicional

- [`docs/BRAND_GUIDE.md`](docs/BRAND_GUIDE.md): paleta, tipografia, cores da marca e comportamento visual do login.

- [**orbix-core**](https://github.com/ERIKFABIANO/orbix-core): repositório do back-end (API, ingestão on-chain, motor fiscal, agente de IA e registro na Solana).
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md): todas as rotas que o front chama, com exemplos de JSON, autenticação, CORS e erros. **Comece por aqui se você é do back-end.**
- [`docs/RELATORIO_DESENVOLVIMENTO.md`](docs/RELATORIO_DESENVOLVIMENTO.md): como o front foi construído, decisões, verificação feita, limitações conhecidas e próximos passos.
- [`docs/CODEBASE_MAP.md`](docs/CODEBASE_MAP.md): mapa da arquitetura, fluxos (login, sincronização, verificação) e onde mexer para cada tipo de mudança.
- [`docs/COMPETITIVIDADE_STATUS.md`](docs/COMPETITIVIDADE_STATUS.md): o que já temos e o que falta em cada item de competitividade, com as tarefas do front e do back.
- [`docs/TESTE_USUARIOS.md`](docs/TESTE_USUARIOS.md): roteiro e planilha dos testes com usuários e com o contador.
- [`examples/`](examples/): casos sintéticos reproduzíveis com o resultado esperado (`npx tsx examples/verify-demo.ts`).

## Código de terceiros e licenças

Pelo regulamento do hackathon (seção 9), declaramos o código de terceiros usado. Todo o código em `src/` foi
escrito pela equipe durante o período do evento (14/09–12/10/2026). Partimos do esqueleto gerado pelo
`create-next-app` e usamos as dependências open-source abaixo, sem modificá-las:

| Pacote | Versão | Licença | Uso |
|---|---|---|---|
| next | 16.3.8 | MIT | framework |
| react / react-dom | 19.2.8 | MIT | UI |
| tailwindcss | 4.x | MIT | estilos |
| @solana/wallet-adapter-react / -base | 0.15 / 0.9 | Apache-2.0 | conexão com carteiras |
| @solana/web3.js | 1.99 | MIT | tipos e chave pública Solana |
| @phosphor-icons/react | 2.1 | MIT | ícones |
| next-themes | 0.4 | MIT | tema claro/escuro |
| three | 0.186 | MIT | logo 3D da abertura, planeta do login e logo da tela de boas-vindas (carregado sob demanda) |
| bs58 | 6.0 | MIT | codificar a assinatura |
| Fontes Outfit, DM Sans, JetBrains Mono | — | SIL OFL 1.1 | via `next/font/google` |

O layout da tela de login foi **inspirado no bloco `auth-5` do [Efferd](https://efferd.com)**: painel com linhas animadas e formulário centralizado.
Não instalamos o bloco. Reescrevemos a composição com os nossos componentes e tokens, e as linhas animadas
(`src/components/floating-paths.tsx`) usam a mesma geometria do original, animadas só com SVG e CSS.

O logo e os mockups (`docs/`) são da Orbix Lab. O código deste repositório é distribuído sob a licença [MIT](LICENSE).
