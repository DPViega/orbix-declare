# Relatório da rodada A1–A6 · front-end

**Data:** 07/10/2026
**Repositório:** `orbix-declare` (front) — `D:\Orbix Lab\Hackaton\Sys-Front-test`
**Base das tarefas:** `FRONT_TAREFAS_E_TESTES.md`, seções 1 e 2
**Execução:** Time Sistema #2 no Maestri, orquestrado por Sacan
**Commit de partida:** `ec807b8` · **nenhum commit feito nesta rodada**

> **Escopo: só o front.** Nada neste relatório toca o `orbix-core`. Lógica fiscal, rotas
> `/api/*`, motor de cálculo, migrações e carteira de memo pertencem ao back, em outro
> repositório. Onde uma tarefa depende do back, ela aparece como dependência — nunca como
> trabalho feito.

---

## 1. Resumo

Seis tarefas de implementação (A1 a A6) e dois testes (T1, T6) fechados. As frentes de teste
que dependiam apenas de leitura de código também foram cobertas. O restante da seção 2 e a
seção 3 inteira continuam abertas, pelos motivos da parte 6.

| Indicador | Resultado |
|---|---|
| Arquivos modificados | 10 |
| Linhas | +362 / −20 |
| `npm run check` | passou limpo (compile 50s, TypeScript 7,7s, 12/12 páginas) |
| `npx tsx examples/verify-demo.ts` | 24/24, esperados intactos |
| Paridade i18n | 582 chaves em `pt.ts`, 582 em `en.ts`, zero divergência |
| Commits | nenhum |
| Resíduo na árvore | nenhum |

---

## 2. O que foi feito

### Contrato (pré-requisito de tudo)

`src/lib/api/types.ts` — cinco campos **opcionais** em `TaxEvent`, com JSDoc das regras de
null: `quantityIn`, `quantityInAsset`, `positionBeforeQty`, `avgCostUnitBrl`, `fillCount`.
`ReportRow` **não** recebeu os campos: o CSV de revisão já faz join por `id` com `TaxEvent`.

### A1 · Dois lados da troca

- `src/components/event-dialog.tsx` — campo "Dois lados da troca" na seção Valores.
- `src/app/(app)/painel/dashboard-view.tsx` — sub-linha na coluna Quantidade.
- **Aceite atingido:** o evento de 30/04 mostra `Comprou 10 HYPE · pagou 393,81 USDC`.
- Fora de swap, ou em rota com mais de um ativo de entrada, a linha **some** — não exibe
  "Indisponível".

### A2 · Origem do custo

- `event-dialog.tsx` — seção nova "Origem do custo": posição antes da venda, custo médio
  por unidade e a conta (`393,81 USDC × R$ 5,1495 ≈ R$ 2.027,92`), com nota de arredondamento.
- `src/components/rules-explanation.tsx` — mesma informação na explicação por regras.
- `costBrl` continua autoritativo: a tela formata, nunca substitui pelo produto calculado,
  e nenhum texto promete igualdade exata ao centavo.

### A3 · Número de fills

`event-dialog.tsx` (campo "Execuções") e `dashboard-view.tsx` (coluna Ativo). Aparece
`N fills` **somente** quando `fillCount > 1`.

### A4 · Campos novos no pacote de revisão

`src/lib/review-package.ts` — de 21 para **26 colunas**, as cinco novas no fim, na ordem e
formatos especificados: quantidade recebida (12 casas), unidade recebida (texto), posição
anterior (12 casas), custo unitário médio (10 casas) e número de fills como **inteiro puro**
(não `"2 fills"`), para o contador filtrar, somar e ordenar na planilha.

### A5 · "Gerar DeCripto: em breve"

`src/app/(app)/relatorios/[mes]/page.tsx` mais i18n. Texto **visível sem passar o mouse**
(não é `title` nem tooltip) e com link que dispara o download do pacote de revisão. Texto PT
e EN conferidos **byte a byte** contra o arquivo de tarefas: idênticos.

### A6 · Modo demonstração e CSV oficial

