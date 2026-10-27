"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  ChartBarIcon,
  GraphIcon,
  ListBulletsIcon,
  ReceiptIcon,
  TrayIcon,
  TrendUpIcon,
  WarningCircleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { api, isDemoSession, type EventType, type TaxEvent } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { eventCost } from "@/lib/event-cost";
import { useSession } from "@/lib/session";
import { config } from "@/lib/config";
import {
  formatBRL,
  formatBRLShort,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatPct,
  formatQty,
  formatQtyFull,
  isPseudoHash,
  monthLong,
  monthName,
  previousMonthKey,
  shortAddress,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Button, ButtonLink, Card, Chip, cn, Panel, Select, Skeleton } from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import { TokenIcon } from "@/components/token-icon";
import { InteractiveMap } from "@/components/interactive-map";
import { DemoNotice } from "@/components/demo-notice";
import { PriceDialog } from "@/components/price-dialog";
import { EventDialog } from "@/components/event-dialog";
import { Table, Td } from "@/components/table";
import { LoadFailure, StaleDataError } from "@/components/load-failure";
import { AccountMenu, NotificationsMenu, SearchBox, type Notice } from "@/components/dashboard-topbar";
import {
  cumulativeByDay,
  EvolutionPanel,
  ExemptionPanel,
  KpiCard,
  NETWORK_NAME,
  NetworkPanel,
  QuickActions,
  ReceitaBanner,
  RecentEvents,
  TypeSummary,
} from "./dashboard-cards";

type Filter = "all" | EventType;
const FILTERS: Filter[] = ["all", "swap", "perp", "funding", "transfer"];
type NetworkFilter = "all" | "solana" | "hyperliquid";

