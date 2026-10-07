# Competitividade · o que já temos e o que falta

**Data:** 07/10/2026 (atualizado à noite, depois das entregas do front)
**Base:** seção "O que aumenta competitividade — e quanto acrescenta" do Hub, cruzada com o código de `orbix-declare` (front) e `orbix-core` (back), na versão da branch principal de hoje.
**Uso:** as tarefas do front da seção 4 estão feitas. O Erik pega as tarefas do back amanhã (08/10).

Legenda: 🟢 já temos · 🟡 temos em parte · 🔴 não temos

---

## 1. Visão geral

| # | Entrega | Situação | Front | Precisa do back? |
|---|---|---|---|---|
| P0 | Cobertura e reimportação | 🟢 | Pronto; falta o teste de aceite | Não |
| P0 | Origem de cada número | 🟡 | Pronto para os campos que existem | Sim: custo médio e quantidade recebida |
| P0 | Uma pendência resolvível | 🟢 | Pronto; falta o teste de aceite com caso real | Não |
| P0 | Pacote para revisão | 🟢 | **Feito (07/10)**: CSV de 21 colunas + leia-me | Opcional: versão congelada no R2 |
| P0 | Testes observados e medição | 🟡 | **Roteiro e planilha prontos (07/10)**; falta aplicar | Não |
| P1 | Explicação contextual com IA | 🟡 | **Fallback por regras feito (07/10)** | Recomendado: fallback também na API |
| P1 | Hash verificável em devnet | 🟡 | Só testar | Sim: abastecer a carteira de memo |
| P1 | Exemplos públicos reproduzíveis | 🟡 | **Feito (07/10)**: `examples/` + verificação automática | Sim: teste espelho no back |

Pré-requisito de confiança para tudo acima: corrigir **B7** (eventos misturados) e **B10** (custo zero com USDH) do relatório de testes. Sem isso, "Origem de cada número" e o pacote para revisão mostram números errados com muita clareza.

---

## 2. Item por item

### P0 · Cobertura e reimportação 🟢
**Pronto quando:** reimportar não duplica; período importado e lacunas ficam visíveis; sem indexador próprio.

- **Back (já tem):**
  - restrição única `events (wallet_id, tx_hash, event_index)` com `on conflict` em `ingest/sync.py`;
  - cada leitura grava em `ingestion_runs` (`complete`, `partial`, `failed`);
  - o relatório devolve `review.coverage` (`state`, `importedFrom`, `importedThrough`, `importedEvents`) e `review.limitations`.
- **Front (já tem):**
  - período importado e limitações na página do relatório;
  - aviso destacado de histórico parcial (commit `b2b58bc`);
  - cobertura e limitações também no leia-me do pacote para revisão.
- **Falta:** só o teste de aceite.
  1. Sincronizar a mesma carteira duas vezes e confirmar que o número de eventos não muda.
  2. Importar a carteira de paginação e confirmar `coverage.state = partial` com a limitação explicada, se ela bater no limite.

### P0 · Origem de cada número 🟡
**Pronto quando:** abrir uma linha mostra evidências e versão da regra; custo ou preço ausente aparece como pendência.

- **Já tem:** o detalhe do evento (`components/event-dialog.tsx`) mostra:
  - transação com link;
  - preço unitário e fonte do preço;
  - PTAX e data, horário da cotação;
  - versão da regra (`br-2026.1`);
  - taxas, custo e ganho;
  - pendências e histórico de revisões.

  O CSV do pacote leva os mesmos campos por linha.
- **Falta (back):**
  1. **Quantidade recebida no swap.** Hoje a API manda só o lado que saiu (`quantity`, `quantityAsset`). A pessoa vê "393,81 USDC" e não vê "10 HYPE".
  2. **De onde veio o custo.** O motor usa custo médio ponderado, mas a API não mostra a conta. Sem isso, o custo é o único número sem origem visível.
- **Front depois:** exibir os dois lados ("Comprou 10 HYPE a US$ 39,381 · pagou 393,81 USDC") e a composição do custo, assim que os campos existirem. Também acrescentar essas colunas ao CSV do pacote.

### P0 · Uma pendência resolvível 🟢
**Pronto quando:** um tipo (custo de aquisição ausente), informado com evidência e confirmação; antes e depois registrados; recálculo.

- **Back (já tem):**
  - `PUT /api/events/:id/cost` com `costBrl`, `reason`, `evidence` e `confirmed`;
  - trigger de auditoria em `event_reviews`;
  - recálculo do ganho, com a linha passando a `costManual`.
- **Front (já tem):** formulário de revisão de custo e histórico de revisões no detalhe. O exemplo [`examples/03-custo-informado.json`](../examples/03-custo-informado.json) documenta o antes e o depois.
- **Falta:** teste de aceite com um caso real, por exemplo a venda de UBTC de 03/06 ou um evento com `costUnknown`:
  1. informar o custo com evidência;
  2. conferir o histórico com o valor anterior e o novo;
  3. ver o ganho recalculado no painel e no relatório.