- `src/lib/api/mock.ts` — os cinco campos nos eventos; `qtyIn` e `fills` nos swaps; `null`
  em perp, funding e transferência. Abril **não existia** no mock: foi criado como fixture
  isolada (30/04, 393,81 USDC para 10 HYPE), sem encostar nos 24 valores que o `verify-demo`
  protege.
- `src/lib/report-file.ts` — cabeçalho de **13 colunas**, exatamente o especificado;
  `taxas_brl`, `rede` e `carteira` por join com `TaxEvent`; rascunho termina em `total`;
  relatório final ganha `verificacao,<64 hex>` seguida de 11 vírgulas; `rascunho,sim`
  eliminada.

### T1 · Excel PT-BR (risco confirmado e corrigido)

O código fixava vírgula como separador e ponto decimal. No Windows pt-BR o separador de
lista é `;`, então o Excel abria tudo na coluna A. O BOM que já existia resolve acento, não
separador. Corrigido em `review-package.ts`, condicionado ao idioma da interface:

| Idioma | Separador | Decimal |
|---|---|---|
| PT | `;` | vírgula |
| EN | `,` | ponto |

Números saem sem aspas. Vale também para o arquivo de transferências. O **CSV oficial de 13
colunas não mudou**: continua com vírgula e ponto, para o hash seguir determinístico.

### T6 · Explicação por regras

Rótulo "Regras, não IA" / "Rules, not AI" confirmado. Texto de transferência **sem** as
palavras "custo" e "ganho" (e sem "cost"/"gain" em EN), nos dois idiomas.

---

## 3. Verificação independente

Nada aqui é relato de agente repassado. Tudo abaixo foi executado e conferido direto no código.

1. **Build completo** — `npm run check`: limpo, zero erro e zero warning.
2. **`verify-demo`** — "Todos os exemplos batem com o modo demonstração", 24/24.
3. **Paridade i18n** — script próprio comparando a árvore de chaves nos dois sentidos,
   incluindo as antigas: 582 por 582, nenhuma chave órfã, nenhum tipo divergente.
4. **Texto da A5** — concatenação das três chaves comparada byte a byte: idêntica em PT e EN.
5. **T6** — funções do dicionário executadas e o texto resultante inspecionado.
6. **Guardas de null** — auditoria linha a linha dos cinco campos. Todas usam
   `typeof x === "number"`; `quantityInAsset` usa `!!`, cobrindo string vazia; a conta do
   custo exige `!costUnknown && costBrl > 0 && avgCostUnitBrl > 0`. Busca pelo anti-padrão
   `{numero && ...}` (que imprime `0` na tela): **zero ocorrências**.
7. **Higiene** — `git status` com exatamente os 10 arquivos pretendidos, nenhum arquivo solto.

---

## 4. Divergências entre especificação e implementação (resolvidas)

Lente especificou os leiautes e Pixel implementou em paralelo, sem se verem. O cruzamento
achou quatro divergências:

| Item | Especificado | Implementado | Decisão |
|---|---|---|---|
| `taxas_brl` ausente | `0.00` | vazio | **vazio** — distingue "sem dado" de "taxa zero", o que num arquivo de auditoria importa |
| Linha `total`, posição 10 | vazia | soma das taxas | mantida a soma |
| `preco_manual` e `custo_desconhecido` | `sim`/`não` | `sim`/`nao` | mantido sem acento no CSV oficial; o de revisão usa o dicionário |
| Regex do hash | só minúsculo | aceita maiúsculo | irrelevante: `sha256Hex` já produz minúsculo |

---

## 5. Falso alarme registrado

Foi levantada a suspeita de que `reportToCsv` passou a lançar exceção num caminho que antes
nunca lançava. Investigação dos chamadores: existe **um só**, em
`relatorios/[mes]/page.tsx:118`, dentro de `if (config.useMocks || isDemoSession())`. No modo
real o CSV vem do back por link assinado (`api.reportCsv`). Caminho exclusivo da demonstração.
**Não há regressão.** Fica registrado para ninguém reabrir.

---

## 6. O que falta — front

Nada abaixo está bloqueado por código. Está bloqueado por precisar de pessoa, aplicativo
instalado ou serviço no ar.

