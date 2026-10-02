# Relatório de desenvolvimento — Front-end do Orbix Declare

**Projeto:** Orbix Declare · Orbix Lab
**Evento:** Crypto World's Fair Hackathon (Colosseum), 14/09–12/10/2026
**Escopo deste repositório:** somente o front-end
**Data deste relatório:** 01/10/2026

Este documento explica **como o front foi construído**, **por que** cada decisão foi tomada, **o que falta** e **como continuar**. Ele serve para quem vai integrar o back-end e para qualquer pessoa que assuma este código depois.

---

## 1. Ponto de partida

Os materiais abaixo registram a origem do projeto. Os HTMLs standalone e prints antigos foram removidos da árvore de trabalho; a referência visual atual está em [`BRAND_GUIDE.md`](BRAND_GUIDE.md) e na implementação.

O que existia antes do código:

| Material | Onde | Como foi usado |
|---|---|---|
| Mockups HTML tema claro e escuro (10 telas, 1440 px) | `docs/Orbix Declare - Claro/Escuro (standalone).html` | fonte da verdade visual |
| Componente da sidebar | `docs/Orbix Declare - Sidebar (standalone).html` | sidebar do app |
| Prints das telas | `docs/WhatsApp Image *.jpeg` | conferência rápida |
| Logo (CD roxo com check dourado) | extraído do bundle → `public/brand/` | marca e favicon |
| Dev Hub interno (orbix-lab-dev-hub-orbix-declare-264.vercel.app) | — | stack planejada, rotas da API e divisão front/back |

**Como os mockups foram lidos.** Os arquivos "standalone" são bundles (manifesto + template com assets em base64/gzip). Eles foram desempacotados com um script Node para ler o HTML, os estilos inline e o JavaScript de cada tela. Isso permitiu copiar **os valores exatos** em vez de estimar pelo print:

- os dois mapas de cores (`L` e `D` no script do mockup), que viraram os tokens em [`src/app/globals.css`](../src/app/globals.css);
- tamanhos, espaçamentos, raios (12 px), fontes e pesos de cada elemento;
- os dados de exemplo (carteiras, eventos, relatórios), que viraram o modo demonstração;
- os ícones (Phosphor, estilo regular), que viraram `@phosphor-icons/react`.

## 2. Stack e por quê

| Escolha | Motivo |
|---|---|
| **Next.js 16 (App Router) + React 19 + TypeScript** | stack definida no Hub. A versão 16 tem mudanças incompatíveis (por exemplo, `params` assíncrono), por isso a documentação local em `node_modules/next/dist/docs` foi lida antes de codar. |
| **Tailwind CSS 4** | stack do Hub. Os tokens do mockup viraram cores do tema (`bg-card`, `text-muted`, `border-line2`…). |
| **Solana Wallet Adapter** (`-react`, `-base`) | login com Phantom/Solflare. A lista de carteiras fica vazia porque o **Wallet Standard** detecta as carteiras sozinho, sem pacote por carteira. |
| **@phosphor-icons/react** | mesma família de ícones dos mockups. |
| **next-themes** | tema claro/escuro sem "piscar" no carregamento; segue o sistema por padrão. |
| **bs58** | codificar a assinatura da carteira para o back-end. |
| Sem biblioteca de dados (SWR/React Query) | o app é pequeno; um hook de ~50 linhas ([`use-api.ts`](../src/lib/use-api.ts)) cobre carregar, erro, recarregar e descartar respostas antigas. |
| Sem biblioteca de componentes | o visual é próprio e já estava desenhado; [`components/ui.tsx`](../src/components/ui.tsx) tem os poucos componentes necessários. |

