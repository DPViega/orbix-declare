import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./locale";
import { messagesFor } from "./messages";

/** Idioma da requisição: cookie `orbix.locale`, senão o padrão (inglês). Só em Server Components. */
export async function getRequestLocale(): Promise<Locale> {
  const c = await cookies();
  return pickLocale(c.get(LOCALE_COOKIE)?.value);
}

export async function getMessages() {
  return messagesFor(await getRequestLocale());
}