| # | Item | Por que não fechou |
|---|---|---|
| T1 | Abrir o CSV no Excel PT-BR com dois cliques | validado com parser próprio; **ninguém abriu um Excel instalado de verdade** |
| T2 | Login com Phantom e Solflare, localhost e produção (4 combinações) | exige extensão de carteira e interação humana |
| T3 | Hash com arquivo alterado | depende de relatório finalizado com atestação |
| T4 | Atestação na devnet | **bloqueado:** carteira de memo sem SOL |
| T5 | Contagem de ordens contra a API da Hyperliquid | comandos PowerShell prontos no arquivo de tarefas |
| T7 | Celular real | emulado a 390px por iframe, sem overflow; falta aparelho |
| — | Sessões de teste com 5 usuários e 1 contador | roteiro e planilha prontos desde 07/10; falta aplicar |

---

## 7. O que falta — back (não é nosso)

Listado só para fechar o quadro. **Nada disto foi tocado nesta rodada.**

- **R1 a R14** (seção 3 do arquivo de tarefas) dependem do deploy da migração 0006.
  Antes do deploy é preciso anotar os custos informados à mão: a migração apaga os eventos
  da Hyperliquid com hash zerado e relê as carteiras desde o início.
- **B7** (eventos misturados) e **B10** (custo zero com USDH) são pré-requisito de confiança:
  sem eles, "origem de cada número" e o pacote para revisão mostram números errados com
  muita clareza.
- **Carteira de memo** precisa de SOL no faucet da devnet para destravar T3 e T4.

### Ponto de atenção que não estava registrado em lugar nenhum

O cabeçalho de 13 colunas da A6 vale **apenas para o CSV da demonstração**. O CSV oficial
com hash é gerado pelo back. O teste **R5** ("qualquer CSV novo: 13 colunas, com `taxas_brl`,
`rede` e `carteira` preenchidas") **não passa** enquanto o `orbix-core` não aplicar o mesmo
cabeçalho (tarefas B4 e B11). Vale avisar o Erik.

---

## 8. Decisão pendente

**Bug pré-existente, fora do escopo A1–A6.** No evento de custo desconhecido, a seção
Pendências mostra "Nenhuma pendência. Este evento já entra no relatório." junto com o bullet
"Custo de aquisição não encontrado no histórico lido". A causa é `missingCost` testar
`costBrl == null` quando o valor é `0`. Consertar exige decidir se `0` com pendência conta
como custo ausente. Aguardando decisão.

---

## 9. Estado do repositório

Árvore limpa de resíduos, **nenhum commit**. Modificados:

```
src/app/(app)/painel/dashboard-view.tsx
src/app/(app)/relatorios/[mes]/page.tsx
src/components/event-dialog.tsx
src/components/rules-explanation.tsx
src/lib/api/mock.ts
src/lib/api/types.ts
src/lib/i18n/messages/en.ts
src/lib/i18n/messages/pt.ts
src/lib/report-file.ts
src/lib/review-package.ts
```

---

## 10. Execução e incidentes

| Agente | Papel | Entregou |
|---|---|---|
| Forja #2 | contrato | `types.ts` |
| Lente #2 | leiaute dos CSV e análise do T1 | especificação |
| Pixel #2 | camada de dados | `mock.ts`, `report-file.ts`, `review-package.ts` |
| Tinta #2 | interface | 4 componentes e os dois dicionários |
| Radar #2 | QA | **não executou** |

**Radar #2 caiu.** Provedor fora do ar: `Upstream request failed: Endpoint is unavailable`
(Exo Free / OpenCode Zen). O QA da fase 1 foi feito pelo orquestrador e está na seção 3
deste relatório. A fase 2 (navegador, Excel, celular) segue pendente. Para recuperá-lo,
trocar o modelo com `maestri recruit --replace`, o que preserva conexões e rotinas.

**Infraestrutura:** o sandbox dos agentes bloqueia o executável do Maestri e o diretório do
projeto fica fora do workspace deles, o que gerou um pedido de permissão por comando durante
toda a rodada. Liberar `maestri.exe` e o caminho do projeto no sandbox elimina esse atrito
na próxima.