### P0 · Pacote para revisão 🟢 (front feito em 07/10)
**Pronto quando:** CSV de revisão + fontes + pendências + escopo. Sem painel multiempresa.

**Feito no front:**
- **Onde:** botão **Pacote para revisão** em *Relatórios → mês* (`src/lib/review-package.ts`).
- **De onde vêm os dados:** gerado no navegador a partir de `GET /api/report/:month` e `GET /api/events?month=`, juntando linha e evento pelo mesmo `id`.
- **O que baixa:**
  1. `orbix-declare-AAAA-MM-revisao.csv` com as 21 colunas: data (Brasília), rede, carteira, tipo, ativo, quantidade, unidade, preço unitário (R$), fonte do preço, PTAX, data da PTAX, valor (R$), custo (R$), ganho (R$), taxas (R$), custo desconhecido, custo informado, pendências, transação, link do explorer, versão da regra.
  2. `orbix-declare-AAAA-MM-leia-me.md` com situação do relatório, totais, período importado e cobertura (com aviso se parcial), limitações, operações não suportadas, pendências abertas (do relatório e de cada evento), regras adotadas (custo médio, isenção de R$ 35 mil só em spot, PTAX de venda) e o aviso de que é estimativa para revisão profissional, não declaração transmitida.
- **Cuidados atendidos:**
  - células de texto que começam com `=`, `+`, `-` ou `@` são neutralizadas;
  - rascunho leva `-rascunho` no nome dos arquivos;
  - BOM para o Excel abrir os acentos;
  - arquivos no idioma da interface.
- **Verificado:** Edge headless, setembro (final) e outubro (rascunho), CSV com 21 colunas em todas as linhas.

**Opcional depois (back):** gerar o mesmo pacote na finalização e guardá-lo no R2 junto do CSV, para ficar congelado com o hash.

### P0 · Testes observados e medição 🟡 (roteiro pronto em 07/10)
**Pronto quando:** 5 usuários e 1 contador; antes e depois no mesmo recorte.

**Feito:**
- **Roteiro** em [`docs/TESTE_USUARIOS.md`](TESTE_USUARIOS.md): a mesma tarefa para todos ("declarar o mês X"), primeiro do jeito atual e depois com o Orbix. Mede o tempo até o relatório (com marcos de login e painel), dúvidas, erros, pendências resolvidas e confiança de 1 a 5.
- **Sessão do contador:** feita a partir do pacote para revisão.
- **Planilha** em [`docs/teste-usuarios-registro.csv`](teste-usuarios-registro.csv), com uma linha por participante (P1–P5, C1).
- **Privacidade:** código no lugar do nome, nunca endereço completo, saldo ou print sem borrar, e gravação só com autorização registrada.

**Falta:** aplicar as sessões e consolidar os números. Na submissão, usar só números medidos, com o tamanho da amostra.

### P1 · Explicação contextual com IA 🟡 (fallback do front feito em 07/10)
**Pronto quando:** só com base estável e créditos confirmados. Sem saldo, explicação por regras identificada como tal; sem simular IA ao vivo.

- **Back (já tem):** agente com resposta estruturada, citações montadas pelo servidor e cota por usuário. Quando a IA não está disponível, a API devolve `503 agent_unavailable`, sem alternativa.
- **Front (feito):** **explicação automática por regras** (`src/components/rules-explanation.tsx`).
  - **Quando aparece:** quando vem `503` ou `429`. Com a cota já zerada, há o botão "Ver explicação por regras".
  - **Rótulo:** "Regras, não IA", com outro visual, sem imitar o agente.
  - **Como funciona:** a pessoa escolhe o evento do mês e lê o texto montado só com os campos dele: "Você vendeu {quantidade} {unidade} ({ativo}) em {data}. Preço: {preço} ({fonte}), PTAX {ptax} de {data}. Valor: {valor}. Custo: {custo} ({informado / desconhecido / pelo custo médio}). Ganho: {ganho}. Regra {versão}." Campo ausente vira "não informado".
- **Back (recomendado):** o mesmo fallback na própria API, para o resultado ser igual em qualquer cliente.

### P1 · Hash verificável em devnet 🟡
**Pronto quando:** arquivo alterado falha na comparação; indicar devnet; hash não certifica correção fiscal.

- **Back (já tem):** atestação por memo na Solana (`attest/memo.py`) e rota pública `GET /api/verify/:publicId`.
- **Front (já tem):** página `/v/[id]` calcula o SHA-256 do arquivo enviado e compara (`verify-view.tsx`).
- **Bloqueio:** a carteira de memo está sem SOL na devnet, então a transação não é gravada e `attestation` fica `null` (`docs/STATUS.md`).
- **Falta:**
  1. Back: abastecer a carteira de memo pelo faucet e confirmar uma atestação real.
  2. Teste: alterar um caractere do CSV final e confirmar que a verificação falha.
  3. Front: conferir que a página mostra "devnet" e a frase "o hash prova que o arquivo não mudou, não que o cálculo está correto".

