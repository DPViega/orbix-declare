# Teste com usuários · roteiro e medição

**Meta:** 5 pessoas que operam cripto e 1 contador. Todas fazem a mesma tarefa, no mesmo recorte, primeiro do jeito que fazem hoje e depois com o Orbix Declare.
**Registro:** [`teste-usuarios-registro.csv`](teste-usuarios-registro.csv). Abra no Excel ou no Google Sheets: separador vírgula, uma linha por sessão.
**Quem observa:** cronometra e anota. Nada é medido dentro do app nesta rodada.

## 1. Privacidade (antes de tudo)

- Participante vira um código (`P1` a `P5`, `C1` para o contador). Nome e contato ficam fora da planilha e fora do repositório.
- Nunca anote endereço completo, saldo, valores reais ou hash de transação. Se precisar citar uma carteira, use só os 4 primeiros e os 4 últimos caracteres.
- Print só com endereços e valores borrados. Gravação de tela só com autorização falada e registrada na coluna `autorizou_gravacao`.
- Se a pessoa preferir não usar a própria carteira, use o **modo demonstração** e marque `dados = demo`.

## 2. Preparação (10 min antes)

1. Escolha o recorte, **o mesmo para todos**: "declarar o mês de setembro de 2026" (ou o mês mais recente com operações da pessoa).
2. Abra [declare.orbixlab.com.br](https://declare.orbixlab.com.br/) numa janela anônima, para a pessoa ver a abertura e o login do zero.
3. Tenha o cronômetro, a planilha e este roteiro abertos.
4. Anote a versão testada (commit do deploy, visto na Vercel ou no GitHub) na coluna `versao`.

## 3. Roteiro da sessão (≈ 30 min)

**Abertura (2 min).** Leia em voz alta, sem explicar o produto:

> "Queremos ver como você declararia os impostos das suas operações de cripto de um mês. Não existe resposta certa, e é o produto que está sendo testado, não você. Pense em voz alta. Se travar, me diga o que esperava ver."

**Parte A · jeito atual (até 10 min).** Pergunte como a pessoa faz hoje (planilha, outro app, contador, não faz). Peça que mostre ou descreva o caminho até ter o valor do mês. Cronometre e preencha `metodo_atual` e `tempo_antes_min`. Se ela nunca fez, anote `nunca fez` e deixe o tempo em branco.

**Parte B · com o Orbix Declare (até 15 min).** A tarefa é sempre a mesma:

> "Use o Orbix Declare para chegar ao relatório do mês e me diga quanto você vendeu, quanto ganhou e se precisa pagar imposto."

O observador **não ajuda**, a não ser que a pessoa fique travada por 2 minutos. Nesse caso, ajude, anote o ponto em `travou_em` e conte como erro.

Marque o tempo quando a pessoa:

| Marco | Coluna |
|---|---|
| Entra (login concluído) | `t_login_min` |
| Chega ao painel com os números do mês | `t_painel_min` |
| Abre o relatório do mês e responde à tarefa | `tempo_orbix_min` |

Conte também:

- `duvidas`: cada pergunta ou "o que é isso?" em voz alta.
- `erros`: cada caminho errado que exigiu voltar, mais as ajudas do observador.
- `pendencias_resolvidas`: preços ou custos que a pessoa informou sozinha.

**Fechamento (3 min).** Faça as quatro perguntas e anote as respostas nas próprias palavras da pessoa:

1. "De 1 a 5, quanto você confia nos números que viu?" → `confianca_1a5`
2. "O que te deixou em dúvida?"
3. "Você mandaria esse relatório para o seu contador?" → `mandaria_ao_contador` (sim/não/talvez)
4. "O que faltou?"

## 4. Sessão com o contador

Mesmo roteiro, com a tarefa trocada por:

> "Este é o pacote que um cliente te mandaria. Diga se dá para revisar e declarar a partir dele e o que você pediria a mais."

Entregue o **Pacote para revisão** (CSV + leia-me) baixado de *Relatórios → mês → Pacote para revisão*. Anote o tempo até o contador conseguir conferir uma linha (preço, PTAX, custo e ganho), as colunas que ele procurou e não achou, e se aceitaria o pacote como está.

## 5. Como ler os resultados

- **Tempo:** compare `tempo_antes_min` com `tempo_orbix_min` só para quem tem um método atual. Use a mediana, não a média (5 pessoas é pouco).
- **Confiança:** mediana de `confianca_1a5`. Leia as notas 1 e 2 junto com os comentários.
- **Bloqueios:** agrupe `travou_em` por tela. Um ponto que travou 2 ou mais pessoas vira correção antes da gravação.
- **Contador:** o pacote passa se ele consegue conferir uma linha sem perguntar nada e diz que aceitaria.

Na submissão, use **só números medidos aqui**, com o tamanho da amostra ("mediana de 4 min em 5 pessoas"). Não extrapole.

## 6. Colunas da planilha

| Coluna | O que anotar |
|---|---|
| `participante` | Código: P1–P5 ou C1 |
| `perfil` | Ex.: "trader Hyperliquid semanal", "holder Solana", "contador" |
| `data` | AAAA-MM-DD |
| `versao` | Commit ou deploy testado |
| `dados` | `carteira propria` ou `demo` |
| `metodo_atual` | Planilha, outro app, contador, nunca fez |
| `tempo_antes_min` | Minutos até o valor do mês, do jeito atual |
| `t_login_min`, `t_painel_min`, `tempo_orbix_min` | Minutos desde o início da Parte B |
| `duvidas`, `erros` | Contagens |
| `pendencias_resolvidas` | Quantas pendências a pessoa resolveu sozinha |
| `travou_em` | Tela ou passo, separados por `;` |
| `confianca_1a5` | Nota de 1 a 5 |
| `mandaria_ao_contador` | sim, não ou talvez |
| `autorizou_gravacao` | sim ou não |
| `comentarios` | Frases da pessoa, sem dados pessoais |