**Supabase ficou fora do front de propósito.** Com o back-end separado, o front fala com **uma única API**. Se o back-end usar Supabase Auth, o token do Supabase pode ser o `token` da sessão sem nenhuma mudança aqui. Ver [`API_CONTRACT.md`](API_CONTRACT.md#autenticação-sign-in-with-solana).

## 3. Arquitetura

### 3.1 Uma porta para o back-end

```
Tela ──► api.* (src/lib/api/index.ts) ──┬─► httpApi  → fetch(NEXT_PUBLIC_API_URL + /api/...)
                                         └─► mockApi  → src/lib/api/mock.ts
```

- Nenhuma tela chama `fetch` direto.
- `httpApi` e `mockApi` têm **o mesmo tipo** (o TypeScript reclama se divergirem). Assim o modo demonstração não fica desatualizado em relação ao contrato.
- O modo demonstração liga sozinho quando `NEXT_PUBLIC_API_URL` está vazia. Por isso dá para clonar e rodar sem nada configurado, o que ajuda na avaliação do hackathon.

### 3.2 Sessão

- [`session.tsx`](../src/lib/session.tsx) guarda a sessão num store externo (`useSyncExternalStore`) ligado ao `localStorage`, com sincronização entre abas.
- No servidor a sessão é "desconhecida" (`loading`), o que evita diferença de hidratação.
- O layout da área logada ([`app-shell.tsx`](../src/components/app-shell.tsx)) redireciona para `/login?next=…` sem sessão. O `next` só aceita caminhos internos, para não virar *open redirect*.
- Um 401 de qualquer rota encerra a sessão.

### 3.3 Login com carteira

[`wallet-login.ts`](../src/lib/wallet-login.ts): conectar → pedir o nonce → assinar a mensagem → enviar para o back-end validar → guardar a sessão. Os erros da carteira (cancelado, janela fechada, carteira sem `signMessage`) viram mensagens em português. **A validação da assinatura é só do back-end.**

### 3.4 Verificação pública que não depende de confiança no servidor

A página `/v/<id>` recalcula o **SHA-256 do CSV no navegador** (`crypto.subtle`) e compara com o hash registrado. O arquivo não é enviado a lugar nenhum. É a parte mais "blockchain" do front e é demonstrável: no modo demo, o hash é calculado a partir do próprio CSV gerado, então baixar o CSV e arrastá-lo na página de verificação dá ✓, e alterar uma linha do arquivo dá ✗.

## 4. Fidelidade aos mockups

| Tela | Rota | Observações |
|---|---|---|
| 01 Login | `/login` | painel roxo e formulário iguais ao mockup. Acrescentado: seletor quando há mais de uma carteira instalada, mensagens por fase ("Assine a mensagem na carteira…") e o botão de modo demonstração (só aparece no modo demo). |
| 02 Sincronização | `/sincronizacao` | contador, barra geral, progresso por carteira e checklist. Acrescentado: barra indeterminada sem estimativa, estado "Tudo pronto." e erro com nova tentativa automática. |
| 03 Carteiras | `/carteiras` | card da carteira de login, formulário Hyperliquid com validação e tabela com ressincronização por linha. |
| 04 Painel | `/painel` | KPIs, barra do limite de isenção com marcador dourado em R$ 35.000, filtros e tabela. O seletor de mês funciona (`?mes=`). "Sem preço" abre o diálogo de preço manual. |
| 05 Relatórios | `/relatorios` | lista, selos Final/Rascunho e aviso de prazo calculado (último dia útil do mês seguinte). |
| 06 Relatório mensal | `/relatorios/AAAA-MM` | totais, tabela com linha de total, painel de verificação on-chain, copiar link, baixar CSV e gerar DeCripto. |
| 07 Agente IA | `/agente` | chat em blocos (texto, quadro de cálculo, citações), sugestões e painel "Relatório citado". |
| 08 Configurações | `/configuracoes` | plano, carteiras com remoção em duas etapas e zona de perigo com confirmação digitada ("EXCLUIR"). Acrescentado: escolha de tema. |
| 09 Estados | — | integrados nas telas onde acontecem, em vez de uma tela própria. |
| 10 Verificação | `/v/<id>` | igual ao mockup e com a conferência de arquivo funcionando. |

**Além do mockup (feito para ser um produto, não uma imagem):** layout responsivo (os mockups só têm 1440 px), esqueletos de carregamento, foco visível no teclado, `aria-*` em navegação, abas, barras e diálogos, `prefers-reduced-motion`, seleção de texto e scrollbar no tom da marca, página 404 e tela de erro.

**Desvio consciente:** o mockup do Painel mostra "R$ 28.948,13" em um print e "R$ 28.940,13" no HTML. Seguimos o HTML, cuja soma dos eventos fecha com os totais do relatório (R$ 28.940,13 − R$ 24.757,77 = R$ 4.182,36).

## 5. Como foi verificado

As verificações abaixo registram a implementação inicial, antes da atualização visual de 01/10. Não representam uma nova validação visual das animações e modelos 3D; veja a seção 9 para o estado atual.

- `npm run typecheck`: sem erros.
- `npm run lint`: sem erros, incluindo as regras novas do React 19 (sem `setState` síncrono em efeitos).
- `npm run build`: build de produção sem erros (12 rotas).
- **Navegação real** com o Edge headless (Puppeteer) em todas as telas, temas claro e escuro, em 1440 × 900 e 390 × 844 (mobile):
  - sem erros no console;
  - sem rolagem horizontal no mobile;
  - fluxo completo: login demo → sincronização (até "Tudo pronto.") → painel → relatório → link público → verificação;
  - comparação visual com os mockups. Dois problemas foram encontrados e corrigidos: o ganho do mock estava errado porque havia dois eventos `HYPE-PERP` com custos diferentes, e a tabela do relatório estourava a coluna em 1440 px.
- **Não testado:** login com uma carteira real instalada, porque o ambiente de teste não tinha extensão. O fluxo segue a API oficial do Wallet Adapter, mas deve ser testado com a Phantom e a Solflare antes da demo.

## 6. Limitações conhecidas e pendências

| Item | Situação | Quem |
|---|---|---|
| Todas as rotas `/api/*` | contrato pronto em `API_CONTRACT.md`; o front está pronto para trocar o mock pela API | **back-end** |
| Validação SIWS, nonce, sessão | só no back-end | **back-end** |
| Motor fiscal (custo médio, PTAX, isenção, 15%) | o mock usa números do mockup e uma regra simplificada só para a demo | **back-end** |
| Geração do CSV oficial e do arquivo DeCripto | no modo demo o CSV é gerado no navegador e a DeCripto mostra um aviso | **back-end** |
| Registro do hash na Solana (Memo) | o front só exibe e confere | **back-end** |
| Teste com carteira real (Phantom/Solflare) | pendente | front + QA |
| Login em celular sem extensão (deep link da Phantom) | o Wallet Adapter cobre Android via Mobile Wallet Adapter; no iOS o usuário precisa abrir o site pelo navegador da Phantom | melhoria futura |
| Página do plano Pro | botão "Conhecer o Pro" desativado ("Em breve"), como sugerido nos próximos passos do mockup | produto |
| Notificação "Avisamos quando terminar" | texto da tela; o aviso em si (e-mail/push) depende do back-end | **back-end** |
| Testes automatizados | não há; o próximo passo seria Playwright cobrindo o fluxo demo | front |
| Sessão em `localStorage` | ok para o hackathon; para produção, cookie `httpOnly` (mudança pequena, descrita no contrato) | front + back |

## 7. Segurança e privacidade (checklist do front)

- Nenhum segredo no código ou em variável `NEXT_PUBLIC_*`; [`.env.example`](../.env.example) explica isso.
- O app **nunca** pede chave privada ou seed e **nunca** envia transação. O login é só assinatura de mensagem.
- Links externos com `rel="noopener noreferrer"`.
- O parâmetro `next` do login aceita só caminhos internos.
- A conferência do arquivo na verificação pública roda 100% no navegador.
- A exclusão de dados exige confirmação digitada e explica o que permanece on-chain (LGPD).

## 8. Como continuar

1. **Integrar com o back-end:** definir `NEXT_PUBLIC_API_URL` e seguir o checklist do fim de [`API_CONTRACT.md`](API_CONTRACT.md).
2. **Mudar um formato de dado:** edite `src/lib/api/types.ts`; o TypeScript aponta cada tela e o mock que precisam mudar.
3. **Nova tela logada:** crie `src/app/(app)/<rota>/page.tsx`. A sidebar e a guarda de sessão vêm do layout; o item de menu vai em `NAV`, em `app-shell.tsx`.
4. **Nova cor ou ajuste de tema:** edite os tokens em `globals.css` (`:root` e `[data-theme="dark"]`) e, se for cor nova, registre-a em `@theme inline`.
5. Antes de abrir PR: `npm run check`.

## 9. Atualização consolidada — 01/10/2026

### Idiomas e integração

- Interface em português e inglês, com dicionários tipados em `src/lib/i18n/`, seletor de idioma e seleção inicial por cookie/`Accept-Language`.
- Formatação de datas, meses, valores e entrada de preços conforme o idioma; valores fiscais continuam em BRL.
- Cliente HTTP envia `Accept-Language`; erros de rede, carteira e textos do modo demonstração acompanham o idioma.
- Mock ampliado com dados por mês e respostas localizadas, mantendo o processamento fiscal real como responsabilidade do back-end.

### Abertura, login e identidade visual

- Tela de abertura a cada carregamento completo, com progresso e logo 3D `public/od-logo.glb`, carregada com Three.js sob demanda.
- Painel esquerdo do login com degradê radial roxo, três camadas de estrelas animadas e transição suave para o fundo do formulário. O teste de degradê horizontal foi revertido.
- Textos do painel aparecem por digitação sequencial. A implementação revela texto contínuo, preservando o espaço do conteúdo; a linha divisória aparece após a digitação. A sequência aguarda a abertura e respeita redução de movimento.
- Novo planeta `public/voxel-planet-orbits.glb` apenas na marca do painel esquerdo, em 112 × 112 px e rotação de 40 segundos por volta. A logo original serve de fallback durante o carregamento ou em falha do WebGL.
- Paleta centralizada, Outfit com pesos até 900 e escala responsiva compartilhada para títulos; DM Sans no corpo e JetBrains Mono nos dados.
- “Orbix” dourado nos títulos da marca. Assinatura `orbix. lab` com ponto `#D4A843` e `lab` em lilás `#B3A0F4` (ver 9.1).
- Referências em vídeo/modelo adicionadas em `docs`; os arquivos públicos são usados pelo navegador. Detalhes visuais em [`BRAND_GUIDE.md`](BRAND_GUIDE.md).

### Validação e pendências desta revisão

- `npm run typecheck` e `npm run lint`: concluídos sem erros em 01/10/2026 ao preparar esta documentação.
- Build de produção e navegação visual completa não foram repetidos nesta revisão. A validação histórica da seção 5 não cobre o estado visual atual.
- Pendente conferir desktop/mobile, temas claro/escuro, PT/EN, digitação após a abertura, fallback WebGL e login com carteira real.
- O contraste do `lab` foi resolvido na revisão 9.1 (lilás `#B3A0F4`).

### 9.1 Boas-vindas, login e ajustes — 01/10/2026 (noite)

**Tela de boas-vindas** ([`welcome-screen.tsx`](../src/components/welcome-screen.tsx), [`welcome-logo.tsx`](../src/components/welcome-logo.tsx))

- Aparece **depois** da sincronização: a tela de conexão mostra "Tudo pronto." normalmente e as boas-vindas só começam quando a pessoa clica em **Ir para o painel**. Ao terminar, abre `/painel`. (Uma versão anterior trocava a tela de sincronização pelas boas-vindas assim que a leitura acabava; foi corrigido.)
- Enquanto a leitura ainda roda, o botão secundário "Ir para o painel" vai direto ao painel, sem a animação.
- O canvas 3D agora cobre a tela inteira. A caixa da logo (`.model`) virou só a referência de posição e tamanho: a câmera é calculada para a logo caber nela em repouso. Isso eliminou o retângulo que cortava a logo durante o zoom.
- Saída: o "OD Orbix Declare" acelera até a câmera (ease-in cúbico, 1,5 s), mirando o centro da tela, cresce além das bordas e atravessa a tela; o fade só acontece nos últimos 12%. As estrelas viram riscos de velocidade ao mesmo tempo.
- Modelo: `public/orbix-declare.glb` (~5,8 MB, carregado com Three.js sob demanda). Se o WebGL falhar ou o modelo demorar mais de 3 s, aparece o texto "Orbix Declare" e o fluxo segue para o painel.

**Login**

- Título trocado de "Entrar no Orbix Declare" (repetia o que o botão já diz) para a promessa do produto: **"Uma assinatura. Seu imposto pronto."**, com a segunda frase em lilás. EN: "One signature. Your taxes, done."
- Subtítulo: "Entre com sua carteira Solana. Sem senha, sem cadastro, sem mover nenhum fundo."

**Outros ajustes**

- `lab` da assinatura em lilás `#B3A0F4` (sidebar, painel do login e abertura).
- Ícones de carregamento (`.animate-spin-slow`) continuam girando, mais devagar (2,4 s), quando o sistema pede redução de movimento. Antes ficavam parados e pareciam travados (caso do Windows com "efeitos de animação" desligados).
- Lint: `prefer-const` em `welcome-logo.tsx` corrigido sem mudar comportamento.

**Validação desta revisão**

- `npm run check` (typecheck, lint e build): sem erros.
- Edge headless, 1440 × 900 e 390 × 844: login (PT e EN) → modo demo → sincronização até "Tudo pronto." → clique em "Ir para o painel" → boas-vindas → `/painel`, sem erros na página. Quadros capturados durante o voo final mostram a logo crescendo até a borda da tela sem corte.
- Ainda pendente: ver o instante final do voo em velocidade real (o navegador de teste renderiza poucos quadros por segundo) e o login com carteira real.
- Os vídeos de referência (`docs/Orbix Welcome.mp4`, `docs/brave_8hOx6V1USS.mp4`) ficam só na máquina local e não vão para o repositório, seguindo a limpeza de binários em `docs/`.

### 9.2 Telas de transição mais curtas — 01/10/2026

Objetivo: quem volta ao app quer ver o painel, não a animação; na demo, o produto precisa parecer rápido.

| | Antes | Agora |
|---|---|---|
| Abertura | a cada carregamento, ~5 s | primeira carga de cada aba, ~2,5 s; não repete ao recarregar |
| Boas-vindas | toda vez, 6,5 s | só a primeira vez neste navegador, ~2,6 s; depois o botão abre o painel direto |
| Pular | não dava | clique, Esc, Enter ou espaço |
| Redução de movimento | abertura com a barra; boas-vindas curtas | versão calma das duas (logo parada; boas-vindas ~1,5 s). Pular foi testado e revertido: no Windows, "efeitos de animação" desligados ligam essa preferência e as telas sumiam |

- A abertura continua esperando o que é real (hidratação, fontes, sessão), com tempos mínimos menores; a logo 3D deixou de segurar a tela por até 3 s (agora 1,5 s) e a volta dela caiu de 1,25 s para 0,8 s.
- As boas-vindas encurtaram chegada (1,2 s), pausa e saída (1 s, ainda atravessando a tela).
- Um script no `<head>` (`app/layout.tsx`) esconde a abertura antes da hidratação quando ela já foi vista nesta aba, para não piscar.
- As duas telas não foram juntadas porque acontecem em momentos diferentes (ao abrir o site e depois da primeira sincronização), separadas por ações da pessoa.
- Medido no Edge headless: abertura some em ~2,9 s (inclui o carregamento da página); Esc pula em ~0,7 s; boas-vindas levam ~2,9 s até `/painel` na primeira vez e ~50 ms nas seguintes; clique pula em ~60 ms; recarregar não mostra a abertura; com redução de movimento aparece a versão calma. Sem erros na página. `npm run check` sem erros.
