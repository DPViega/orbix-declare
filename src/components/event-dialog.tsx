"use client";

import { useEffect, useRef } from "react";
import { ArrowSquareOutIcon, CheckCircleIcon, InfoIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { api, isDemoSession, type TaxEvent } from "@/lib/api";
import Link from "next/link";
import { useApi } from "@/lib/use-api";
import { eventCost, eventMonth } from "@/lib/event-cost";
import { config } from "@/lib/config";
import { formatBRL, formatDate, formatDateTime, formatPtax, formatQtyFull, formatUnitPriceBRL, isPseudoHash, shortAddress } from "@/lib/format";
import { Button, Chip, cn, Kicker } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const NETWORK = { solana: "Solana", hyperliquid: "Hyperliquid" } as const;

/**
 * Detalhes de um evento do mês: origem, valores, preço utilizado e pendências.
 * Campos que o back-end não mandou aparecem como "Indisponível".
 */
export function EventDialog({
  event,
  onClose,
  onSetPrice,
}: {
  event: TaxEvent | null;
  onClose: () => void;
  onSetPrice: (e: TaxEvent) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t, locale } = useI18n();
  const d = t.eventDialog;
  const month = event ? eventMonth(event.date) : null;
  const report = useApi(() => api.report(month!), [month, event?.id, locale],
    !!event && (event.type === "swap" || event.type === "perp") && (event.costUnknown == null || event.costManual == null));
  const cost = event ? eventCost(event, report.data?.rows.find((row) => row.id === event.id)) : { costUnknown: false, costManual: false };

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (event && !dlg.open) dlg.showModal();
    else if (!event && dlg.open) dlg.close();
  }, [event]);

  const na = <span className="text-faint">{d.unavailable}</span>;
  const brl = (v: number | null | undefined) => (v === null || v === undefined ? na : formatBRL(v));
  const unitPrice = (v: number | null | undefined) => (v === null || v === undefined ? na : formatUnitPriceBRL(v));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="event-title"
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-panel p-0 text-ink shadow-frame"
    >
      {event && (
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Kicker>{d.title}</Kicker>
              <h2 id="event-title" className="type-h2 m-0">
                {t.eventType[event.type]} · {event.asset}
              </h2>
              <span className="font-mono text-[13px] text-muted">{formatDateTime(event.date)}</span>
            </div>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted hover:text-ink"
            >
              <XIcon size={18} aria-hidden />
            </button>
          </div>

          <Section title={d.origin}>
            <Field label={d.network}>
              <Chip>{NETWORK[event.network]}</Chip>
            </Field>
            <Field label={d.wallet}>
              {event.wallet ? (
                <span className="flex flex-col">
                  {event.wallet.label && <span>{event.wallet.label}</span>}
                  <span className="font-mono text-[12.5px] text-muted" title={event.wallet.address}>
                    {shortAddress(event.wallet.address)}
                  </span>
                </span>
              ) : (
                na
              )}
            </Field>
            <Field label={d.protocol}>{event.protocol || na}</Field>
            {event.type === "transfer" && event.direction && (
              <Field label={d.direction}>
                {event.direction === "in" ? t.dashboard.transferIn : t.dashboard.transferOut}
                {event.counterparty && (
                  <span className="font-mono text-[12.5px] text-muted" title={event.counterparty}>
                    {" "}
                    {event.direction === "in"
                      ? t.dashboard.transferFrom(shortAddress(event.counterparty, 6, 6))
                      : t.dashboard.transferTo(shortAddress(event.counterparty, 6, 6))}
                  </span>
                )}
              </Field>
            )}
            {/* A3: "N fills" só quando o evento agrupou mais de uma execução; ausente/null não é zero. */}
            {typeof event.fillCount === "number" && event.fillCount > 1 && (
              <Field label={d.fills}>
                <span className="font-mono text-[13px]">{t.common.fills(event.fillCount)}</span>
              </Field>
            )}
            <Field label={d.tx} last>
              {config.useMocks || isDemoSession() ? (
                <span className="flex flex-col">
                  <span className="font-mono text-[12.5px] text-muted">{shortAddress(event.txHash, 8, 6)}</span>
                  <span className="text-[12.5px] text-warn">{t.demo.fakeTx}</span>
                </span>
              ) : isPseudoHash(event.txHash) ? (
                <span className="font-mono text-[12.5px] text-muted" title={t.common.noTxHashTitle}>
                  {t.common.noTxHash}
                </span>
              ) : (
                <a
                  href={event.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-accent-text hover:underline"
                >
                  {shortAddress(event.txHash, 8, 6)}
                  <ArrowSquareOutIcon size={14} aria-hidden />
                </a>
              )}
            </Field>
          </Section>

          <Section title={d.values}>
            <Field label={d.quantity}>
              <span className="font-mono text-[13px]">
                {formatQtyFull(event.quantity)} {event.quantityAsset}
              </span>
            </Field>
            {/*
              A1: os dois lados da troca. quantityIn/quantityInAsset vêm null fora de swap e em rota
              com mais de um ativo de entrada — nesse caso a linha simplesmente não aparece.
            */}
            {typeof event.quantityIn === "number" && !!event.quantityInAsset && (
              <Field label={d.swapSides} wide>
                <span className="font-mono text-[13px]">
                  {d.swapSidesValue(
                    formatQtyFull(event.quantityIn),
                    event.quantityInAsset,
                    formatQtyFull(Math.abs(event.quantity)),
                    event.quantityAsset,
                  )}
                </span>
              </Field>
            )}
            <Field label={d.unitPrice}>
              <span className="font-mono text-[13px]">{unitPrice(event.unitPriceBrl)}</span>
            </Field>
            <Field label={d.value}>
              <span className="font-mono text-[13px]">{brl(event.valueBrl)}</span>
            </Field>
            <Field label={d.cost}>
              <span className="font-mono text-[13px]">{brl(event.costBrl)}</span>
            </Field>
            <Field label={d.gain} last>
              <span
                className={cn(
                  "font-mono text-[13px]",
                  typeof event.gainBrl === "number" && (event.gainBrl >= 0 ? "text-ok" : "text-danger"),
                )}
              >
                {brl(event.gainBrl)}
              </span>
            </Field>
          </Section>

          <CostOrigin event={event} {...cost} />

          <Section title={d.price}>
            <Field label={d.source}>
              {event.priceSource === "auto" ? (
                d.sourceAuto(event.priceProvider ?? null)
              ) : event.priceSource === "manual" ? (
                d.sourceManual
              ) : (
                <span className="text-warn">{d.sourceNone}</span>
              )}
            </Field>
            <Field label={d.ptax}>
              <span className="font-mono text-[13px]">
                {typeof event.ptax === "number"
                  ? event.ptaxDate
                    ? d.ptaxOf(formatPtax(event.ptax), formatDate(`${event.ptaxDate}T12:00:00Z`))
                    : formatPtax(event.ptax)
                  : na}
              </span>
            </Field>
            <Field label={d.quoteTime}>
              <span className="font-mono text-[13px]">
                {event.priceObservedAt ? formatDateTime(event.priceObservedAt) : na}
              </span>
            </Field>
            <Field label={d.ruleVersion}>
              <span className="font-mono text-[13px]">{event.ruleVersion || na}</span>
            </Field>
            <Field label={d.fees} last>
              <span className="font-mono text-[13px]">{brl(event.feesBrl)}</span>
            </Field>
          </Section>

          {!!event.reviewHistory?.length && (
            <Section title={d.reviewHistory}>
              {event.reviewHistory.map((review, index) => (
                <Field key={`${review.createdAt}-${index}`} label={formatDateTime(review.createdAt)} last={index === event.reviewHistory!.length - 1}>
                  <span className="flex min-w-0 flex-col items-end gap-1 break-words">
                    {review.kind === "cost" ? (
                      <span>{d.reviewCost}: {review.previousCostBrl == null ? t.report.reviewPending : formatBRL(review.previousCostBrl)} → {brl(review.newCostBrl)}</span>
                    ) : (
                      <span>{d.unitPrice}: {review.previousPriceBrl == null ? t.report.reviewPending : unitPrice(review.previousPriceBrl)} → {formatUnitPriceBRL(review.newPriceBrl)}</span>
                    )}
                    <span className="text-muted">{review.reason}</span>
                    <span className="text-muted">{review.evidence}</span>
                  </span>
                </Field>
              ))}
            </Section>
          )}

          {report.loading && <p role="status" className="m-0 text-sm text-muted">{t.common.loading}</p>}
          {report.error && <p role="alert" className="m-0 text-sm text-warn">{d.costContextUnavailable}</p>}
          <Pending event={event} costUnknown={cost.costUnknown} contextPending={report.loading || !!report.error} onSetPrice={onSetPrice} />
        </div>
      )}
    </dialog>
  );
}

