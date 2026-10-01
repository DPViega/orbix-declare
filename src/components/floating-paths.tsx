/**
 * Feixe de linhas em onda do painel de marca do login (inspirado no bloco "auth-5" do Efferd).
 *
 * Cada linha é uma senoide (curvas Q/T) mais longa que o painel. A animação é 100% CSS (globals.css):
 *  - .wave-line   desloca a linha exatamente um comprimento de onda e repete → a onda "corre" sem emenda;
 *    cada linha tem velocidade própria, então as ondas se cruzam e o feixe parece respirar;
 *  - .path-glint  um brilho curto percorre algumas linhas, entrando e saindo em fade;
 *  - .paths-drift o conjunto deriva devagar.
 * Valores fixos e arredondados (sem Math.random) para servidor e cliente renderizarem igual.
 * Com prefers-reduced-motion, roda a "versão calma" (globals.css): ondas bem lentas, sem brilho nem deriva.
 */

const VIEW_W = 600;
const VIEW_H = 900;
const WAVELENGTH = 200; // precisa bater com o translate de @keyframes wave-travel (200px)

const r1 = (n: number) => Math.round(n * 10) / 10;

function wavePath(y: number, amplitude: number, phase: number) {
  let x = -2 * WAVELENGTH + phase;
  const half = WAVELENGTH / 2;
  let d = `M${r1(x)} ${r1(y)} Q${r1(x + half / 2)} ${r1(y - 2 * amplitude)} ${r1(x + half)} ${r1(y)}`;
  x += half;
  while (x < VIEW_W + 2 * WAVELENGTH) {
    d += ` T${r1(x + half)} ${r1(y)}`;
    x += half;
  }
  return d;
}

export function FloatingPaths({ position, className }: { position: 1 | -1; className?: string }) {
  const main = position === 1;
  const count = main ? 26 : 16;
  const lines = Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    const bell = Math.sin(Math.PI * t); // linhas do meio mais onduladas e mais fortes
    return {
      id: i,
      d: wavePath((main ? 200 : 260) + i * (main ? 11 : 15), 5 + 17 * bell, (i * (main ? 9 : 23)) % WAVELENGTH),
      width: r1(main ? 0.6 + t * 0.9 : 0.5 + t * 0.6),
      opacity: Math.round((main ? 0.14 + bell * 0.34 : 0.1 + bell * 0.22) * 100) / 100,
      duration: (main ? 4 : 6) + ((i * 7) % 4) * 0.8,
      glint: i % 3 === (main ? 1 : 0),
      glintDuration: 5 + ((i * 5) % 4),
      glintDelay: -((i * 1.7) % 8),
    };
  });

  return (
    <svg
      className={`paths-drift ${className ?? ""}`}
      style={{ animationDelay: main ? "0s" : "-13s" }}
      fill="none"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g transform={main ? "rotate(-14 300 340)" : "rotate(9 300 380)"}>
        {lines.map((l) => (
          <g
            key={l.id}
            className={main ? "wave-line" : "wave-line wave-line-reverse"}
            style={{ animationDuration: `${l.duration}s`, animationDelay: `-${(l.id * 0.9).toFixed(1)}s` }}
          >
            <path d={l.d} stroke="currentColor" strokeOpacity={l.opacity} strokeWidth={l.width} />
            {l.glint && (
              <path
                d={l.d}
                pathLength={1}
                stroke="#E4DCFF"
                strokeWidth={r1(l.width + 0.4)}
                strokeLinecap="round"
                className="path-glint"
                style={{ animationDuration: `${l.glintDuration}s`, animationDelay: `${l.glintDelay.toFixed(1)}s` }}
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
