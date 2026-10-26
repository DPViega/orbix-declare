"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Logo real para os ativos mais comuns (fonte: trustwallet/assets no GitHub, conferida no ar
 * antes de usar), com fallback automático para um monograma colorido quando o símbolo não está
 * no mapa ou a imagem falha ao carregar — nunca aparece ícone quebrado.
 */
const TOKEN_LOGOS: Record<string, string> = {
  SOL: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
  USDC: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  JUP: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png",
  // Hyperliquid não está no trustwallet/assets: logo oficial (via CoinGecko) servido do próprio app.
  HYPE: "/tokens/hype.png",
};

/** Matiz determinística por símbolo: o mesmo ativo tem a mesma cor em toda a tela. */
export function tokenHue(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function TokenIcon({ symbol, size = 22 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const logo = TOKEN_LOGOS[symbol.toUpperCase()];

  if (logo && !failed) {
    return (
      <Image
        src={logo}
        alt=""
        aria-hidden
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full bg-white object-contain p-0.5"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = (symbol.match(/[A-Za-z]/g) ?? []).slice(0, 2).join("").toUpperCase() || "?";
  const hue = tokenHue(symbol);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(${hue} 55% 22%)`,
        color: `hsl(${hue} 75% 82%)`,
      }}
    >
      {initials}
    </span>
  );
}