/**
 * A2 · origem do custo de aquisição: posição antes da venda, custo médio por unidade e a conta
 * que leva ao custo total devolvido pelo back-end (costBrl). A tela só formata: nunca troca costBrl
 * pelo produto calculado aqui, e a conta é apresentada como aproximação (arredondamentos em etapas).
 *
 * Indicadores vêm do evento ou, para back-ends anteriores, da linha do relatório pelo id.
 * Custo médio zero nunca é lido como custo desconhecido.
 */
function CostOrigin({ event, costUnknown, costManual }: { event: TaxEvent; costUnknown: boolean; costManual: boolean }) {
  const { t } = useI18n();
  const d = t.eventDialog;
  // Transferência não é venda e funding não tem custo médio: a origem do custo não se aplica.
  if (event.type !== "swap" && event.type !== "perp") return null;

  /*
   * Custo médio por unidade com 4 casas a partir de R$ 1: formatUnitPriceBRL arredonda para centavos
   * nessa faixa e a conta exibida passaria longe do custo total (393,81 × R$ 5,15 ≠ R$ 2.027,92).
   * Abaixo de R$ 1 ele já guarda 4 algarismos significativos. Mesmo critério em rules-explanation.tsx.
   */
  const avgCost = (v: number) => (Math.abs(v) >= 1 ? t.common.brlAmount(formatPtax(v)) : formatUnitPriceBRL(v));
  /*
   * Conta só com os três números disponíveis (vêm null quando a venda tem mais de um ativo de saída)
   * e com custo médio e custo total acima de zero. Zero aqui não é lido como custo desconhecido —
   * essa dedução é proibida; a conta é apenas omitida, porque "× R$ 0,00 ≈ R$ 0,00" não explica nada
   * e apresentaria um zero como se fosse custo conhecido. O aviso de custo desconhecido continua
   * vindo do indicador (custo ausente) e das pendências que o motor reporta.
   */
  const account =
    !costUnknown &&
    typeof event.costBrl === "number" &&
    event.costBrl > 0 &&
    typeof event.positionBeforeQty === "number" &&
    typeof event.avgCostUnitBrl === "number" &&
    event.avgCostUnitBrl > 0
      ? {
          position: `${formatQtyFull(event.positionBeforeQty)} ${event.quantityAsset}`,
          avgUnit: avgCost(event.avgCostUnitBrl),
          line: d.costAccountValue({
            quantity: formatQtyFull(Math.abs(event.quantity)),
            unit: event.quantityAsset,
            avgUnit: avgCost(event.avgCostUnitBrl),
            total: formatBRL(event.costBrl),
          }),
        }
      : null;
  if (!account && !costUnknown && !costManual) return null;

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="event-cost-origin">
      <Kicker as="h3">
        <span id="event-cost-origin">{d.costOrigin}</span>
      </Kicker>
      {account && (
        <>
          <dl className="m-0 rounded-xl border border-line px-4">
            <Field label={d.positionBefore} wide>
              <span className="font-mono text-[13px]">{account.position}</span>
            </Field>
            <Field label={d.avgCostUnit} wide>
              <span className="font-mono text-[13px]">{account.avgUnit}</span>
            </Field>
            <Field label={d.costAccount} wide last>
              <span className="font-mono text-[13px]">{account.line}</span>
            </Field>
          </dl>
          <p className="m-0 text-[13px] leading-relaxed text-muted">{d.costApproxNote}</p>
        </>
      )}
      {/* Custo desconhecido entra no lugar da conta, nunca como um zero apresentado como custo conhecido. */}
      {costUnknown && (
        <p className="m-0 flex items-start gap-2 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
          <WarningIcon size={18} className="mt-px shrink-0" aria-hidden />
          {d.costUnknownNote}
        </p>
      )}
      {costManual && <p className="m-0 text-[13px] leading-relaxed text-muted">{d.costManualNote}</p>}
    </section>
  );
}

