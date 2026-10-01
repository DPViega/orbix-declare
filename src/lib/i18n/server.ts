import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./locale";
import { messagesFor } from "./messages";

/** Idioma da requisição: cookie `orbix.locale`, senão Accept-Language. Só em Server Components. */
export async function getRequestLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
}

export async function getMessages() {
  return messagesFor(await getRequestLocale());
}
