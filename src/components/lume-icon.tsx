import type { SVGProps } from "react";

/** Farol do Lume: dois arcos e um ponto. Monocromático por padrão para estados ativos e avatares. */
export function LumeIcon({ size = 24, accent = false, ...props }: SVGProps<SVGSVGElement> & { size?: number | string; accent?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" focusable="false" {...props}>
      <path d="M14.1 3.2a9 9 0 1 0 6.7 11.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13.4 7.5a4.8 4.8 0 1 0 3.3 7.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12.4" cy="12" r="1.9" fill={accent ? "var(--color-gold, #D4A843)" : "currentColor"} />
    </svg>
  );
}