function Pending({ event, costUnknown, contextPending, onSetPrice }: { event: TaxEvent; costUnknown: boolean; contextPending: boolean; onSetPrice: (e: TaxEvent) => void }) {
  const { t } = useI18n();
  const d = t.eventDialog;
  const missingPrice = event.valueBrl === null;
  // Custo só é pendência quando há preço (sem preço, a pendência principal já explica o ganho ausente).
  const missingCost = costUnknown;

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="event-pending">
      <Kicker as="h3">
        <span id="event-pending">{d.pending}</span>
      </Kicker>
      {!contextPending && !missingPrice && !missingCost && !event.pendingReasons?.length ? (
        <p className="m-0 flex items-start gap-2 text-sm text-muted">
          <CheckCircleIcon size={18} className="mt-px shrink-0 text-ok" aria-hidden />
          {event.priceSource === "manual" ? d.manualNote : d.pendingNone}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {missingPrice && !event.pendingReasons?.length && (
            <li className="flex flex-col items-start gap-3 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
              <span className="flex items-start gap-2">
                <WarningIcon size={18} className="mt-px shrink-0" aria-hidden />
                {d.pendingPrice}
              </span>
              <Button size="sm" onClick={() => onSetPrice(event)}>
                {d.setPrice}
              </Button>
            </li>
          )}
          {missingCost && !event.pendingReasons?.length && (
            <li className="flex items-start gap-2 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
              <InfoIcon size={18} className="mt-px shrink-0" aria-hidden />
              {d.pendingCost}
            </li>
          )}
        </ul>
      )}
      {!!event.pendingReasons?.length && (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {event.pendingReasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
      {(contextPending || missingCost || !!event.pendingReasons?.length) && (
        <Link href={`/relatorios/${eventMonth(event.date)}`} className="text-sm font-medium text-accent-text underline">
          {d.reviewInReport}
        </Link>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <Kicker as="h3">{title}</Kicker>
      <dl className="m-0 rounded-xl border border-line px-4">{children}</dl>
    </section>
  );
}

/**
 * `wide`: rótulo e valor empilhados no celular, onde a coluna fixa de 140px deixaria frases como
 * "Comprou 10 HYPE · pagou 393,81 USDC" em quatro linhas. A partir de sm volta às duas colunas.
 */
function Field({ label, children, last, wide }: { label: string; children: React.ReactNode; last?: boolean; wide?: boolean }) {
  return (
    <div
      className={cn(
        "grid items-baseline py-2.5 text-sm",
        wide
          ? "grid-cols-1 gap-1 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)] sm:gap-4"
          : "grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-4",
        !last && "border-b border-line",
      )}
    >
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("m-0 min-w-0", wide ? "text-left sm:text-right" : "text-right")}>{children}</dd>
    </div>
  );
}
