# Contrato da API — Orbix Declare

Este documento é para quem desenvolve o **back-end**. Ele descreve cada rota que o front-end chama, os formatos JSON esperados e as regras de autenticação, CORS e erros.

- **Fonte da verdade dos tipos:** [`src/lib/api/types.ts`](../src/lib/api/types.ts). Se mudar algo aqui, mude lá também (ou avise o front).
- **Onde as rotas são chamadas:** [`src/lib/api/index.ts`](../src/lib/api/index.ts), em `httpApi`.
- **Exemplo vivo de cada resposta:** [`src/lib/api/mock.ts`](../src/lib/api/mock.ts). O modo demonstração devolve exatamente estes formatos.

## Convenções

| Item | Regra |
|---|---|
| Base | `NEXT_PUBLIC_API_URL` + caminho. Ex.: `https://api.orbixdeclare.com/api/wallets` |
| Formato | JSON (`Content-Type: application/json`) |
| Dinheiro | `number` em **reais**, já arredondado a 2 casas (`28940.13`). O front só formata. |
| Quantidade de ativo | `number` (`12.4`) |
| Datas | ISO 8601 em UTC (`"2026-09-28T15:00:00.000Z"`). O front exibe no fuso `America/Sao_Paulo`. |
| Mês | string `"AAAA-MM"` (`"2026-09"`) em rotas e campos |
| Endereços e hashes | string completa. O front encurta para exibir (`7xKp…3fQa`). |
| Textos para o usuário | em **português do Brasil** (mensagens de erro inclusive) |

## Autenticação (Sign-In With Solana)

O usuário entra **só com a carteira**. Não há senha nem e-mail.

```
Front                                   Back-end
  │ GET /api/auth/nonce?address=<pubkey>   │
  │ ─────────────────────────────────────► │  gera nonce (uso único, expira ~5 min)
  │ ◄───────────────────────────────────── │  { message, nonce, expiresAt }
  │                                         │
  │ carteira assina `message` (ed25519)     │
  │                                         │
  │ POST /api/auth/verify                   │
  │ { address, message, signature(base58) } │
  │ ─────────────────────────────────────► │  1. nonce existe, não usado, não expirado
  │                                         │  2. `message` contém o nonce e o address
  │                                         │  3. nacl.sign.detached.verify(message, sig, pubkey)
  │                                         │  4. marca nonce como usado
  │ ◄───────────────────────────────────── │  { token, expiresAt, user }
  │                                         │
  │ demais chamadas:                        │
  │ Authorization: Bearer <token>           │
```

- **O back-end monta a mensagem.** O front assina exatamente o texto recebido em `message`. Sugestão de formato no padrão SIWS: domínio, endereço, frase, URI, versão, nonce e data de emissão (veja o exemplo em `mock.ts → getNonce`).
- A assinatura chega em **base58** (`bs58.encode(Uint8Array)`).
- **Token:** o front guarda em `localStorage` e envia em `Authorization: Bearer`. O formato é livre: JWT próprio ou access token do Supabase Auth, por exemplo.
  - Para usar cookie `httpOnly`, o que é mais seguro contra XSS, o front precisa de uma pequena mudança: `credentials: "include"` em `src/lib/api/client.ts` e não guardar mais o token. Combine antes.
- **401** em qualquer rota faz o front encerrar a sessão e voltar ao login com a mensagem "Sua sessão expirou".

### `GET /api/auth/nonce?address=<pubkey>`
```json
{ "message": "orbixdeclare.com quer que você entre com sua conta Solana:\n7xKp…\n\n…\nNonce: k3j9x0\nEmitido em: 2026-09-30T17:30:00Z",
  "nonce": "k3j9x0", "expiresAt": "2026-09-30T17:35:00Z" }
```

### `POST /api/auth/verify`
Request: `{ "address": "7xKp…", "message": "<exatamente o texto assinado>", "signature": "<base58>" }`
Response `Session`:
```json
{ "token": "eyJ…", "expiresAt": "2026-10-01T17:30:00Z",
  "user": { "id": "usr_1", "address": "7xKp…", "plan": "free", "agentQuestionsLeft": 20, "onboarded": false } }
```
`onboarded`: `true` quando a primeira sincronização completa terminou. Com `false`, o front leva o usuário para `/sincronizacao` depois do login.

