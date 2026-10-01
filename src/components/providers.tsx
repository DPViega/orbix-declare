"use client";

import { useMemo } from "react";
import { ThemeProvider } from "next-themes";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { SessionProvider } from "@/lib/session";
import { SplashGate } from "@/components/splash-screen";
import { I18nProvider, type Locale } from "@/lib/i18n";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  // Lista vazia: Phantom, Solflare e outras carteiras compatíveis com o Wallet Standard
  // são detectadas automaticamente, sem pacotes extras.
  const wallets = useMemo(() => [], []);

  return (
    <I18nProvider initialLocale={locale}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
        <ConnectionProvider endpoint={RPC_URL}>
          <WalletProvider wallets={wallets} autoConnect={false}>
            <SessionProvider>
              {children}
              <SplashGate />
            </SessionProvider>
          </WalletProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
