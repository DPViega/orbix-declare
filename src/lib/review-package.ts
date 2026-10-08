import type { ReportDetail, ReportRow, TaxEvent } from "@/lib/api/types";
import type { Messages } from "@/lib/i18n/messages/pt";
import { getLocale } from "@/lib/i18n/locale";

/**
 * Pacote para revisão profissional: CSV detalhado + leia-me em Markdown, gerados no navegador
 * a partir de GET /api/report/:mes (linhas, totais, cobertura) e GET /api/events?month= (evidências).
 * Linha do relatório e evento compartilham o mesmo `id`. Os textos vêm do dicionário (t.reviewPackage),
 * então o pacote sai no idioma da interface. Não é o CSV oficial com hash (esse vem do back-end).
 */

type Pkg = Messages["reviewPackage"];

export interface ReviewPackage {
  csv: { name: string; text: string };
  readme: { name: string; text: string };
  /** Transferências do mês (fora do cálculo, mas definem a base do custo); null quando não há. */
  transfers: { name: string; text: string } | null;
}

const TZ = "America/Sao_Paulo";

/** Número com ponto decimal, sem notação científica e sem zeros à direita: 0.000123, 12.5. */
function plain(v: number | null | undefined, digits: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  // Limita a 15 algarismos significativos sem expor a cauda binária em quantidades grandes.
  const significantDecimals = v === 0 ? digits : Math.max(0, 14 - Math.floor(Math.log10(Math.abs(v))));
  const s = v.toFixed(Math.min(digits, significantDecimals));
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const money = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : v.toFixed(2));

/** Captura o idioma uma vez para cabeçalhos, linhas e transferências usarem o mesmo formato. */
function csvFormat() {
  const pt = getLocale() === "pt";
  const decimal = (s: string) => (pt ? s.replace(".", ",") : s);
  return {
    separator: pt ? ";" : ",",
    plain: (v: number | null | undefined, digits: number) => decimal(plain(v, digits)),
    money: (v: number | null | undefined) => decimal(money(v)),
  };
}
type CsvFormat = ReturnType<typeof csvFormat>;

