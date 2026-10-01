/**
 * Idioma da interface (português ou inglês). Módulo sem React: usado pelos formatadores,
 * pelo cliente HTTP e pelo mock, além do provider em ./index.tsx.
 *
 * O idioma escolhido fica no cookie `orbix.locale` (o servidor já renderiza no idioma certo,
 * sem piscar). Sem cookie, vale o idioma do navegador (Accept-Language): pt* → português, resto → inglês.
 */

export type Locale = "pt" | "en";

export const LOCALES: readonly Locale[] = ["pt", "en"];
export const DEFAULT_LOCALE: Locale = "pt";
export const LOCALE_COOKIE = "orbix.locale";

/** Tag BCP 47 para Intl e para <html lang>. */
export const intlLocale = (l: Locale) => (l === "en" ? "en-US" : "pt-BR");

export const isLocale = (v: unknown): v is Locale => v === "pt" || v === "en";

/** Cookie salvo vence; senão, o primeiro idioma suportado do Accept-Language. */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("pt")) return "pt";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

/*
 * Idioma atual para código fora do React (formatadores, mensagens de erro da API, mock).
 * O I18nProvider atualiza este valor a cada render, antes dos filhos renderizarem.
 */
let current: Locale = DEFAULT_LOCALE;

export const getLocale = () => current;
export function setCurrentLocale(l: Locale) {
  current = l;
}
