"use client";

import { useEffect, useRef, useState } from "react";
import { WarningIcon, XIcon } from "@phosphor-icons/react";
import { api, errorMessage, type TaxEvent } from "@/lib/api";
import { formatBRL, formatDate, formatQtyFull, parseBRLInput, shortAddress } from "@/lib/format";
import { Button, Card, InlineError, Input, StateIcon } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

/**
 * "Preço não encontrado" — o usuário informa o preço unitário em R$ de um evento sem cotação.
 * PUT /api/events/:id/price, sempre com motivo, evidência e confirmação: fica registrado em
 * event_reviews. O valor fica marcado como manual no relatório.
 */
export function PriceDialog({ event, onClose, onSaved }: { event: TaxEvent | null; onClose: () => void; onSaved: (e: TaxEvent) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (event && !d.open) {
      setRaw("");
      setError(null);
      setReason("");
      setEvidence("");
      setConfirmed(false);
      d.showModal();
    } else if (!event && d.open) d.close();
  }, [event]);

  const price = parseBRLInput(raw);
  const total = event && price !== null ? price * event.quantity : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    if (price === null || price <= 0) {
      setError(t.priceDialog.invalid);
      return;
    }
    if (!reason.trim() || !evidence.trim() || !confirmed) {
      setError(t.priceDialog.reviewRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.reviewManualPrice(event.id, {
        unitPriceBrl: price,
        reason: reason.trim(),
        evidence: evidence.trim(),
        confirmed: true,
      });
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="price-title"
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(480px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-panel p-0 text-ink shadow-frame"
    >
      {event && (
        <form onSubmit={save} className="flex flex-col gap-[18px] p-7 sm:p-9">
          <div className="flex items-start justify-between">
            <StateIcon icon={WarningIcon} tone="warn" />
            <button
              type="button"
              aria-label={t.common.close}
              onClick={onClose}
              className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-muted hover:text-ink"
            >
              <XIcon size={18} aria-hidden />
            </button>
          </div>
          <h2 id="price-title" className="type-h2 m-0">
            {t.priceDialog.title}
          </h2>
          <Card className="flex flex-col gap-1.5 px-4 py-3.5 font-mono text-[12.5px]">
            <span>
              {formatDate(event.date)} · {t.eventType[event.type]} {event.asset}
            </span>
            <span className="text-muted">
              {formatQtyFull(event.quantity)} {event.quantityAsset} · tx {shortAddress(event.txHash)}
            </span>
          </Card>
          <p className="m-0 text-sm leading-relaxed text-muted">{t.priceDialog.text}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="unit-price" className="text-[13px] font-medium">
              {t.priceDialog.label}
            </label>
            <Input
              id="unit-price"
              inputMode="decimal"
              autoComplete="off"
              placeholder={t.priceDialog.placeholder}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              invalid={!!error}
              autoFocus
            />
            <span className="text-xs text-faint">
              {total !== null ? t.priceDialog.total(formatBRL(total)) : ""}
              {t.priceDialog.markedManual}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line px-4 py-3 text-sm">
            <span className="text-muted">{t.priceDialog.before}</span>
            <span className="text-right font-mono">{event.unitPriceBrl == null ? "—" : formatBRL(event.unitPriceBrl)}</span>
            <span className="text-muted">{t.priceDialog.after}</span>
            <span className="text-right font-mono">{price === null ? "—" : formatBRL(price)}</span>
            <span className="text-muted">{t.priceDialog.projectedTotal}</span>
            <span className="text-right font-mono">{total === null ? "—" : formatBRL(total)}</span>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="review-reason">
              {t.priceDialog.reason}
              <Input id="review-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor="review-evidence">
              {t.priceDialog.evidence}
              <textarea
                id="review-evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                required
                rows={3}
                className="w-full resize-y rounded-xl border border-line2 bg-bg px-3.5 py-3 text-sm text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
              {t.priceDialog.confirm}
            </label>
            {!!event.reviewHistory?.length && (
              <p className="m-0 text-xs text-muted">{t.priceDialog.historyCount(event.reviewHistory.length)}</p>
            )}
          </div>
          <InlineError>{error}</InlineError>
          <div className="mt-2 flex flex-wrap gap-2.5">
            <Button type="submit" loading={saving} disabled={!reason.trim() || !evidence.trim() || !confirmed}>
              {t.priceDialog.saveReview}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t.priceDialog.skip}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
