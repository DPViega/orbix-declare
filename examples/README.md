# Exemplos públicos reproduzíveis

Três casos **sintéticos**, tirados do modo demonstração (`src/lib/api/mock.ts`, setembro de 2026). Servem para qualquer pessoa conferir como o Orbix Declare chega a cada número e para o back-end (`orbix-core`) ter um teste espelho com o mesmo resultado.

Nunca coloque aqui dados de testers ou de carteiras reais: endereço, saldo, transação ou print. Hashes e valores destes arquivos são fictícios.

| Caso | O que mostra | Resultado esperado |
|---|---|---|
| [`01-swap-stablecoin.json`](01-swap-stablecoin.json) | Venda de 12,4 SOL por USDC, preço automático (Birdeye), PTAX 5,4128 de 27/09 | valor R$ 11.284,00 · custo R$ 9.412,60 · ganho **R$ 1.871,40** |
| [`02-perp-funding.json`](02-perp-funding.json) | Fechamento de 150 HYPE-PERP e funding de 18,42 USDC na Hyperliquid | perp: ganho **R$ 932,50** · funding: ganho **R$ 99,83** |
| [`03-custo-informado.json`](03-custo-informado.json) | Venda de 2.400 JUP sem custo no histórico; a pessoa informa o custo com motivo e evidência | antes: custo desconhecido (zero), ganho R$ 7.416,00 · depois: custo R$ 6.524,40, ganho **R$ 891,60** |

Cada arquivo tem `input` (o evento como a API entrega e, no caso 3, a revisão enviada) e `expected` (os valores que a API deve devolver).

## Regras aplicadas

- Ganho = valor em reais − custo de aquisição. O custo vem do custo médio ponderado do ativo.
- Valor em reais = preço em dólar × PTAX de venda do Banco Central na data indicada.
- Custo desconhecido entra como zero e vira pendência até ser informado. A revisão registra o custo anterior e o novo.
- A isenção de R$ 35 mil por mês vale só para vendas à vista (spot); perp e funding não entram nela.
- Taxas aparecem separadas (`feesBrl`) e não entram no ganho nestes exemplos.

## Como reproduzir

**Conferência automática** (compara os três arquivos com o modo demonstração):

```bash
npx tsx examples/verify-demo.ts
```

A saída lista cada valor com `ok` ou `FAIL` e termina com código 1 se algo divergir.

**Na interface:**

1. Rode `npm run dev` sem `NEXT_PUBLIC_API_URL` e entre em **modo demonstração**.
2. No **Painel**, escolha **Setembro 2026** e clique no ativo do evento para abrir os detalhes (casos 1 e 2).
3. Para o caso 3, abra **Relatórios → Setembro 2026**. Em "Cobertura e validação → Revisões disponíveis", use **Registrar custo** na venda de JUP, informe **6524,40** com motivo e evidência e confirme. O ganho do evento e o total do mês são recalculados.
4. Em **Relatórios → Setembro 2026 → Pacote para revisão**, o CSV traz os mesmos valores com fonte do preço, PTAX, transação e versão da regra.

## Teste espelho no back-end

O `orbix-core` deve ter um teste por caso em `tests/`, com a mesma entrada e o mesmo resultado. Se o motor mudar uma regra e um número mudar, atualize o exemplo e o teste juntos, explicando a mudança no commit.