/** "+24,8%" sem o sinal: a seta do KPI já diz a direção. */
const unsignedPct = (v: number) => formatPct(Math.abs(v)).replace("+", "");

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
  const wallets = useApi(() => api.listWallets(), []);
  const dash = useApi(() => api.dashboard(requested), [requested]);
  const month = dash.data?.month ?? requested;
  const events = useApi(() => api.events(month!), [month], !!month);

  const [filter, setFilter] = useState<Filter>("all");
  const [networkFilter, setNetworkFilter] = useState<NetworkFilter>("all");
  const [walletFilter, setWalletFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);

  /*
   * Vem do "+N no modo simples" do mapa interativo: chega já no tipo certo e com a tabela aberta.
   * Não dá pra usar useState(() => ...): o link troca só o ?tipo= na mesma rota (/painel), o
   * React não remonta o componente, e um initializer de useState só roda no primeiro mount.
   * Em vez de setState dentro de um efeito, ajusta durante a própria renderização (padrão oficial
   * do React pra "adjusting state when a prop changes") — um `consumedType` guarda o último valor
   * já aplicado, pra não reaplicar o filtro de novo a cada render.
   */
  const [consumedType, setConsumedType] = useState<string | null>(null);
  const wantedType = params.get("tipo");
  if (wantedType && wantedType !== consumedType && FILTERS.includes(wantedType as Filter)) {
    setConsumedType(wantedType);
    setFilter(wantedType as Filter);
    setShowAll(true);
  }
  // Tira o ?tipo= da URL depois de aplicado, só pra não deixar lixo visível nela.
  useEffect(() => {
    if (!wantedType) return;
    const q = new URLSearchParams(params.toString());
    q.delete("tipo");
    const query = q.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reagir à presença de ?tipo=, não a identidade de params/router
  }, [wantedType]);

  const [pricing, setPricing] = useState<TaxEvent | null>(null);
  const [detail, setDetail] = useState<TaxEvent | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);

  const months = useMemo(() => (reports.data ?? []).map((r) => r.month), [reports.data]);
  const visible = (events.data ?? []).filter(
    (e) =>
      (filter === "all" || e.type === filter) &&
      (networkFilter === "all" || e.network === networkFilter) &&
      (walletFilter === "all" || e.wallet?.address === walletFilter),
  );

  // F15: vendas com custo não encontrado no mês inteiro (não só no filtro), para o aviso de baixo.
  const costUnknownCount = (events.data ?? []).filter((e) => eventCost(e).costUnknown).length;

  // Modo do painel na URL (como o mês): o link compartilhado abre no mesmo modo.
  const interactive = params.get("modo") === "interativo";
  const replaceParams = (change: (q: URLSearchParams) => void) => {
    const q = new URLSearchParams(params.toString());
    change(q);
    const query = q.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setMonth = (m: string) => {
    setFilter("all");
    replaceParams((q) => q.set("mes", m));
  };
  const setInteractive = (on: boolean) => replaceParams((q) => (on ? q.set("modo", "interativo") : q.delete("modo")));

  const d = dash.data;
  const reportHref = month ? `/relatorios/${month}` : "/relatorios";

  // Minigráficos dos KPIs: acumulado por dia dentro do mês.
  const sparks = useMemo(() => {
    const list = events.data ?? [];
    return {
      volume: cumulativeByDay(list, (e) => e.valueBrl ?? 0),
      gain: cumulativeByDay(list, (e) => e.gainBrl ?? 0),
      missing: cumulativeByDay(list, (e) => (e.valueBrl === null ? 1 : 0)),
    };
  }, [events.data]);

  // Volume vs. mês anterior: o total alienado do relatório do mês anterior é a base.
  const previous = month ? reports.data?.find((r) => r.month === previousMonthKey(month)) : undefined;
  const volumeChange = d && previous && previous.totalBrl > 0 ? ((d.volumeBrl - previous.totalBrl) / previous.totalBrl) * 100 : null;

  const n = t.dashboard.notifications;
  const notices: Notice[] = [
    ...(user && !user.onboarded ? [{ id: "sync", text: n.syncRunning, href: "/sincronizacao", tone: "accent" as const }] : []),
    ...(wallets.data ?? [])
      .filter((w) => w.status === "error")
      .map((w) => ({ id: `w-${w.id}`, text: n.walletError(w.label), href: "/carteiras", tone: "danger" as const })),
    ...(d && d.missingPrices > 0 ? [{ id: "price", text: n.missingPrices(d.missingPrices), href: reportHref, tone: "warn" as const }] : []),
    ...(costUnknownCount > 0 ? [{ id: "cost", text: n.costUnknown(costUnknownCount), href: reportHref, tone: "warn" as const }] : []),
    ...(d?.exemptionStatus === "taxable"
      ? [{ id: "tax", text: n.taxable(formatBRL(d.estimatedTaxBrl)), href: reportHref, tone: "warn" as const }]
      : []),
  ];

  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? null;

  const header = (
    <header className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="flex min-w-0 flex-col gap-2 lg:pt-1">
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">{formatLongDate(new Date())}</span>
        <h1 className="type-h1 m-0 flex flex-wrap items-center gap-3 text-balance">
          {t.dashboard.hello(firstName)}
          <span aria-hidden className="wave-hand inline-block">
            👋
          </span>
        </h1>
        <p className="m-0 text-[15px] text-muted">
          {t.dashboard.subtitle}
          {d && <span className="block pt-1 text-[12px] text-faint">{t.dashboard.updatedAt(formatDateTime(d.updatedAt))}</span>}
        </p>
      </div>
      <div className="flex flex-col gap-3 lg:items-end">
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <SearchBox events={events.data} wallets={wallets.data} onOpenEvent={setDetail} />
          </div>
          <NotificationsMenu notices={notices} />
          <AccountMenu />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
          <div role="group" aria-label={t.dashboard.viewMode} className="flex gap-1 rounded-xl border border-line bg-panel/80 p-[3px] backdrop-blur">
            {([false, true] as const).map((on) => {
              const I = on ? GraphIcon : ListBulletsIcon;
              return (
                <button
                  key={String(on)}
                  type="button"
                  aria-pressed={interactive === on}
                  onClick={() => setInteractive(on)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[13px] transition-colors",
                    interactive === on ? "bg-chip font-medium text-chip-text" : "text-muted hover:text-ink",
                  )}
                >
                  <I size={15} aria-hidden />
                  {on ? t.dashboard.viewInteractive : t.dashboard.viewSimple}
                </button>
              );
            })}
          </div>
          {month && months.length > 0 && <MonthPicker value={month} months={months} onChange={setMonth} />}
          <ButtonLink href={reportHref} iconRight={ArrowRightIcon}>
            {t.dashboard.generateDeclaration}
          </ButtonLink>
        </div>
      </div>
    </header>
  );

  if (dash.error && !d) {
    return (
      <>
        {header}
        <LoadFailure title={t.dashboard.loadError} error={dash.error} onRetry={dash.reload} />
      </>
    );
  }

  return (
    <>
      <div aria-hidden className="painel-hero" />
      <div aria-hidden className="painel-glow" />
      {header}

      <DemoNotice text={t.demo.dashboard} />
      {reviewNotice && <Card role="status" className="px-5 py-3 text-sm text-muted">{reviewNotice}</Card>}
      <StaleDataError error={d ? dash.error : null} onRetry={dash.reload} />

      {user && !user.onboarded && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
          <span>{t.dashboard.firstSyncRunning}</span>
          <ButtonLink href="/sincronizacao" variant="link" iconRight={ArrowRightIcon}>
            {t.dashboard.seeProgress}
          </ButtonLink>
        </Card>
      )}

      {interactive ? (
        <InteractiveMap
          events={events.data}
          loading={events.loading || !month}
          monthText={month ? monthLong(month) : ""}
          monthKey={month ?? null}
          totals={d ? { volumeBrl: d.volumeBrl, capitalGainBrl: d.capitalGainBrl, estimatedTaxBrl: d.estimatedTaxBrl } : null}
          onOpenEvent={setDetail}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d ? (
              <>
                <KpiCard
                  icon={ChartBarIcon}
                  label={t.dashboard.monthVolume}
                  value={formatBRL(d.volumeBrl)}
                  note={t.dashboard.disposals(d.disposals)}
                  trend={volumeChange !== null ? { pct: volumeChange, text: t.dashboard.vsPrevious(unsignedPct(volumeChange)) } : null}
                  spark={sparks.volume}
                />
                <KpiCard
                  icon={TrendUpIcon}
                  label={t.dashboard.capitalGain}
                  value={formatBRL(d.capitalGainBrl)}
                  note={t.dashboard.netResult}
                  trend={
                    d.gainChangePct !== null
                      ? { pct: d.gainChangePct, text: t.dashboard.vsPrevious(unsignedPct(d.gainChangePct)) }
                      : null
                  }
                  spark={sparks.gain}
                />
                <KpiCard
                  icon={ReceiptIcon}
                  label={t.dashboard.estimatedTax}
                  value={formatBRL(d.estimatedTaxBrl)}
                  note={
                    // Isenção é conclusão do motor fiscal (regra validada); o front não deduz comparando volume e limite.
                    d.exemptionStatus === "exempt"
                      ? t.dashboard.exemptBelow(formatBRLShort(d.exemptionLimitBrl))
                      : d.exemptionStatus === "taxable"
                        ? t.dashboard.aboveLimit
                        : t.dashboard.exemptionUnconfirmed
                  }
                />
                <KpiCard
                  icon={WarningCircleIcon}
                  label={t.dashboard.missingPrices}
                  value={String(d.missingPrices)}
                  valueClass={d.missingPrices > 0 ? "text-warn" : undefined}
                  note={d.missingPrices > 0 ? t.dashboard.reviewFirst : t.dashboard.allPriced}
                  spark={d.missingPrices > 0 ? sparks.missing : undefined}
                  sparkColor="#f87171"
                  href={d.missingPrices > 0 ? reportHref : undefined}
                  hrefLabel={t.dashboard.reviewPending}
                />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[150px] rounded-2xl" />)
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
            <EvolutionPanel reports={reports.data} loading={reports.loading} />
            <NetworkPanel events={events.data} loading={events.loading || !month} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)]">
            {d ? <ExemptionPanel volume={d.volumeBrl} limit={d.exemptionLimitBrl} /> : <Skeleton className="h-[170px] rounded-2xl" />}
            <QuickActions month={month} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.42fr)_minmax(0,1fr)]">
            <RecentEvents
              events={events.data}
              loading={events.loading || !month}
              expanded={showAll}
              onToggle={() => setShowAll((v) => !v)}
              onOpen={setDetail}
              onPrice={setPricing}
            />
            <TypeSummary events={events.data} loading={events.loading || !month} />
          </div>

          {showAll && (
            <EventsTable
              events={events.data}
              visible={visible}
              loading={events.loading || !month}
              error={events.error}
              onRetry={events.reload}
              wallets={wallets.data ?? []}
              filter={filter}
              setFilter={setFilter}
              networkFilter={networkFilter}
              setNetworkFilter={setNetworkFilter}
              walletFilter={walletFilter}
              setWalletFilter={setWalletFilter}
              onDetail={setDetail}
              onPrice={setPricing}
            />
          )}

          <ReceitaBanner month={month} />
        </div>
      )}

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
          setReviewNotice(t.priceDialog.saved);
          events.setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
          void dash.reload();
        }}
      />

      {d && month && costUnknownCount > 0 && (
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-[13px] text-warn">
          <WarningIcon size={15} aria-hidden />
          {t.dashboard.costUnknownPending(costUnknownCount)}{" "}
          <Link href={reportHref} className="font-medium text-accent-text">
            {t.dashboard.reviewPending}
          </Link>
        </p>
      )}
      {d && d.missingPrices === 0 && costUnknownCount === 0 && events.data && month && (
        <p className="m-0 text-[13px] text-muted">
          {t.dashboard.allGood(monthName(month))}{" "}
          <Link href={reportHref} className="font-medium text-accent-text">
            {t.dashboard.openMonthReport}
          </Link>
          .
        </p>
      )}
    </>
  );
}

