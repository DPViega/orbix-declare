"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChartLineIcon,
  CheckCircleIcon,
  FileArrowUpIcon,
  FileTextIcon,
  GaugeIcon,
  GlobeHemisphereWestIcon,
  InfoIcon,
  LightningIcon,
  ListChecksIcon,
  PlusCircleIcon,
  SquaresFourIcon,
  type Icon,
} from "@phosphor-icons/react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventType, Network, ReportSummary, TaxEvent } from "@/lib/api";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatBRL, formatBRLShort, formatDate, formatDateMedium, formatInt, formatPct, formatQty, monthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn, Skeleton } from "@/components/ui";
import { TokenIcon } from "@/components/token-icon";
import { EVENT_TYPES, TYPE_COLOR, TYPE_ICON } from "@/components/event-type";

/*
 * Blocos do painel (modo simples). Cada número sai de dados reais que o painel já carrega:
 * resumo do mês (api.dashboard), eventos do mês (api.events) e relatórios (api.reports).
 * Onde o back-end ainda não tem a série (ex.: patrimônio das carteiras ao longo do tempo),
 * o bloco mostra o que existe e diz o que é — nada de número inventado.
 */

export const NETWORK_NAME: Record<Network, string> = { solana: "Solana", hyperliquid: "Hyperliquid" };
const NETWORK_TOKEN: Record<Network, string> = { solana: "SOL", hyperliquid: "HYPE" };
const NETWORK_COLOR: Record<Network, string> = { solana: "#8b6ae8", hyperliquid: "#5eead4" };

