/** Formatadores pt-BR. Toda a apresentação de números e datas passa por aqui. */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dec2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec4 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "R$ 28.940,13" (com espaço normal, não o NBSP do Intl, para bater com o mockup) */
export const formatBRL = (v: number) => brl.format(v).replace(/ /g, " ");
/** "28.940,13" — valor sem símbolo, usado nas tabelas do relatório */
export const formatMoney = (v: number) => dec2.format(v);
export const formatQty = (v: number) => dec2.format(v);
export const formatPtax = (v: number) => dec4.format(v);
export const formatInt = (v: number) => int.format(v);
export const formatPct = (v: number) => `${v > 0 ? "+" : ""}${pct1.format(v)}%`;

const tz = "America/Sao_Paulo";

/** "30/09/2026" */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

/** "30/09" */
export function formatDayMonth(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** "14:32" */
export function formatTime(iso: string, seconds = false): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
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

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Setembro 2026" */
export function monthLabel(key: string): string {
  const p = parseMonthKey(key);
  return p ? `${cap(MONTHS[p.month - 1])} ${p.year}` : key;
}

/** "setembro de 2026" */
export function monthLong(key: string): string {
  const p = parseMonthKey(key);
  return p ? `${MONTHS[p.month - 1]} de ${p.year}` : key;
}

/** "março/2026" */
export function monthSlash(key: string): string {
  const p = parseMonthKey(key);
  return p ? `${MONTHS[p.month - 1]}/${p.year}` : key;
}

/** Nome do mês sozinho: "agosto" */
export function monthName(key: string): string {
  const p = parseMonthKey(key);
  return p ? MONTHS[p.month - 1] : key;
}

export function previousMonthKey(key: string): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const d = new Date(Date.UTC(p.year, p.month - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Converte "R$ 3,08" / "3,08" / "3.08" em número. Retorna null se inválido. */
export function parseBRLInput(raw: string): number | null {
  const cleaned = raw.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