### `GET /api/me` → `User`
### `POST /api/auth/logout` → `204`
### `DELETE /api/me` → `204`
Exclusão definitiva (LGPD, art. 18): carteiras, relatórios, rascunhos e histórico do agente. Os hashes já gravados na Solana permanecem.

## Carteiras

### `GET /api/wallets` → `Wallet[]`
```json
[{ "id": "w_1", "network": "solana", "address": "7xKp…", "label": "Principal",
   "isLogin": true, "verifiedAt": "2026-09-02T16:10:00Z", "lastSyncAt": "2026-09-30T17:32:00Z",
   "status": "synced", "error": null }]
```
`network`: `"solana" | "hyperliquid"` · `status`: `"synced" | "syncing" | "error" | "empty" | "pending"`.
Com `"empty"` (carteira sem histórico) e `lastSyncAt` preenchido, o front mostra o estado "Nenhuma transação encontrada".

### `POST /api/wallets` → `Wallet`
Request: `{ "network": "hyperliquid", "address": "0x…40 hex", "label": "opcional" }`
O front já valida `^0x[0-9a-fA-F]{40}$`, mas o back-end **deve validar de novo**. Erros esperados:
`422 invalid_address`, `409 duplicate_wallet`, `403 plan_limit` (plano grátis: até 3 carteiras).

### `DELETE /api/wallets/:id` → `204`
A carteira de login (`isLogin: true`) não pode ser removida: responda `409 login_wallet`.

### `POST /api/wallets/:id/sync` → `Wallet`
Ressincroniza uma carteira. Pode responder logo com `status: "syncing"`.

## Sincronização (ingestão)

O front tem uma tela de progresso que consulta o status a cada **1,5 s**.

### `POST /api/ingest` → `SyncStatus`
Inicia, ou retoma, a leitura de **todas** as carteiras do usuário. Internamente o back-end pode disparar `/api/ingest/solana` e `/api/ingest/hyperliquid`, como no Hub. Deve ser idempotente: chamar de novo com uma leitura em andamento não duplica o trabalho.

### `GET /api/ingest/status` → `SyncStatus`
```json
{ "state": "running", "since": "2025-01-01", "read": 1284, "estimated": 1900,
  "wallets": [
    { "walletId": "w_1", "network": "solana", "address": "7xKp…", "read": 1036, "total": 1036, "state": "done" },
    { "walletId": "w_2", "network": "hyperliquid", "address": "0x4f…", "read": 248, "total": null, "state": "running", "detail": "fills e funding" }
  ],
  "steps": [
    { "key": "verify", "label": "Carteira verificada por assinatura", "state": "done" },
    { "key": "solana", "label": "Histórico Solana lido", "state": "done" },
    { "key": "hyperliquid", "label": "Buscando fills e funding na Hyperliquid", "state": "running" },
    { "key": "prices", "label": "Cotando cada evento pela PTAX", "state": "pending" },
    { "key": "dashboard", "label": "Montando o painel do mês", "state": "pending" }
  ] }
```
- `state` geral: `"idle" | "running" | "done" | "error"`. Com `"done"` o front para de consultar.
- `state` de wallet e step: `"done" | "running" | "pending" | "error"`. Para erro, preencha `error` com uma mensagem amigável.
- `estimated` e `total` podem ser `null` enquanto não houver estimativa; o front mostra uma barra indeterminada.
- Os rótulos de `steps` vêm do back-end, então dá para mudar o texto sem mexer no front.

## Painel e eventos

### `GET /api/dashboard?month=AAAA-MM` → `Dashboard`
Sem `month`, devolva o mês mais recente com dados.
```json
{ "month": "2026-09", "updatedAt": "2026-09-30T17:35:00Z",
  "volumeBrl": 28940.13, "disposals": 6, "capitalGainBrl": 4182.36, "gainChangePct": 12.4,
  "estimatedTaxBrl": 0, "exemptionLimitBrl": 35000, "missingPrices": 1 }
```
`exemptionLimitBrl` vem do back-end para que a regra fiscal não fique fixa no front.

