"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * @solana/wallet-adapter-react só é usado no fluxo de login (assinatura da carteira).
 * Fica isolado aqui, não no Providers raiz, pra não entrar no bundle de rotas que não
 * precisam de carteira (/, /precos, /privacidade, /painel, etc).
 */
export function WalletProviders({ children }: { children: React.ReactNode }) {
  // Lista vazia: Phantom, Solflare e outras carteiras compatíveis com o Wallet Standard
  // são detectadas automaticamente, sem pacotes extras.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
