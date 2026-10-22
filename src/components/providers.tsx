"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "@/lib/session";
import { SplashGate } from "@/components/splash-screen";
import { I18nProvider, type Locale } from "@/lib/i18n";

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SessionProvider>
          {children}
          <SplashGate />
        </SessionProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