### `GET /api/events?month=AAAA-MM` → `TaxEvent[]`
```json
[{ "id": "ev_1", "date": "2026-09-28T15:00:00Z", "network": "solana", "type": "swap",
   "asset": "SOL → USDC", "quantity": 12.4, "quantityAsset": "SOL",
   "valueBrl": 11284.0, "priceSource": "auto",
   "txHash": "4Zq8…", "explorerUrl": "https://explorer.solana.com/tx/4Zq8…" }]
```
`type`: `"swap" | "perp" | "funding"`. Quando **nenhuma fonte de preço** foi encontrada: `valueBrl: null` e `priceSource: null`. O front mostra "Sem preço" e abre o formulário de preço manual.

### `PUT /api/events/:id/price` → `TaxEvent`
Request: `{ "unitPriceBrl": 3.08 }`. Devolve o evento atualizado, com `priceSource: "manual"` e `valueBrl` recalculado. O relatório deve marcar essa linha como manual (`manualPrice: true`).

## Relatórios

### `GET /api/reports` → `ReportSummary[]`
```json
[{ "month": "2026-09", "status": "final", "events": 7, "totalBrl": 28940.13, "updatedAt": "2026-10-05T13:14:00Z" }]
```
Ordene do mais recente para o mais antigo. `status`: `"draft" | "final"`.

### `GET /api/report/:month` → `ReportDetail`
```json
{ "month": "2026-09", "status": "final",
  "totals": { "disposedBrl": 28940.13, "costBrl": 24757.77, "gainBrl": 4182.36, "taxBrl": 0 },
  "rows": [{ "id": "r1", "date": "2026-09-28T15:00:00Z", "type": "swap", "asset": "SOL → USDC",
             "quantity": 12.4, "ptax": 5.4128, "valueBrl": 11284.0, "costBrl": 9412.6, "gainBrl": 1871.4, "manualPrice": false }],
  "attestation": { "hash": "a3f9…c14", "txSignature": "5hN2…Xk9P", "slot": 331508764,
                   "registeredAt": "2026-10-05T13:14:22Z", "publicId": "a3f9c27e" } }
```
`attestation` é `null` em rascunhos e enquanto o registro on-chain não for confirmado.

### `GET /api/report/:month/csv` → `DownloadLink`
### `POST /api/report/:month/decripto` → `DownloadLink`
```json
{ "url": "https://<r2-presigned>…", "filename": "orbix-declare-2026-09.csv", "expiresAt": "2026-10-05T13:24:00Z" }
```
O front só dispara o download da `url` (presigned do R2). As chaves do R2 ficam no back-end.

## Verificação pública (sem login)

### `GET /api/verify/:publicId` → `PublicVerification`
Esta rota **não** exige token e **não** pode expor dados pessoais.
```json
{ "publicId": "a3f9c27e", "description": "Relatório mensal · Setembro/2026 · titular ocultado", "month": "2026-09",
  "hash": "a3f9…c14", "txSignature": "5hN2…Xk9P", "slot": 331508764,
  "registeredAt": "2026-10-05T13:14:22Z", "valid": true }
```
`valid` é `true` quando o back-end conferiu que o Memo da transação `txSignature` contém o `hash`. Se não encontrar, responda `404 not_found`.

### Regras do hash (importante)

1. `hash` = **SHA-256 em hex minúsculo dos bytes exatos do arquivo CSV** que o usuário baixa em `GET /api/report/:month/csv`.
2. O arquivo final precisa ser **imutável**. Guarde os bytes no R2 e sirva sempre o mesmo arquivo; não gere de novo a cada download, porque qualquer diferença de espaço, ordem ou arredondamento muda o hash.
3. A página `/v/<id>` recalcula o SHA-256 do arquivo que o usuário arrasta (`crypto.subtle.digest`, no navegador) e compara com `hash`. O arquivo nunca sai do navegador.
4. O `publicId` sugerido são os 8 primeiros caracteres do hash. Se houver colisão, use mais caracteres.

## Agente IA

