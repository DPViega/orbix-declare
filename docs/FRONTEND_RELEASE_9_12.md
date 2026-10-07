# Orbix Declare — frontend delivery and integration gates

> Atualização de 07/10/2026: entrega de frontend registrada no commit `b2b58bc`, enviado à branch `fix/frontend-review-and-wallet-recovery` do repositório ERIKFABIANO/orbix-declare. Inclui filtro de transferências, carteira na tabela, aviso de cobertura parcial e tutorial PT/EN para erro de assinatura. Tipos e lint passaram; merge, deploy e aceite real não foram realizados nesta entrega. Ver [relatório separado](RELATORIO_ENTREGA_FRONTEND_2026-10-07.md).
>
> O conteúdo abaixo é histórico e conserva a data/versão da sua análise original. Pendências antigas não representam automaticamente o estado atual. Backend e regras fiscais são responsabilidade do Erik; não foram alterados neste trabalho.

Review date: 2026-10-02. Backend inspected: ERIKFABIANO/orbix-core, commit `31a7180f0d5b0b669b386d961795ec18c181fdf1`.

## Changes delivered locally

- Agent evidence panel available on mobile and desktop.
- Accessible conversation log, reduced-motion scrolling, explicit demo explanation.
- Monthly quota blocks submission; retry retains the failed question without adding another copy; new conversation clears context.
- External citations restricted to HTTP(S); simulated transaction citations are not outbound links.
- Demonstration CSV uses consistent English headers and yes/no values in both UI languages, preserving stable bytes across language changes.
- HTTP client accepts the backend's string error envelope as well as the proposed structured error envelope.

## Backend compatibility — unresolved, not implemented by this frontend change

| Area | Frontend expects | Public backend currently provides | Required agreement |
|---|---|---|---|
| Identity | `/api/me`, full User | `/me`, `{id}` | Agree route and address/plan/onboarded/quota fields; do not fabricate defaults |
| Login | nonce + signature verification returning Session | JWT validation via Supabase JWKS | Decide actual session issuance and implement it before disabling mocks |
| Wallets | network, address, label and status | Input schema uses chain, address; no registered wallet route | Agree names and status contract |
| Import/events/reports/agent | endpoints documented in API_CONTRACT | No registered endpoints in inspected main.py | Backend implementation and end-to-end tests required |
| CORS | GET, POST, PUT, DELETE | GET, POST, DELETE | Add PUT for manual-price update on backend |
| Errors | structured code/message | string error + request_id | String error compatibility added to client; backend still needs localized messages |

No production endpoint, authenticated session or real test wallet was used. A clone of the public source is not evidence of deployed backend state.

## Acceptance run before beta

Record expected/actual result, build commit, browser, viewport and evidence. Unchecked means pending, not passed.

- [ ] 390px and 320px: login, wallets, dashboard, report, agent and verification; no page-wide horizontal overflow.
- [ ] Keyboard: menu opens/closes and returns focus; month picker arrows/Escape; dialogs; agent sources and retry.
- [ ] PT/EN and light/dark: labels, errors, empty states, long addresses, decimal input and demo CSV.
- [ ] Agent: success, network failure, retry, zero quota, new conversation, long message, evidence visible on mobile.
- [ ] Reduced motion: splash and chat usable without smooth scrolling.
- [ ] Real backend: fresh wallet signature, refresh, expired session, logout and two-user isolation.
- [ ] Real import: repeat without duplicates, partial history, missing price, recoverable failure.
- [ ] Review: save reason/evidence, refresh, verify history and recalculation.
- [ ] Report: authorized download, expired link, correct version and bytes; changed file fails hash comparison if anchoring enabled.

## Demo script (English)

1. “Orbix Declare organizes supported Solana and Hyperliquid activity into records that Brazilian users can review in reais.”
2. “This session uses [clearly identified sample data / a consenting user's wallet].”
3. Sign in, show wallets and actual history coverage. Do not present simulated ingestion as real.
4. Open an event: transaction, price source, currency conversion and unresolved items.
5. Resolve one supported review item; show saved evidence only if persistence is implemented.
6. Open the report; explain coverage and limitations. Download the review CSV.
7. Ask the agent to explain a result and show its evidence on mobile. Explicitly identify sample responses if mocked.
8. “This is a review workflow. The current limitations are [verified limitations].”

Never claim a live AI response, valid fiscal filing, completed user testing, or blockchain anchoring unless demonstrated in the submitted build.

## Release sequence

Oct 5–8: observed beta and fixes. Oct 9: freeze features. Oct 10: record final English demo/pitch. Oct 11: review and submit. Oct 12: contingency.

Keep the current public deployment until the candidate has passed acceptance checks. Save commit and deployment identity; verify links in a fresh session. Actual beta interviews and final recordings remain team actions, not completed artifacts of this change.

## Validation executed in this change

- PASS: npm run check (type generation, TypeScript, ESLint, production build).
- PASS: local production build, demo login and agent response with evidence.
- PASS: effective viewport 390px and 320px; agent document did not overflow horizontally.
- PASS: new conversation clears context and messages without resetting remaining quota.
- PASS: PT/EN agent labels; mobile menu Escape closes and returns focus.
- Not executed: backend integration, real wallet signature, two-user isolation, R2 download, on-chain verification, observed beta or final recording.
- Full cross-page mobile/theme matrix and injected network/quota failures remain pending; do not interpret the focused checks as full accessibility certification.