/** "2026-09-28 14:59" no horário de Brasília. */
function dateTimeBR(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/**
 * Célula de texto: neutraliza fórmulas (=, +, -, @, tab, CR no início, como o back-end faz)
 * e põe aspas quando há separador, aspas ou quebra de linha.
 */
function text(v: string | null | undefined): string {
  let s = v ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(row: ReportRow, ev: TaxEvent | undefined, m: Pkg, { plain, money, separator }: CsvFormat): string {
  const yesNo = (b: boolean | undefined) => (b ? m.yes : m.no);
  const source = ev?.priceSource === "manual" || row.manualPrice ? m.manualSource : (ev?.priceProvider ?? "");
  // Múltiplos ativos de saída são sinalizados pelo contrato com origem null.
  const knownCost = !row.costUnknown && (ev?.type === "swap" || ev?.type === "perp")
    && ev.positionBeforeQty != null && ev.avgCostUnitBrl != null;
  return [
    text(dateTimeBR(row.date)),
    text(ev?.network ?? ""),
    text(ev?.wallet?.address ?? ""),
    text(row.type),
    text(row.asset),
    plain(row.quantity, 12),
    text(ev?.quantityAsset ?? ""),
    // Preço por unidade com até 10 casas: tokens baratos (0,0000107) não podem virar 0,00.
    plain(ev?.unitPriceBrl, 10),
    text(source),
    plain(ev?.ptax ?? row.ptax, 6),
    text(ev?.ptaxDate ?? ""),
    money(row.valueBrl),
    money(row.costBrl),
    money(row.gainBrl),
    money(ev?.feesBrl),
    yesNo(row.costUnknown),
    yesNo(row.costManual),
    text((ev?.pendingReasons ?? []).join(" | ")),
    text(ev?.txHash ?? ""),
    text(ev?.explorerUrl ?? ""),
    text(ev?.ruleVersion ?? ""),
    plain(ev?.type === "swap" ? ev.quantityIn : null, 12),
    text(ev?.type === "swap" ? ev.quantityInAsset : null),
    plain(knownCost ? ev?.positionBeforeQty : null, 12),
    plain(knownCost ? ev?.avgCostUnitBrl : null, 10),
    ev?.fillCount == null || !Number.isFinite(ev.fillCount) ? "" : String(Math.round(ev.fillCount)),
  ].join(separator);
}

/** Transferência: entrada ou saída de cripto, sem venda. Direção e contraparte ainda não vêm da API (B9). */
function transferRow(ev: TaxEvent, { plain, money, separator }: CsvFormat): string {
  return [
    text(dateTimeBR(ev.date)),
    text(ev.network),
    text(ev.wallet?.address ?? ""),
    text(ev.quantityAsset || ev.asset),
    plain(ev.quantity, 12),
    money(ev.valueBrl),
    plain(ev.ptax, 6),
    text(ev.ptaxDate ?? ""),
    text(ev.txHash),
    text(ev.explorerUrl),
  ].join(separator);
}

const bullets = (items: string[], empty: string) => (items.length ? items.map((x) => `- ${x}`) : [`- ${empty}`]);

export function buildReviewPackage(
  report: ReportDetail,
  events: TaxEvent[],
  m: Pkg,
  opts: {
    monthLabel: string;
    formatBRL: (v: number) => string;
    /** Datas do leia-me no formato da interface (o CSV usa AAAA-MM-DD). */
    formatDate: (iso: string) => string;
    formatDateTime: (iso: string) => string;
    now?: Date;
  },
): ReviewPackage {
  const format = csvFormat();
  const byId = new Map(events.map((e) => [e.id, e]));
  const draft = report.status !== "final";
  const base = m.fileBase(report.month, draft);
  const csvName = `${base}-${m.csvSuffix}.csv`;
  const readmeName = `${base}-${m.readmeSuffix}.md`;
  const transfersName = `${base}-${m.transfersSuffix}.csv`;

  // BOM: o Excel abre os acentos corretamente.
  const toCsv = (header: string[], rows: string[]) => "\uFEFF" + [header.map(text).join(format.separator), ...rows].join("\n") + "\n";
  const csv = toCsv(
    m.columns,
    report.rows.map((r) => csvRow(r, byId.get(r.id), m, format)),
  );
  const transferEvents = events.filter((e) => e.type === "transfer");
  const transfers = transferEvents.length ? { name: transfersName, text: toCsv(m.transferColumns, transferEvents.map((ev) => transferRow(ev, format))) } : null;
  // Linhas do relatório sem o evento correspondente: as colunas de origem saem em branco, então o leia-me avisa.
  const missing = report.rows.filter((row) => !byId.has(row.id));

  const r = m.readme;
  const review = report.review;
  const cov = review?.coverage;
  const pending = [
    ...(review?.pendingReasons ?? []),
    ...(review?.reviewItems ?? []).map((i) => i.label),
    ...report.rows.flatMap((row) => {
      const ev = byId.get(row.id);
      return (ev?.pendingReasons ?? []).map((reason) => `${opts.formatDate(row.date)} · ${row.asset}: ${reason}`);
    }),
  ];
  const brl = opts.formatBRL;
  // Data sem horário ("2026-09-30") é lida ao meio-dia UTC, para não virar o dia anterior em Brasília.
  const day = (iso: string) => opts.formatDate(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T15:00:00Z` : iso);

  const lines = [
    `# ${r.title(opts.monthLabel)}`,
    "",
    `- **${r.status}:** ${draft ? r.draft : r.final}`,
    `- **${r.generatedAt}:** ${opts.formatDateTime((opts.now ?? new Date()).toISOString())} (${r.brasiliaTime})`,
    `- **${r.engineVersion}:** ${review?.engineVersion ?? r.notInformed}`,
    "",
    `> ${r.disclaimer}`,
    "",
    `## ${r.filesTitle}`,
    "",
    `- ${r.csvFile(csvName, report.rows.length)}`,
    `- ${r.readmeFile(readmeName)}`,
    ...(transfers ? [`- ${r.transfersFile(transfersName, transferEvents.length)}`] : []),
    "",
    `## ${r.totalsTitle}`,
    "",
    `- ${r.disposed}: ${brl(report.totals.disposedBrl)}`,
    `- ${r.cost}: ${brl(report.totals.costBrl)}`,
    `- ${r.gain}: ${brl(report.totals.gainBrl)}`,
    `- ${r.tax}: ${brl(report.totals.taxBrl)}`,
    "",
    `## ${r.coverageTitle}`,
    "",
    `- ${r.coverageState}: ${cov ? r.coverageStates[cov.state] : r.notInformed}`,
    `- ${r.period}: ${cov?.importedFrom && cov.importedThrough ? r.periodRange(day(cov.importedFrom), day(cov.importedThrough)) : r.notInformed}`,
    `- ${r.importedEvents}: ${cov?.importedEvents ?? r.notInformed}`,
    ...(cov?.state === "partial" ? ["", `**${r.partialWarning}**`] : []),
    "",
    `## ${r.limitationsTitle}`,
    "",
    ...bullets(review?.limitations ?? [], r.none),
    "",
    `## ${r.unsupportedTitle}`,
    "",
    ...bullets(review?.unsupportedOperations ?? [], r.none),
    "",
    `## ${r.pendingTitle}`,
    "",
    ...bullets(pending, r.noPending),
    "",
    `## ${r.transfersTitle}`,
    "",
    ...(transfers ? [r.transfersText(transferEvents.length), "", r.transfersPending] : [r.noTransfers]),
    "",
    `## ${r.missingEvidenceTitle}`,
    "",
    ...(missing.length
      ? [r.missingEvidenceText(missing.length), "", ...missing.map((row) => `- ${opts.formatDate(row.date)} · ${row.asset}`)]
      : [r.allEvidence]),
    "",
    `## ${r.rulesTitle}`,
    "",
    ...r.rules.map((x) => `- ${x}`),
    "",
    `## ${r.columnsTitle}`,
    "",
    m.columns.map((c) => `\`${c}\``).join(" · "),
    "",
  ];

  return { csv: { name: csvName, text: csv }, readme: { name: readmeName, text: lines.join("\n") }, transfers };
}
