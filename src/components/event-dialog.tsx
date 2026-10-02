"use client";

import { useEffect, useRef } from "react";
import { ArrowSquareOutIcon, CheckCircleIcon, InfoIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import type { TaxEvent } from "@/lib/api";
import { config } from "@/lib/config";
import { formatBRL, formatDate, formatDateTime, formatPtax, formatQtyFull, shortAddress } from "@/lib/format";
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
  const { t } = useI18n();
  const d = t.eventDialog;

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (event && !dlg.open) dlg.showModal();
    else if (!event && dlg.open) dlg.close();
  }, [event]);

  const na = <span className="text-faint">{d.unavailable}</span>;
  const brl = (v: number | null | undefined) => (v === null || v === undefined ? na : formatBRL(v));

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
            <Field label={d.tx} last>
              {config.useMocks ? (
                <span className="flex flex-col">
                  <span className="font-mono text-[12.5px] text-muted">{shortAddress(event.txHash, 8, 6)}</span>
                  <span className="text-[12.5px] text-warn">{t.demo.fakeTx}</span>
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
            <Field label={d.unitPrice}>
              <span className="font-mono text-[13px]">{brl(event.unitPriceBrl)}</span>
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
            <Field label={d.ptax} last>
              <span className="font-mono text-[13px]">
                {typeof event.ptax === "number"
                  ? event.ptaxDate
                    ? d.ptaxOf(formatPtax(event.ptax), formatDate(`${event.ptaxDate}T12:00:00Z`))
                    : formatPtax(event.ptax)
                  : na}
              </span>
            </Field>
          </Section>

          <Pending event={event} onSetPrice={onSetPrice} />
        </div>
      )}
    </dialog>
  );
}

function Pending({ event, onSetPrice }: { event: TaxEvent; onSetPrice: (e: TaxEvent) => void }) {
  const { t } = useI18n();
  const d = t.eventDialog;
  const missingPrice = event.valueBrl === null;
  // Custo só é pendência quando há preço (sem preço, a pendência principal já explica o ganho ausente).
  const missingCost = !missingPrice && (event.costBrl === null || event.costBrl === undefined);

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="event-pending">
      <Kicker as="h3">
        <span id="event-pending">{d.pending}</span>
      </Kicker>
      {!missingPrice && !missingCost ? (
        <p className="m-0 flex items-start gap-2 text-sm text-muted">
          <CheckCircleIcon size={18} className="mt-px shrink-0 text-ok" aria-hidden />
          {event.priceSource === "manual" ? d.manualNote : d.pendingNone}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {missingPrice && (
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
          {missingCost && (
            <li className="flex items-start gap-2 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
              <InfoIcon size={18} className="mt-px shrink-0" aria-hidden />
              {d.pendingCost}
            </li>
          )}
        </ul>
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

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div
      className={cn("grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] items-baseline gap-4 py-2.5 text-sm", !last && "border-b border-line")}
    >
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right">{children}</dd>
    </div>
  );
}
