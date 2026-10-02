"use client";

/**
 * Idioma da interface no React: `const { t, locale, setLocale } = useI18n()`.
 *
 * O idioma inicial vem do servidor (cookie ou Accept-Language, ver app/layout.tsx), então a
 * primeira renderização já sai no idioma certo. Trocar o idioma grava o cookie, atualiza
 * <html lang> e pede ao servidor os títulos da aba no novo idioma (router.refresh).
 */
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { intlLocale, LOCALE_COOKIE, setCurrentLocale, type Locale } from "./locale";
import { messagesFor, type Messages } from "./messages";

interface I18nValue {
  locale: Locale;
  t: Messages;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  // Formatadores, cliente HTTP e mock leem o idioma deste valor de módulo.
  setCurrentLocale(locale);

  const setLocale = useCallback(
    (l: Locale) => {
      setCurrentLocale(l);
      setLocaleState(l);
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = intlLocale(l);
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ locale, t: messagesFor(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>.");
  return ctx;
}

export type { Locale } from "./locale";
export type { Messages } from "./messages";
