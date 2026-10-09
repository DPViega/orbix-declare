# B18-F — Plano e resultado da implementação

**Objetivo:** integrar Gerar nova versão ao relatório final desatualizado conforme a paste.

**Arquitetura:** `api.*` continua a entrada única. O back-end congela e versiona; o front mostra os totais retornados, envia a reemissão e reaproveita o polling de 5 segundos. O mock expõe a assinatura, sem motor de versionamento persistido.

**Tecnologias:** Next.js 16.3.8, React 19.2.8, TypeScript, Tailwind CSS 4, Playwright isolado em `.work/`.

## Restrições

- Apenas front. Sem alterações no back, banco, regras fiscais ou produção.
- POST autenticado sem corpo e timeout de 90 segundos.
- Campos novos opcionais para compatibilidade.
- Nenhum recálculo fiscal no navegador ou descarte de versão anterior.
- Textos PT/EN da paste; tokens e Button existentes.
- Sem commit, push, deploy, pitch ou inscrições.
- Guia instalado do Next `01-app/03-api-reference/01-directives/use-client.md` conferido antes de editar.

## Implementação

- [x] Escrever teste sintético PT/EN de aviso, POST, bloqueio, erros, nova versão, polling, legado e ausência de dados.
- [x] Adicionar version, outdated, currentTotals e previousVersions opcionais.
- [x] Adicionar api.reissueReport e assinatura compatível no mock.
- [x] Implementar aviso responsivo e handler com loading e bloqueio de ações concorrentes.
- [x] Atualizar os dados somente com a resposta do back; reutilizar polling existente.
- [x] Documentar rota, erros e imutabilidade em API_CONTRACT.md.

## Validação

- [x] npm run check: typecheck, lint e build passaram.
- [x] Exemplos de dados anteriores passaram.
- [x] Teste B18-F em build de produção local: PT/EN passaram, incluindo ganhos zero/negativos, 409/503, versão 2 e polling.
- [x] Regressão anterior de navegador passou em PT/EN.
- [x] Capturas desktop e mobile, claro/escuro, verificadas; sem overflow.
- [x] Detector de design sem apontamentos; git diff --check passou.
- [x] Relatório de entrega registrado em docs/B18_F_2026-10-09.md.

**Ressalva do teste de base:** a execução contra o código anterior parou antes de carregar o botão de CSV, por falha de hidratação/HMR no servidor dev. Portanto, não comprovou a falha esperada por ausência do botão. O build de produção local permitiu validar todos os casos de aceitação após a implementação. O teste pula a abertura via Escape antes de capturar a interface.

**Ainda pendente:** publicação autorizada e aceite com back real, incluindo CSV/hash/link público da versão anterior. Nenhuma falha do back foi demonstrada nesta rodada.

**Fora do escopo:** lista visual de previousVersions, aviso público superseded e mudanças de nome/ícone do agente.
