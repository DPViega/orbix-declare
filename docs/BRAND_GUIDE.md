# Orbix: cores e tipografia

Referência: identidade visual fornecida pelo usuário em 30/09/2026.

Atualizado em 01/10/2026 com as escolhas finais de marca e login.

## Cores

Os tokens centrais ficam em `src/app/globals.css`:

| Token | Cor | Uso |
| --- | --- | --- |
| `--orbix-paper` | `#f7f5ff` | Fundo claro e marca sobre fundo escuro |
| `--orbix-night` | `#07040d` | Texto escuro e superfícies da marca |
| `--orbix-purple` | `#5b35c8` | Ações e destaque principal |
| `--orbix-lilac` | `#8b6ae8` | Acento lilás |
| `--orbix-gold` | `#d4a843` | Detalhes dourados |

São os valores existentes do app, compatíveis com as referências fornecidas; as imagens não especificam códigos hexadecimais. Usar os tokens semânticos (`bg`, `ink`, `accent`, etc.) nos componentes para manter os temas claro e escuro. Cores de sucesso, aviso e erro mantêm seu significado.

## Fontes

- Outfit: títulos e marca, com pesos reais de 400 a 900 carregados pelo Next.js.
- DM Sans: corpo, navegação e controles.
- JetBrains Mono: dados, valores, códigos e assinaturas técnicas.

| Estilo | Tamanho máximo | Peso | Classe |
| --- | --- | --- | --- |
| Display | 72px | 900 | `type-display` |
| H1 | 48px | 800 | `type-h1` |
| H2 | 32px | 700 | `type-h2` |
| H3 | 22px | 600 | `type-h3` |

Display, H1 e H2 reduzem de tamanho em telas estreitas. A classe visual pode diferir do nível semântico do título, como no destaque do painel de login.

## Aplicação da marca e login

- “Orbix” em dourado `#D4A843` nos títulos da marca; “Declare” mantém sua cor de contexto. O título do login é a promessa do produto, em duas frases: “Uma assinatura.” na cor padrão e “Seu imposto pronto.” em lilás (`text-accent-text`), como o “Declare” da marca (EN: “One signature. Your taxes, done.”).
- `OrbixSignature` preserva o prefixo traduzido, usa ponto dourado `#D4A843` e `lab` em lilás `#B3A0F4` (o roxo escuro `#1F0D5C` anterior sumia no fundo escuro do painel e da abertura).
- Login: céu estrelado sobre degradê radial lilás/roxo, com faixa suave na borda direita que termina na cor do fundo do formulário.
- Planeta voxel de 112px apenas no painel esquerdo, com uma volta a cada 40 segundos. A abertura mantém seu próprio modelo OD.
- Digitação sequencial do título, descrição e passos; divisor revelado após o último texto. Preferência de redução de movimento apresenta o texto sem animação.
