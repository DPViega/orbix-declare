/**
 * Formatadores de números e datas no idioma da interface (pt-BR ou en-US, ver lib/i18n/locale.ts).
 * Valores continuam em reais (R$) e no fuso de Brasília nos dois idiomas: é o que vale para o fisco.
 * O CSV oficial do relatório não passa por aqui (lib/report-file.ts usa formato fixo).
 */
import { getLocale, intlLocale, type Locale } from "@/lib/i18n/locale";

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function nf(name: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${getLocale()}:${name}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) cache.set(key, (f = new Intl.NumberFormat(intlLocale(getLocale()), opts)));
  return f;
}

/** "R$ 28.940,13" / "R$28,940.13" (espaço normal no lugar do NBSP do Intl, para bater com o mockup) */
export const formatBRL = (v: number) =>
  nf("brl", { style: "currency", currency: "BRL" })
    .format(v)
    .replace(/\u00a0/g, " ");
/** "R$ 35.000" — sem centavos quando o valor é inteiro (limites, eixos) */
export const formatBRLShort = (v: number) =>
  nf(Number.isInteger(v) ? "brl0" : "brl", {
    style: "currency",
    currency: "BRL",
    ...(Number.isInteger(v) ? { maximumFractionDigits: 0 } : {}),
  })
    .format(v)
    .replace(/\u00a0/g, " ");
/** "28.940,13" — valor sem símbolo, usado nas tabelas do relatório */
export const formatMoney = (v: number) => nf("dec2", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
/**
 * Quantidade de cripto: "12,50" · "0,5" · "0,000123" · "0".
 * A partir de 1 mostra de 2 a 4 casas; abaixo de 1 mantém 4 dígitos significativos, para 0,000123 SOL não virar "0,00".
 */
export function formatQty(v: number): string {
  if (v === 0) return nf("int", { maximumFractionDigits: 0 }).format(0);
  return Math.abs(v) >= 1
    ? nf("qty", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v)
    : nf("qtySmall", { maximumSignificantDigits: 4 }).format(v);
}
/** Quantidade completa, sem arredondar (até 15 dígitos significativos, o limite seguro de um double). Para title e detalhes. */
export const formatQtyFull = (v: number) => nf("qtyFull", { maximumSignificantDigits: 15 }).format(v);
export const formatPtax = (v: number) => nf("dec4", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(v);
export const formatInt = (v: number) => nf("int", { maximumFractionDigits: 0 }).format(v);
export const formatPct = (v: number) =>
  `${v > 0 ? "+" : ""}${nf("pct1", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`;

const tz = "America/Sao_Paulo";
const dtf = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(getLocale()), { timeZone: tz, ...opts });

/** "30/09/2026" · "Sep 30, 2026" */
export function formatDate(iso: string): string {
  const en = getLocale() === "en";
  return dtf(en ? { month: "short", day: "numeric", year: "numeric" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

/** "30/09" · "Sep 30" */
export function formatDayMonth(iso: string): string {
  const en = getLocale() === "en";
  return dtf(en ? { month: "short", day: "numeric" } : { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** "14:32" (24 h nos dois idiomas) */
export function formatTime(iso: string, seconds = false): string {
  return dtf({
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** "30/09/2026 · 14:32" */
export const formatDateTime = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;

/** Encurta endereços e hashes: "7xKp…3fQa" / "0x4f2A…9c1E" */
export function shortAddress(addr: string, head = 4, tail = 4): string {
  if (!addr) return "";
  const h = addr.startsWith("0x") ? head + 2 : head;
  if (addr.length <= h + tail + 1) return addr;
  return `${addr.slice(0, h)}…${addr.slice(-tail)}`;
}

/* ---------- Meses ----------
 * A chave de mês trafegada com o back-end é "AAAA-MM" (ex.: "2026-09").
 */

const MONTHS: Record<Locale, string[]> = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const monthNameOf = (month: number) => MONTHS[getLocale()][month - 1];

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Setembro 2026" · "September 2026" */
export function monthLabel(key: string): string {
  const p = parseMonthKey(key);
  return p ? `${cap(monthNameOf(p.month))} ${p.year}` : key;
}

/** "setembro de 2026" · "September 2026" */
export function monthLong(key: string): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  return getLocale() === "en" ? `${monthNameOf(p.month)} ${p.year}` : `${monthNameOf(p.month)} de ${p.year}`;
}

/** "março/2026" · "Mar/2026" */
export function monthSlash(key: string): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const name = monthNameOf(p.month);
  return `${getLocale() === "en" ? name.slice(0, 3) : name}/${p.year}`;
}

/** Nome do mês sozinho: "agosto" · "August" */
export function monthName(key: string): string {
  const p = parseMonthKey(key);
  return p ? monthNameOf(p.month) : key;
}

export function previousMonthKey(key: string): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const d = new Date(Date.UTC(p.year, p.month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Converte o preço digitado em número. Retorna null se inválido.
 * pt: "R$ 1.234,56" / "3,08" / "3.08" · en: "R$1,234.56" / "3.08" (vírgula = milhar).
 */
export function parseBRLInput(raw: string): number | null {
  const cleaned = raw.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  const normalized =
    getLocale() === "en" ? cleaned.replace(/,/g, "") : cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