/** Tabela completa do mês, com filtros (aberta por "Ver todas" nas últimas transações). */
function EventsTable({
  events,
  visible,
  loading,
  error,
  onRetry,
  wallets,
  filter,
  setFilter,
  networkFilter,
  setNetworkFilter,
  walletFilter,
  setWalletFilter,
  onDetail,
  onPrice,
}: {
  events: TaxEvent[] | null;
  visible: TaxEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  wallets: { id: string; address: string; label: string }[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  networkFilter: NetworkFilter;
  setNetworkFilter: (f: NetworkFilter) => void;
  walletFilter: string;
  setWalletFilter: (w: string) => void;
  onDetail: (e: TaxEvent) => void;
  onPrice: (e: TaxEvent) => void;
}) {
  const { t } = useI18n();
  return (
    <Panel className="overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-[18px]">
        <h2 className="m-0 font-display text-[17px] font-semibold">{t.dashboard.monthEvents}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label={t.dashboard.filterByNetwork}
            value={networkFilter}
            onChange={setNetworkFilter}
            options={[
              { value: "all", label: t.dashboard.networkAll },
              { value: "solana", label: "Solana" },
              { value: "hyperliquid", label: "Hyperliquid" },
            ]}
          />
          <Select
            label={t.dashboard.filterByWallet}
            value={walletFilter}
            onChange={setWalletFilter}
            triggerClassName="max-w-[220px]"
            options={[
              { value: "all", label: t.dashboard.walletAll },
              ...wallets.map((wallet) => ({ value: wallet.address, label: `${wallet.label} · ${shortAddress(wallet.address)}` })),
            ]}
          />
          {walletFilter !== "all" && (events ?? []).some((event) => !event.wallet) && (
            <span className="text-xs text-muted">{t.dashboard.walletFilterHint}</span>
          )}
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
      </div>

      {events && error && (
        <div className="px-6 pt-4">
          <StaleDataError error={error} onRetry={onRetry} />
        </div>
      )}

      {/* F17: sem mês ainda (o painel está carregando), a busca de eventos nem começou: esqueleto, não "nenhum evento". */}
      {loading && !events ? (
        <div className="flex flex-col gap-3 p-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      ) : error && !events ? (
        <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-danger">
          {error}
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {t.common.retry}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 p-8 text-sm text-muted">
          <TrayIcon size={26} className="text-accent-text" aria-hidden />
          {filter === "all" && networkFilter === "all" && walletFilter === "all" ? t.dashboard.noEvents : t.dashboard.noEventsOfFilter}
        </div>
      ) : (
        <Table
          caption={t.dashboard.monthEvents}
          minWidth={1060}
          columns={[
            { label: t.dashboard.cols.date, width: "126px" },
            { label: t.dashboard.cols.network, width: "146px" },
            { label: t.eventDialog.wallet, width: "160px" },
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
              <Td className="text-[13px]">{NETWORK_NAME[e.network]}</Td>
              <Td className="text-[13px]">
                <span className="block max-w-40 truncate" title={e.wallet?.address || undefined}>
                  {e.wallet?.label || shortAddress(e.wallet?.address) || t.report.notReported}
                </span>
                {e.wallet?.label && e.wallet.address && (
                  <span className="block font-mono text-xs text-muted">{shortAddress(e.wallet.address)}</span>
                )}
              </Td>
              <Td>
                <Chip>{t.eventType[e.type]}</Chip>
                {e.type === "transfer" && e.direction && (
                  <span className="block pt-1 text-xs text-muted" title={e.counterparty ?? undefined}>
                    {e.direction === "in" ? t.dashboard.transferIn : t.dashboard.transferOut}
                    {e.counterparty &&
                      ` ${e.direction === "in" ? t.dashboard.transferFrom(shortAddress(e.counterparty)) : t.dashboard.transferTo(shortAddress(e.counterparty))}`}
                  </span>
                )}
              </Td>
              <Td className="font-medium">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={e.quantityAsset} />
                  <button
                    type="button"
                    onClick={() => onDetail(e)}
                    aria-label={t.eventDialog.open(e.asset)}
                    className="cursor-pointer bg-transparent p-0 text-left font-medium text-ink underline decoration-line2 underline-offset-4 hover:decoration-accent"
                  >
                    {e.asset}
                  </button>
                </div>
                {eventCost(e).costUnknown && (
                  <span
                    className="mt-1 block w-fit rounded-md border border-dashed border-warn px-1.5 py-px font-mono text-[10.5px] text-warn"
                    title={t.report.costUnknownTitle}
                  >
                    {t.report.costUnknownBadge}
                  </span>
                )}
                {/* A3: "N fills" só quando o evento agrupou mais de uma execução. */}
                {typeof e.fillCount === "number" && e.fillCount > 1 && (
                  <span className="block font-mono text-xs text-muted">{t.common.fills(e.fillCount)}</span>
                )}
              </Td>
              <Td align="right" className="font-mono text-[13px]">
                <span title={`${formatQtyFull(e.quantity)} ${e.quantityAsset}`}>
                  {formatQty(e.quantity)} {e.quantityAsset}
                </span>
                {/* A1: lado que entrou na troca. Fora de swap, ou em rota com mais de um ativo de
                    entrada, quantityIn/quantityInAsset vêm null e a linha não aparece. */}
                {typeof e.quantityIn === "number" && !!e.quantityInAsset && (
                  <span className="block text-xs text-muted" title={`${formatQtyFull(e.quantityIn)} ${e.quantityInAsset}`}>
                    {t.dashboard.bought(formatQty(e.quantityIn), e.quantityInAsset)}
                  </span>
                )}
              </Td>
              <Td align="right">
                {e.valueBrl === null ? (
                  <button
                    type="button"
                    onClick={() => onPrice(e)}
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
                {config.useMocks || isDemoSession() ? (
                  <span className="font-mono text-xs text-muted" title={t.demo.fakeTx}>
                    {shortAddress(e.txHash)}
                  </span>
                ) : isPseudoHash(e.txHash) ? (
                  // F16: sem hash real, o link do explorador cairia na página da carteira.
                  <span className="font-mono text-xs text-muted" title={t.common.noTxHashTitle}>
                    {t.common.noTxHash}
                  </span>
                ) : (
                  <a href={e.explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-accent-text hover:underline">
                    {shortAddress(e.txHash)}
                  </a>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}