/** Cabeçalho padrão dos cards: ícone num quadrado + título (+ ações à direita). */
function CardHeader({ icon: I, title, note, children }: { icon: Icon; title: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-chip text-accent-text">
          <I size={18} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
          <h2 className="m-0 font-display text-[17px] leading-tight font-semibold text-ink">{title}</h2>
          {note && <p className="m-0 text-[12.5px] text-muted">{note}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Grupo de botões alternáveis (aria-pressed), no visual dos filtros do painel. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-xl border border-line bg-bg/60 p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded-[9px] px-2.5 py-1 text-[12.5px] transition-colors",
            value === o.value ? "bg-accent font-medium text-on-accent" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- KPIs ---------------- */

/** Série acumulada por dia dentro do mês (para os minigráficos dos KPIs). */
export function cumulativeByDay(events: TaxEvent[], pick: (e: TaxEvent) => number): number[] {
  const byDay = new Map<string, number>();
  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    const day = e.date.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + pick(e));
  }
  let sum = 0;
  return [0, ...[...byDay.values()].map((v) => (sum += v))];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const id = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => [(i / (data.length - 1)) * 100, 34 - ((v - min) / span) * 30] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 36" preserveAspectRatio="none" className="h-10 w-24 shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L 100 36 L 0 36 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function KpiCard({
  icon: I,
  label,
  value,
  valueClass,
  note,
  trend,
  spark,
  sparkColor = "var(--color-soft)",
  href,
  hrefLabel,
}: {
  icon: Icon;
  label: string;
  value: string;
  valueClass?: string;
  note: string;
  /** Variação em % contra o mês anterior; null = sem base de comparação. */
  trend?: { pct: number; text: string } | null;
  spark?: number[];
  sparkColor?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="dash-card flex flex-col gap-3 px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-chip text-accent-text">
            <I size={16} aria-hidden />
          </span>
          <h2 className="m-0 truncate font-mono text-[10.5px] font-normal tracking-[0.08em] text-muted uppercase">{label}</h2>
        </div>
        {href && (
          <Link
            href={href}
            aria-label={hrefLabel}
            title={hrefLabel}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink transition-colors hover:border-accent hover:text-accent-text"
          >
            <ArrowRightIcon size={15} aria-hidden />
          </Link>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className={cn("font-mono text-[24px] leading-tight font-medium tracking-[-0.02em] text-ink", valueClass)}>{value}</span>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[12.5px] text-muted">{note}</span>
        {trend && (
          <span className={cn("flex items-center gap-1 text-[12.5px] font-medium", trend.pct >= 0 ? "text-ok" : "text-danger")}>
            {trend.pct >= 0 ? <ArrowUpIcon size={13} weight="bold" aria-hidden /> : <ArrowDownIcon size={13} weight="bold" aria-hidden />}
            {trend.text}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Evolução do volume (por dia) ---------------- */

type Metric = "value" | "count";
type Range = "1" | "3" | "6" | "12" | "all";
type DayPoint = { day: string; value: number; count: number };

/*
 * Série diária: busca os eventos dos meses do período (um GET por mês, os meses vêm dos relatórios)
 * e soma por dia. É o volume movimentado — o back-end ainda não guarda o saldo das carteiras dia a
 * dia, então este gráfico não é "patrimônio".
 */
export function EvolutionPanel({ reports, loading }: { reports: ReportSummary[] | null; loading: boolean }) {
  const { t } = useI18n();
  const ev = t.dashboard.evolution;
  const [metric, setMetric] = useState<Metric>("value");
  const [range, setRange] = useState<Range>("6");

  const months = useMemo(() => {
    const all = (reports ?? []).map((r) => r.month).sort();
    return range === "all" ? all : all.slice(-Number(range));
  }, [reports, range]);
  const history = useApi(
    () => Promise.all(months.map((m) => api.events(m))).then((lists) => lists.flat()),
    [months.join(",")],
    months.length > 0,
  );

  const data = useMemo<DayPoint[]>(() => {
    const byDay = new Map<string, DayPoint>();
    for (const e of history.data ?? []) {
      const day = e.date.slice(0, 10);
      const point = byDay.get(day) ?? { day, value: 0, count: 0 };
      point.value += e.valueBrl ?? 0;
      point.count += 1;
      byDay.set(day, point);
    }
    // Janela móvel de 30 dias em cada dia com movimento: sem ela a linha despenca a zero entre um
    // evento e outro e vira ruído.
    const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    const DAY_MS = 86_400_000;
    return days.map((p) => {
      const end = Date.parse(p.day);
      const window = days.filter((q) => {
        const t0 = Date.parse(q.day);
        return t0 <= end && t0 > end - 30 * DAY_MS;
      });
      return { day: p.day, value: window.reduce((s, q) => s + q.value, 0), count: window.reduce((s, q) => s + q.count, 0) };
    });
  }, [history.data]);
  // Um rótulo por mês no eixo X: o primeiro dia com movimento de cada mês.
  const monthTicks = data.filter((p, i) => i === 0 || p.day.slice(0, 7) !== data[i - 1].day.slice(0, 7)).map((p) => p.day);

  if ((loading && !reports) || (history.loading && !history.data)) return <Skeleton className="h-[360px] rounded-2xl" />;

  return (
    <section className="dash-card flex flex-col gap-4 px-6 py-5">
      <CardHeader icon={ChartLineIcon} title={ev.title} note={ev.note}>
        <div className="flex flex-wrap gap-2">
          <Segmented
            label={ev.metric}
            value={metric}
            onChange={setMetric}
            options={[
              { value: "value", label: ev.value },
              { value: "count", label: ev.count },
            ]}
          />
          <Segmented
            label={ev.range}
            value={range}
            onChange={setRange}
            options={[
              { value: "1", label: ev.months(1) },
              { value: "3", label: ev.months(3) },
              { value: "6", label: ev.months(6) },
              { value: "12", label: ev.years },
              { value: "all", label: ev.all },
            ]}
          />
        </div>
      </CardHeader>
      {data.length < 2 ? (
        <p className="m-0 flex h-[240px] items-center justify-center text-[13px] text-muted">{t.dashboard.monthlyEvolutionEmpty}</p>
      ) : (
        <div className="h-[250px]" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="evolutionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 5" />
              <XAxis
                dataKey="day"
                ticks={monthTicks}
                interval={0}
                tickFormatter={(day: string) => monthLabel(day.slice(0, 7)).split(" ")[0].slice(0, 3)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              />
              <YAxis
                width={metric === "value" ? 72 : 36}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(v: number) => (metric === "value" ? formatBRLShort(v) : formatInt(v))}
                tick={{ fill: "var(--color-muted)", fontSize: 11.5, fontFamily: "var(--font-mono)" }}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-soft)", strokeDasharray: "4 4" }}
                content={<EvolutionTooltip metric={metric} />}
              />
              <Area
                type="linear"
                dataKey={metric}
                stroke="#b3a0f4"
                strokeWidth={2}
                strokeLinejoin="round"
                fill="url(#evolutionFill)"
                dot={{ r: 2.6, fill: "#c9bcf7", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "var(--color-panel)", stroke: "#f2effb", strokeWidth: 2.5 }}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function EvolutionTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload: DayPoint }[];
  metric: Metric;
}) {
  const { t } = useI18n();
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line2 bg-panel/95 px-3.5 py-2.5 shadow-frame backdrop-blur">
      {/* Meio-dia: a data AAAA-MM-DD não cai no dia anterior no fuso de Brasília. */}
      <div className="text-[12px] text-muted">{formatDateMedium(`${p.day}T12:00:00Z`)}</div>
      <div className="font-mono text-[15px] font-semibold text-ink">
        {metric === "value" ? formatBRL(p.value) : t.dashboard.map.events(p.count)}
      </div>
    </div>
  );
}

/* ---------------- Distribuição por rede ---------------- */

export function NetworkPanel({ events, loading }: { events: TaxEvent[] | null; loading: boolean }) {
  const { t } = useI18n();
  const nw = t.dashboard.networks;
  const rows = useMemo(() => {
    const totals = new Map<Network, number>();
    for (const e of events ?? []) totals.set(e.network, (totals.get(e.network) ?? 0) + (e.valueBrl ?? 0));
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return {
      sum,
      list: [...totals.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([network, value]) => ({ network, value, share: sum > 0 ? value / sum : 0 })),
    };
  }, [events]);
  const [active, setActive] = useState<Network | null>(null);
  const focus = rows.list.find((r) => r.network === active) ?? null;

  if (loading && !events) return <Skeleton className="h-[360px] rounded-2xl" />;

  return (
    <section className="dash-card flex flex-col gap-4 px-6 py-5">
      <CardHeader icon={GlobeHemisphereWestIcon} title={nw.title} />
      {rows.list.length === 0 ? (
        <p className="m-0 flex flex-1 items-center justify-center py-10 text-[13px] text-muted">{nw.empty}</p>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
          {/* Anel fino com pontas arredondadas e respiro entre as fatias; passar o mouse numa fatia
              (ou na legenda) destaca a rede e mostra o valor dela no centro. */}
          <div className="relative size-[184px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows.list}
                  dataKey="value"
                  nameKey="network"
                  innerRadius="80%"
                  outerRadius="100%"
                  paddingAngle={rows.list.length > 1 ? 5 : 0}
                  cornerRadius="50%"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  animationDuration={800}
                  onMouseEnter={(_, i) => setActive(rows.list[i]?.network ?? null)}
                  onMouseLeave={() => setActive(null)}
                >
                  {rows.list.map((r) => (
                    <Cell
                      key={r.network}
                      fill={NETWORK_COLOR[r.network]}
                      opacity={active && active !== r.network ? 0.25 : 1}
                      className="cursor-pointer outline-none transition-opacity duration-200"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-[11.5px] text-muted">{focus ? NETWORK_NAME[focus.network] : nw.total}</span>
              <span className="font-mono text-[15px] font-semibold text-ink">{formatBRLShort(Math.round(focus ? focus.value : rows.sum))}</span>
              {focus && <span className="font-mono text-[11.5px] text-muted">{formatPct(focus.share * 100).replace("+", "")}</span>}
            </div>
          </div>
          <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
            {rows.list.map((r) => (
              <li
                key={r.network}
                onMouseEnter={() => setActive(r.network)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-[background-color,opacity] duration-200",
                  active === r.network && "bg-chip",
                  active && active !== r.network && "opacity-50",
                )}
              >
                <span aria-hidden className="h-2.5 w-1 shrink-0 rounded-full" style={{ background: NETWORK_COLOR[r.network] }} />
                <TokenIcon symbol={NETWORK_TOKEN[r.network]} size={18} />
                <span className="flex-1 text-ink">{NETWORK_NAME[r.network]}</span>
                <span className="font-mono text-[12px] text-muted">{formatBRLShort(Math.round(r.value))}</span>
                <span className="w-12 text-right font-mono text-ink">{formatPct(r.share * 100).replace("+", "")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link
        href="/carteiras"
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-accent/60 px-4 text-[13px] font-medium text-ink no-underline transition-colors hover:bg-accent/15"
      >
        {nw.seeAll}
        <ArrowRightIcon size={15} aria-hidden />
      </Link>
    </section>
  );
}

/* ---------------- Limite de isenção ---------------- */

export function ExemptionPanel({ volume, limit }: { volume: number; limit: number }) {
  const { t } = useI18n();
  const over = volume > limit;
  const pct = limit > 0 ? (volume / limit) * 100 : 0;
  const fill = Math.min(100, pct);

  return (
    <section className="dash-card flex flex-col gap-4 px-6 py-5">
      <CardHeader icon={GaugeIcon} title={t.dashboard.exemptionTitle}>
        <span className="flex items-center gap-1 text-muted" title={t.dashboard.exemptionMeter}>
          <InfoIcon size={16} aria-hidden />
          <span className="sr-only">{t.dashboard.exemptionMeter}</span>
        </span>
      </CardHeader>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] text-muted">
          <strong className="font-mono font-semibold text-ink">{formatBRL(volume)}</strong>{" "}
          {t.dashboard.exemptionUsedOf(formatBRL(limit))}
        </span>
        <span className={cn("font-mono text-[13px]", over ? "text-warn" : "text-ink")}>{formatPct(pct).replace("+", "")}</span>
      </div>
      <div
        className="relative h-3 rounded-full bg-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={volume}
        aria-label={t.dashboard.exemptionMeter}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
            over ? "bg-warn" : "bg-[linear-gradient(90deg,var(--color-accent),var(--color-soft))] shadow-[0_0_16px_color-mix(in_oklab,var(--color-accent)_60%,transparent)]",
          )}
          style={{ width: `${fill}%` }}
        />
        <span aria-hidden className="absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-sm bg-ink" style={{ left: `${fill}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[11.5px] text-muted">
        <span>{formatBRLShort(0)}</span>
        <span className={over ? "text-warn" : undefined}>
          {over ? t.dashboard.exemptionOver(formatBRL(volume - limit)) : t.dashboard.exemptionLeft(formatBRL(limit - volume))}
        </span>
        <span>{formatBRLShort(limit)}</span>
      </div>
    </section>
  );
}

/* ---------------- Ações rápidas ---------------- */

export function QuickActions({ month }: { month: string | undefined }) {
  const { t } = useI18n();
  const q = t.dashboard.quick;
  const tiles = [
    { href: "/carteiras", icon: PlusCircleIcon, title: q.importWallet, note: q.importWalletNote, primary: false },
    { href: month ? `/relatorios/${month}` : "/relatorios", icon: FileTextIcon, title: q.report, note: q.reportNote, primary: true },
  ];
  return (
    <section className="dash-card flex flex-col gap-4 px-6 py-5">
      <CardHeader icon={LightningIcon} title={q.title} />
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map(({ href, icon: I, title, note, primary }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "group flex items-center gap-3 rounded-xl border px-4 py-3.5 no-underline transition-colors",
              primary ? "border-accent/60 bg-accent/15 hover:bg-accent/25" : "border-line bg-bg/40 hover:border-line2",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                primary ? "bg-accent text-on-accent" : "border border-line2 text-ink",
              )}
            >
              <I size={20} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[14px] font-semibold text-ink">{title}</span>
              <span className="text-[12px] text-muted">{note}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Últimas transações ---------------- */

const TYPE_CHIP = (type: EventType) => ({ color: TYPE_COLOR[type], background: `${TYPE_COLOR[type]}1f` });

export function RecentEvents({
  events,
  loading,
  expanded,
  onToggle,
  onOpen,
  onPrice,
}: {
  events: TaxEvent[] | null;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (e: TaxEvent) => void;
  onPrice: (e: TaxEvent) => void;
}) {
  const { t } = useI18n();
  const r = t.dashboard.recent;
  const c = t.dashboard.cols;
  const latest = useMemo(() => [...(events ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [events]);

  return (
    <section className="dash-card flex flex-col gap-3 px-6 py-5">
      <CardHeader icon={ListChecksIcon} title={r.title}>
        {(events?.length ?? 0) > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="h-9 cursor-pointer rounded-xl border border-line2 px-3.5 text-[13px] text-ink transition-colors hover:border-accent"
          >
            {expanded ? r.seeLess : r.seeAll}
          </button>
        )}
      </CardHeader>
      {loading && !events ? (
        <div className="flex flex-col gap-3 pt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : latest.length === 0 ? (
        <p className="m-0 py-6 text-[13px] text-muted">{t.dashboard.noEvents}</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <caption className="sr-only">{r.title}</caption>
            <thead>
              <tr className="text-left font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">
                <th className="px-2 py-2 font-normal">{c.date}</th>
                <th className="px-2 py-2 font-normal">{c.network}</th>
                <th className="px-2 py-2 font-normal">{c.type}</th>
                <th className="px-2 py-2 font-normal">{c.asset}</th>
                <th className="px-2 py-2 text-right font-normal">{c.quantity}</th>
                <th className="px-2 py-2 text-right font-normal">{c.value}</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-2 py-2.5 font-mono text-[12.5px] text-muted">{formatDate(e.date)}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2">
                      <TokenIcon symbol={NETWORK_TOKEN[e.network]} size={18} />
                      <span className="text-ink">{NETWORK_NAME[e.network]}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="rounded-md px-2 py-0.5 text-[12px] font-medium" style={TYPE_CHIP(e.type)}>
                      {t.eventType[e.type]}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpen(e)}
                      aria-label={t.eventDialog.open(e.asset)}
                      className="flex cursor-pointer items-center gap-2 bg-transparent p-0 text-left font-medium text-ink hover:text-accent-text"
                    >
                      <TokenIcon symbol={e.quantityAsset} size={18} />
                      {e.quantityAsset}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono text-[12.5px] text-ink">{formatQty(e.quantity)}</td>
                  <td className="px-2 py-2.5 text-right font-mono text-[12.5px]">
                    {e.valueBrl === null ? (
                      <button
                        type="button"
                        onClick={() => onPrice(e)}
                        title={t.dashboard.setPriceTitle}
                        className="cursor-pointer rounded-md bg-warn-bg px-2 py-0.5 font-mono text-[11.5px] text-warn hover:brightness-95"
                      >
                        {t.dashboard.noPrice}
                      </button>
                    ) : (
                      formatBRL(e.valueBrl)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------- Resumo por tipo ---------------- */

export function TypeSummary({ events, loading }: { events: TaxEvent[] | null; loading: boolean }) {
  const { t } = useI18n();
  const ty = t.dashboard.types;
  const [metric, setMetric] = useState<"count" | "value">("count");
  const rows = useMemo(() => {
    const list = EVENT_TYPES.map((type) => {
      const evs = (events ?? []).filter((e) => e.type === type);
      return { type, count: evs.length, value: evs.reduce((s, e) => s + (e.valueBrl ?? 0), 0) };
    });
    const total = list.reduce((s, r) => s + r[metric], 0);
    return list.map((r) => ({ ...r, share: total > 0 ? r[metric] / total : 0 }));
  }, [events, metric]);

  return (
    <section className="dash-card flex flex-col gap-4 px-6 py-5">
      <CardHeader icon={SquaresFourIcon} title={ty.title}>
        <label className="sr-only" htmlFor="type-summary-metric">
          {ty.metric}
        </label>
        <select
          id="type-summary-metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as "count" | "value")}
          className="h-9 rounded-xl border border-line2 bg-bg px-2.5 text-[13px] text-ink"
        >
          <option value="count">{ty.byCount}</option>
          <option value="value">{ty.byValue}</option>
        </select>
      </CardHeader>
      {loading && !events ? (
        <Skeleton className="h-[180px]" />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {rows.map((r) => {
            const I = TYPE_ICON[r.type];
            return (
              <li key={r.type} className="grid grid-cols-[28px_minmax(0,96px)_1fr_52px_76px] items-center gap-3 text-[13px]">
                <span className="flex size-7 items-center justify-center rounded-lg" style={TYPE_CHIP(r.type)}>
                  <I size={15} aria-hidden />
                </span>
                <span className="truncate text-ink">{t.eventType[r.type]}</span>
                <span aria-hidden className="h-2 overflow-hidden rounded-full bg-track">
                  <span
                    className="block h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${r.share * 100}%`, background: TYPE_COLOR[r.type] }}
                  />
                </span>
                <span className="text-right font-mono text-[12.5px] text-ink">{formatPct(r.share * 100).replace("+", "")}</span>
                <span className="text-right font-mono text-[12.5px] text-muted">
                  {metric === "count" ? formatInt(r.count) : formatBRLShort(Math.round(r.value))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Faixa da Receita ---------------- */

export function ReceitaBanner({ month }: { month: string | undefined }) {
  const { t } = useI18n();
  const b = t.dashboard.banner;
  return (
    <section className="dash-card relative flex flex-col gap-5 overflow-hidden px-6 py-5 lg:flex-row lg:items-center">
      <div aria-hidden className="receita-banner-art" />
      <div className="relative flex min-w-0 flex-1 flex-col gap-1 lg:pl-40">
        <h2 className="m-0 flex items-center gap-2 font-display text-[18px] font-semibold text-ink">
          <FileArrowUpIcon size={20} aria-hidden className="text-accent-text lg:hidden" />
          {b.title}
        </h2>
        <p className="m-0 text-[13px] text-muted">{b.text}</p>
      </div>
      <ul className="relative m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
        {b.points.map((p) => (
          <li key={p} className="flex items-center gap-2 text-[12.5px] text-ink">
            <CheckCircleIcon size={17} weight="fill" aria-hidden className="shrink-0 text-ok" />
            {p}
          </li>
        ))}
      </ul>
      <Link
        href={month ? `/relatorios/${month}` : "/relatorios"}
        className="relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-medium text-on-accent no-underline transition-colors hover:bg-accent-hover"
      >
        {b.cta}
        <ArrowRightIcon size={16} aria-hidden />
      </Link>
    </section>
  );
}
