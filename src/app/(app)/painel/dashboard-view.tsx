"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, ArrowsClockwiseIcon, FileTextIcon, TrayIcon, WarningIcon } from "@phosphor-icons/react";
import { api, type EventType, type TaxEvent } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useSession } from "@/lib/session";
import { config } from "@/lib/config";
import {
  formatBRL,
  formatBRLShort,
  formatDate,
  formatDateTime,
  formatPct,
  formatQty,
  monthName,
  previousMonthKey,
  shortAddress,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Button, ButtonLink, Card, Chip, cn, Kicker, PageHeader, Panel, Skeleton, StateBlock } from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import { DemoNotice } from "@/components/demo-notice";
import { PriceDialog } from "@/components/price-dialog";
import { EventDialog } from "@/components/event-dialog";
import { Table, Td } from "@/components/table";

type Filter = "all" | EventType;
const FILTERS: Filter[] = ["all", "swap", "perp", "funding"];
const NETWORK = { solana: "Solana", hyperliquid: "Hyperliquid" } as const;

export function DashboardView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, refreshUser } = useSession();
  const { t } = useI18n();
  const onboarded = user?.onboarded ?? true;

  // Se a primeira sincronização ainda não tinha terminado no login, confere de novo ao abrir o painel.
  useEffect(() => {
    if (!onboarded) void refreshUser();
  }, [onboarded, refreshUser]);
  const requested = params.get("mes") ?? undefined;

  const reports = useApi(() => api.reports(), []);
  const dash = useApi(() => api.dashboard(requested), [requested]);
  const month = dash.data?.month ?? requested;
  const events = useApi(() => api.events(month!), [month], !!month);

  const [filter, setFilter] = useState<Filter>("all");
  const [pricing, setPricing] = useState<TaxEvent | null>(null);
  const [detail, setDetail] = useState<TaxEvent | null>(null);

  const months = useMemo(() => (reports.data ?? []).map((r) => r.month), [reports.data]);
  const visible = (events.data ?? []).filter((e) => filter === "all" || e.type === filter);

  const setMonth = (m: string) => {
    setFilter("all");
    router.replace(`${pathname}?mes=${m}`, { scroll: false });
  };

  const d = dash.data;

  if (dash.error && !d) {
    return (
      <>
        <PageHeader title={t.dashboard.title} />
        <StateBlock
          icon={WarningIcon}
          tone="danger"
          title={t.dashboard.loadError}
          actions={
            <Button icon={ArrowsClockwiseIcon} onClick={dash.reload}>
              {t.common.retry}
            </Button>
          }
        >
          {dash.error}
        </StateBlock>
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker={d ? t.dashboard.updatedAt(formatDateTime(d.updatedAt)) : t.common.loading}
        title={t.dashboard.title}
        actions={
          <>
            {month && months.length > 0 && <MonthPicker value={month} months={months} onChange={setMonth} />}
            <ButtonLink href={month ? `/relatorios/${month}` : "/relatorios"} icon={FileTextIcon}>
              {t.dashboard.generateReport}
            </ButtonLink>
          </>
        }
      />

      <DemoNotice text={t.demo.dashboard} />

      {user && !user.onboarded && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
          <span>{t.dashboard.firstSyncRunning}</span>
          <ButtonLink href="/sincronizacao" variant="link" iconRight={ArrowRightIcon}>
            {t.dashboard.seeProgress}
          </ButtonLink>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d ? (
          <>
            <Kpi label={t.dashboard.monthVolume} value={formatBRL(d.volumeBrl)} note={t.dashboard.disposals(d.disposals)} />
            <Kpi
              label={t.dashboard.capitalGain}
              value={formatBRL(d.capitalGainBrl)}
              note={
                d.gainChangePct !== null
                  ? t.dashboard.vsMonth(formatPct(d.gainChangePct), monthName(previousMonthKey(d.month)))
                  : t.dashboard.noPreviousMonth
              }
              noteClass={d.gainChangePct !== null ? (d.gainChangePct >= 0 ? "text-ok" : "text-danger") : undefined}
            />
            <Kpi
              label={t.dashboard.estimatedTax}
              value={formatBRL(d.estimatedTaxBrl)}
              note={
                d.volumeBrl <= d.exemptionLimitBrl ? t.dashboard.exemptBelow(formatBRLShort(d.exemptionLimitBrl)) : t.dashboard.aboveLimit
              }
            />
            <Kpi
              label={t.dashboard.missingPrices}
              value={String(d.missingPrices)}
              valueClass={d.missingPrices > 0 ? "text-warn" : undefined}
              note={d.missingPrices > 0 ? t.dashboard.reviewFirst : t.dashboard.allPriced}
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[126px] rounded-xl" />)
        )}
      </div>

      {/* Limite de isenção */}
      {d ? <ExemptionBar volume={d.volumeBrl} limit={d.exemptionLimitBrl} /> : <Skeleton className="h-[120px] rounded-xl" />}

      {/* Eventos */}
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-[18px]">
          <h2 className="type-h2 m-0">{t.dashboard.monthEvents}</h2>
          <div role="group" aria-label={t.dashboard.filterByType} className="flex gap-1 rounded-xl border border-line bg-bg p-[3px]">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "cursor-pointer rounded-[9px] px-3 py-1.5 text-[13px] transition-colors",
                  filter === f ? "bg-chip font-medium text-chip-text" : "text-muted hover:text-ink",
                )}
              >
                {f === "all" ? t.dashboard.filterAll : t.eventType[f]}
              </button>
            ))}
          </div>
        </div>

        {events.loading && !events.data ? (
          <div className="flex flex-col gap-3 p-6">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : events.error ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-danger">
            {events.error}
            <Button size="sm" variant="secondary" onClick={events.reload}>
              {t.common.retry}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-8 text-sm text-muted">
            <TrayIcon size={26} className="text-accent-text" aria-hidden />
            {filter === "all" ? t.dashboard.noEvents : t.dashboard.noEventsOfType}
          </div>
        ) : (
          <Table
            caption={t.dashboard.monthEvents}
            minWidth={900}
            columns={[
              { label: t.dashboard.cols.date, width: "126px" },
              { label: t.dashboard.cols.network, width: "146px" },
              { label: t.dashboard.cols.type, width: "116px" },
              { label: t.dashboard.cols.asset, width: "156px" },
              { label: t.dashboard.cols.quantity, align: "right" },
              { label: t.dashboard.cols.value, width: "166px", align: "right" },
              { label: t.dashboard.cols.tx, width: "146px" },
            ]}
          >
            {visible.map((e) => (
              <tr key={e.id}>
                <Td className="font-mono text-[13px]">{formatDate(e.date)}</Td>
                <Td className="text-[13px]">{NETWORK[e.network]}</Td>
                <Td>
                  <Chip>{e.type}</Chip>
                </Td>
                <Td className="font-medium">
                  <button
                    type="button"
                    onClick={() => setDetail(e)}
                    aria-label={t.eventDialog.open(e.asset)}
                    className="cursor-pointer bg-transparent p-0 text-left font-medium text-ink underline decoration-line2 underline-offset-4 hover:decoration-accent"
                  >
                    {e.asset}
                  </button>
                </Td>
                <Td align="right" className="font-mono text-[13px]">
                  {formatQty(e.quantity)} {e.quantityAsset}
                </Td>
                <Td align="right">
                  {e.valueBrl === null ? (
                    <button
                      type="button"
                      onClick={() => setPricing(e)}
                      className="inline-flex cursor-pointer items-center gap-[5px] rounded-lg bg-warn-bg px-2 py-[3px] font-mono text-xs text-warn transition-[filter] hover:brightness-95"
                      title={t.dashboard.setPriceTitle}
                    >
                      <WarningIcon size={13} aria-hidden />
                      {t.dashboard.noPrice}
                    </button>
                  ) : (
                    <span className="font-mono text-[13px]">
                      {formatBRL(e.valueBrl)}
                      {e.priceSource === "manual" && (
                        <span className="ml-1.5 text-[11px] text-faint" title={t.common.manualTitle}>
                          {t.common.manual}
                        </span>
                      )}
                    </span>
                  )}
                </Td>
                <Td>
                  {/* Modo demonstração: a transação é fictícia, então não há link para o explorador. */}
                  {config.useMocks ? (
                    <span className="font-mono text-xs text-muted" title={t.demo.fakeTx}>
                      {shortAddress(e.txHash)}
                    </span>
                  ) : (
                    <a
                      href={e.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-accent-text hover:underline"
                    >
                      {shortAddress(e.txHash)}
                    </a>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <EventDialog
        event={detail}
        onClose={() => setDetail(null)}
        onSetPrice={(e) => {
          setDetail(null);
          setPricing(e);
        }}
      />

      <PriceDialog
        event={pricing}
        onClose={() => setPricing(null)}
        onSaved={(updated) => {
          setPricing(null);
          events.setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
          void dash.reload();
        }}
      />

      {d && d.missingPrices === 0 && month && (
        <p className="m-0 text-[13px] text-muted">
          {t.dashboard.allGood(monthName(month))}{" "}
          <Link href={`/relatorios/${month}`} className="font-medium text-accent-text">
            {t.dashboard.openMonthReport}
          </Link>
          .
        </p>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  note,
  noteClass,
  valueClass,
}: {
  label: string;
  value: string;
  note: string;
  noteClass?: string;
  valueClass?: string;
}) {
  return (
    <Card className="flex flex-col gap-3.5 px-6 py-[22px]">
      <Kicker as="h2">{label}</Kicker>
      <span className={cn("font-mono text-[26px] leading-tight font-medium tracking-[-0.02em]", valueClass)}>{value}</span>
      <span className={cn("text-[13px] text-muted", noteClass)}>{note}</span>
    </Card>
  );
}

function ExemptionBar({ volume, limit }: { volume: number; limit: number }) {
  const scaleMax = Math.max(limit * (40 / 35), Math.ceil((volume * 1.12) / 5000) * 5000);
  const pct = Math.min(100, (volume / scaleMax) * 100);
  const limitPct = (limit / scaleMax) * 100;
  const over = volume > limit;
  const remaining = limit - volume;
  const { t } = useI18n();

  return (
    <Panel className="flex flex-col gap-4 px-7 py-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="type-h2 m-0">{t.dashboard.exemptionTitle}</h2>
        <span className="font-mono text-[13px] text-muted">
          {t.dashboard.exemptionOf(formatBRL(volume), formatBRL(limit))} ·{" "}
          {over ? t.dashboard.exemptionOver(formatBRL(-remaining)) : t.dashboard.exemptionLeft(formatBRL(remaining))}
        </span>
      </div>
      <div
        className="relative h-11"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={scaleMax}
        aria-valuenow={volume}
        aria-label={t.dashboard.exemptionMeter}
      >
        <div className="absolute inset-x-0 top-2 h-2.5 rounded-[10px] bg-track" />
        <div
          className={cn(
            "absolute top-2 left-0 h-2.5 rounded-[10px] transition-[width] duration-700 ease-out",
            over ? "bg-warn" : "bg-accent",
          )}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute top-0 h-[26px] w-[3px] -translate-x-1/2 rounded-sm bg-gold" style={{ left: `${limitPct}%` }} />
        <span
          className="absolute top-[30px] -translate-x-1/2 font-mono text-[11px] whitespace-nowrap text-ink"
          style={{ left: `${limitPct}%` }}
        >
          {formatBRLShort(limit)}
        </span>
        <span className="absolute top-[30px] left-0 hidden font-mono text-[11px] text-muted sm:inline">{formatBRLShort(0)}</span>
        <span className="absolute top-[30px] right-0 hidden font-mono text-[11px] text-muted sm:inline">{formatBRLShort(scaleMax)}</span>
      </div>
    </Panel>
  );
}