### P1 · Exemplos públicos reproduzíveis 🟡 (front feito em 07/10)
**Pronto quando:** fixtures sintéticas e README; nunca dados pessoais de testers; só após fluxo estável.

- **Front (feito):** pasta [`examples/`](../examples/) com 3 casos sintéticos de setembro de 2026 do modo demonstração, cada um com `input` e `expected`:
  1. swap com stablecoin (12,4 SOL → USDC, ganho R$ 1.871,40);
  2. perp com funding (HYPE-PERP, ganho R$ 932,50, e funding de R$ 99,64);
  3. venda com custo informado (2.400 JUP: ganho de R$ 7.416,00 com custo desconhecido, depois R$ 891,60).

  O README traz as regras e o passo a passo na interface. `npx tsx examples/verify-demo.ts` confere os 24 valores contra o modo demonstração (24/24 ok).
- **Back amanhã:** o mesmo caso como teste automatizado em `tests/`, garantindo que o motor dá o resultado do README.

---

## 3. Tarefas do back para amanhã (Erik)

Ordem sugerida, da maior para a menor prioridade.

| # | Tarefa | Onde mexer | Pronto quando |
|---|---|---|---|
| 1 | **B7**: incluir o par na chave do fill também quando o hash é real | `src/orbix/ingest/hyperliquid.py`, função `_fill_key` (retornar `hash + ":" + coin`) | Nenhum evento com "+" no ativo; caso de 03/04 vira eventos separados |
| 2 | **B10**: stablecoins da Hyperliquid | `src/orbix/ingest/models.py`, `STABLE_ASSETS["hyperliquid"]`: incluir USDH e demais confirmadas pelo `spotMeta` | USDH → USDC com ganho perto de zero |
| 3 | **Quantidade recebida no swap** | `schemas.py` (`TaxEventOut`): campos novos `quantityIn` e `quantityInAsset`, preenchidos a partir da perna `swap_in` em `tax/service.py` | Evento de 30/04 mostra 10 HYPE e 393,81 USDC |
| 4 | **Origem do custo** | `TaxEventOut`: `avgCostUnitBrl` (custo médio por unidade usado) e `positionBeforeQty` (posição antes da venda); preencher no motor (`tax/engine.py`) | Custo do evento = quantidade × custo médio exibido |
| 5 | **Carteira de memo** | Faucet da devnet para o endereço da carteira de memo | Relatório finalizado com `attestation` preenchida |
| 6 | **Fallback do agente** (recomendado) | `routers/agent.py`: em vez de 503, responder com explicação por regras marcada `source: "rules"` | Agente sem créditos ainda responde, identificado como regras |
| 7 | **Teste espelho dos exemplos** | `tests/`: um teste por caso de [`examples/`](../examples/) | Motor dá exatamente o resultado do README |
| 8 | **Pacote congelado** (opcional) | `reports/files.py`: gerar o CSV de revisão e o leia-me na finalização e subir ao R2, com as mesmas 21 colunas do front | Pacote baixado do relatório final igual ao da tela |

Itens do relatório de testes que continuam no back e não estão acima: B4 (coluna de taxa no CSV), B5 (migração da view `monthly_summary` em America/Sao_Paulo), B6 (custo do UBTC), B8 (confirmar duplicadas pelo `tid`), B9 (contraparte), B11 (rede e carteira no CSV) e a contagem de fills por evento. B4 e B11 já estão cobertos no CSV do pacote para revisão do front, mas não no CSV oficial com hash.

## 4. Tarefas do front (Filipe)

| # | Tarefa | Situação |
|---|---|---|
| 1 | Pacote para revisão (CSV detalhado + leia-me), a partir de `/api/report/:month` e `/api/events?month=` | ✅ feito em 07/10 |
| 2 | Explicação automática por regras quando o agente responder 503 ou 429 | ✅ feito em 07/10 |
| 3 | Pasta `examples/` com casos sintéticos, README e verificação automática | ✅ feito em 07/10 |
| 4 | Roteiro e planilha de testes com usuários | ✅ feito em 07/10; aplicar as sessões |
| 5 | Testes de aceite: reimportação sem duplicar, pendência de custo resolvida, verificação de hash com arquivo alterado | ⏳ depende do back em produção (e da carteira de memo para o hash) |
| 6 | Correções F1–F4 do relatório de testes: preço unitário de token barato, arquivo de transferências no pacote, aviso de linha sem evidência e texto próprio de transferência e funding | ✅ feito em 07/10 (ver `RELATORIO_DESENVOLVIMENTO.md` 9.7); direção e contraparte da transferência dependem do B9 |

Quando o back publicar os campos `quantityIn`, `quantityInAsset`, `avgCostUnitBrl` e `positionBeforeQty`, o front exibe os dois lados da troca e a composição do custo no detalhe do evento e no CSV do pacote.