### `POST /api/agent` → `AgentReply`
Request: `{ "message": "Por que tive esse ganho em março?", "month": "2026-03", "conversationId": "conv_1" }`. `month` e `conversationId` são opcionais.

O back-end chama o Claude com `ANTHROPIC_API_KEY`. A chave **nunca** vem para o front.
A resposta é **estruturada em blocos** para que o front mostre os cálculos e as fontes, como no mockup:
```json
{ "conversationId": "conv_1",
  "message": { "id": "m_2", "role": "assistant", "createdAt": "2026-09-30T18:00:00Z",
    "blocks": [
      { "type": "text", "text": "A maior parte do ganho de março (R$ 6.335,75 de R$ 8.912,40) veio de…" },
      { "type": "breakdown", "rows": [
          { "label": "Valor da venda", "value": "US$ 7.182,00" },
          { "label": "× PTAX venda · 13/03/2026", "value": "R$ 5,0412" },
          { "label": "Ganho de capital", "value": "R$ 6.335,75", "emphasis": "gain" } ] },
      { "type": "citations", "items": [
          { "kind": "ptax", "label": "PTAX · Banco Central · 13/03/2026", "url": "https://www.bcb.gov.br/…" },
          { "kind": "tx", "label": "Transação 3JpR…vN8e", "url": "https://explorer.solana.com/tx/3JpR…" } ] } ] },
  "context": { "month": "2026-03", "status": "final", "volumeBrl": 52304.9, "gainBrl": 8912.4, "taxBrl": 1336.86, "taxRatePct": 15,
               "sourceTx": { "title": "Swap SOL → USDC · Jupiter", "signature": "3JpR…", "date": "2026-03-14T19:42:00Z", "slot": 318442107 } },
  "suggestions": ["Como foi calculado o custo médio?", "Esse ganho gerou imposto?"],
  "questionsLeft": 19 }
```
- `breakdown.rows[].value` chega **já formatado**, porque o agente pode misturar US$, R$ e percentuais.
- `emphasis`: `"total"` deixa a linha em negrito; `"gain"` deixa em negrito com o valor em verde.
- `context` alimenta o painel lateral "Relatório citado". Pode ser `null`.
- Cota esgotada: `429 quota`, com mensagem em português.

## Erros

Formato padrão para qualquer status 4xx ou 5xx:
```json
{ "error": { "code": "invalid_address", "message": "Endereço Hyperliquid inválido. Ele começa com 0x e tem 42 caracteres." } }
```
O front mostra `message` ao usuário, então escreva frases curtas em português que digam o que houve e como resolver.
Sem esse formato, o front mostra uma mensagem genérica com o status.

| Status | Quando | Efeito no front |
|---|---|---|
| 401 | token ausente, inválido ou expirado | encerra a sessão e volta ao `/login` |
| 403 | limite do plano | mostra `message` |
| 404 | mês, relatório ou verificação inexistente | estado "não encontrado" |
| 409 | conflito (carteira duplicada ou de login) | mostra `message` |
| 422 | validação | mostra `message` no campo |
| 429 | cota do agente | mostra `message` |
| 5xx / rede | falha | mostra "Tentar de novo" |

## CORS

Como front e back ficam em domínios diferentes, o back-end precisa responder:

```
Access-Control-Allow-Origin: https://<domínio-do-front>   (e http://localhost:3000 em dev)
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 600
```

O front usa `credentials: "omit"`, porque a autenticação vai pelo header. Não use `*` em produção.

## Checklist de integração

- [ ] Rotas acima respondendo com os formatos de `types.ts`
- [ ] Assinatura validada com nonce de uso único
- [ ] CORS liberado para o domínio do front
- [ ] Erros no formato `{ error: { code, message } }`, em português
- [ ] CSV final imutável no R2; `hash` = SHA-256 dos bytes; Memo gravado na Solana
- [ ] `/api/verify/:publicId` público e sem dados pessoais
- [ ] Nenhum segredo devolvido em nenhuma resposta
- [ ] No front: `NEXT_PUBLIC_API_URL` apontando para a API e `NEXT_PUBLIC_APP_URL` para o domínio final
