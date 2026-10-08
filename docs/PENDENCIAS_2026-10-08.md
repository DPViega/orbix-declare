# Pendências do front — implementação de 08/10/2026

Base: `FRONT_PENDENCIAS.md`, de 07/10/2026 às 22:20. Alterações locais, sem commit ou deploy. As alterações anteriores de A1–A6 foram preservadas.

## Correções

| Item | Implementação |
| --- | --- |
| F11 | Comparação do arquivo compartilhada entre título e upload. Sem arquivo: estado neutro. Original: verde. Alterado: vermelho, sem selo verde. Uma nova leitura limpa o resultado anterior; respostas de leituras antigas são descartadas. Erro de leitura tem mensagem própria. |
| F10 | Histórico de custo usa `previousCostBrl`/`newCostBrl` e rótulo Custo. Valor anterior ausente vira Pendente. Histórico de preço mantém precisão adaptativa. |
| F12 | Rede da atestação visível na página pública; ressalva do hash em PT/EN. Explorer da atestação usa a mesma rede indicada. |
| F9 | `plain()` limita a saída a 15 algarismos significativos, respeitando o limite decimal de cada campo. `39482.24168` e `10362.03` não expõem cauda binária. |
| F8 | Indicadores opcionais no evento têm prioridade. Na API antiga, o detalhe busca a linha do relatório pelo id; o mês usa Brasília. Custo zero não é inferido como desconhecido. Pendências impedem “Nenhuma pendência” e levam ao relatório para correção. Falha/carregamento da consulta não confirma ausência de pendências. |
| U1 | Quantidade e PTAX recebem mais largura; tabela mantém rolagem interna no celular. |
| U2 | Botão renomeado para CSV do relatório / Report CSV. |
| U3 | Aviso de bloqueio depende de cobertura/dados incompletos ou pendências/operações não suportadas; não aparece só porque DeCripto ainda está indisponível. |
| U4 | Pacote para revisão recebe destaque. DeCripto usa contorno e etiqueta em breve quando o leiaute não está disponível. |
| D1 | Célula de taxas na linha total do CSV oficial fica vazia. |
| D2 | CSV oficial usa 4 primeiros + … + 4 últimos caracteres da carteira. O pacote de revisão preserva endereço completo. |

## Decisões de integração

- `eventCost()` centraliza a precedência: indicador do evento, indicador da linha do relatório, fallback legado de custo ausente/histórico manual. Não depende de alteração do back para F8.
- `NEXT_PUBLIC_ATTESTATION_CLUSTER` define a rede do registro fiscal; padrão **devnet**, conforme o ambiente descrito nas pendências. É independente de `NEXT_PUBLIC_SOLANA_CLUSTER`, usado para transações das carteiras. Quando o registro fiscal migrar de rede, configurar explicitamente a variável e reconstruir o front. Não alterar a rede apenas no rótulo.
- O hash da demonstração continua calculado sobre os bytes completos do CSV, incluindo o rodapé. D1/D2 mudam o arquivo e, portanto, o hash correspondente, sem modificar o algoritmo.
- B13 (`custo_informado` no CSV oficial) não foi presumido: depende de confirmação do contrato do back. O cabeçalho continua com 13 colunas.

## Validação automatizada

- `npm run check`: **PASSOU**, código 0; typecheck, lint e build (54s de compilação, 11,9s de TypeScript, 12 páginas).
- `npx tsx examples/verify-demo.ts`: **24/24 OK**, valores originais preservados.
- `npx tsx examples/verify-pendencias.ts`: indicadores de custo, fuso, quantidades PT/EN, 13/26 colunas, carteira abreviada, total vazio e hashes original/alterado.
- `node examples/verify-pendencias-browser.mjs`: Chromium, respostas de API fictícias interceptadas, sem login real ou chamadas à produção. Verifica PT/EN, uploads original/alterado, ausência de verde no erro, devnet, ressalva, detalhe com custo desconhecido via fallback, histórico de custo, relatório e largura móvel de 390 px.

Para o teste de navegador, iniciar um servidor local na porta 3107 com `NEXT_PUBLIC_API_URL=http://127.0.0.1:3107/qa`, `NEXT_PUBLIC_USE_MOCKS=false` e `NEXT_PUBLIC_ATTESTATION_CLUSTER=devnet`. Usar Playwright instalado à parte via `PLAYWRIGHT_MODULE` (URL file do index.mjs), se não disponível no projeto; `QA_CHROMIUM` pode apontar para o executável Chromium instalado. Nenhuma dependência foi adicionada ao package.json.

Ambas as suítes de regressão passaram. O navegador também confirmou separação geométrica entre quantidade e PTAX, destaque do pacote, DeCripto desabilitado em contorno e alternância do aviso de bloqueio em PT/EN. `git diff --check` passou. Os testes usam apenas dados fictícios; não certificam cálculos ou integração com o back em produção.

## Validações externas ainda pendentes

- T7 foi coberto localmente em viewport móvel; aparelho físico/produção não foram usados.
- T6 com dados reais e indisponibilidade da IA não foi executado em produção.
- R8 exige sincronizar duas vezes uma carteira de teste e comparar a contagem.
- T2 exige Solflare e assinatura pelo titular; localhost depende do CORS do back.
- Isenção de R$ 35 mil requer um caso real adequado; o motor fiscal não foi alterado.
- R14/R4 dependem do contrato e deploy do back com os campos reais preenchidos.
- R13 exige operações novas de swap/staking pelo titular. Nenhuma transação foi realizada.
- Não usar o relatório real de junho com custo fictício nem endereços de terceiros em material público.
