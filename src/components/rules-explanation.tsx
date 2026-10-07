"use client";

import { useState } from "react";
import { ListChecksIcon, XIcon } from "@phosphor-icons/react";
import { api, type ReportRow, type TaxEvent } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatBRL, formatDate, formatPtax, formatQtyFull, monthLabel } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Badge, Card, IconButton, Skeleton } from "@/components/ui";

/** Por que a explicação por regras apareceu: IA indisponível (503) ou cota do mês esgotada (429). */
export type RulesReason = "unavailable" | "quota";

/**
 * Explicação automática por regras, usada quando o agente de IA não pode responder.
 * Montada só com os campos de cada evento (GET /api/events e, para o status do custo,
 * GET /api/report/:mes). Sempre rotulada como regras: não imita o tom nem a aparência do agente.
 */
export function RulesExplanation({ month, reason, onClose }: { month?: string; reason: RulesReason; onClose: () => void }) {
  const { t } = useI18n();
  const r = t.rules;
  // Sem mês em foco na conversa: usa o mês mais recente do painel.
  const dash = useApi(() => api.dashboard(), [], !month);
  const target = month ?? dash.data?.month;
  const events = useApi(() => api.events(target!), [target], !!target);
  // O relatório só complementa (custo informado/desconhecido); se falhar, a explicação segue sem ele.
  const report = useApi(() => api.report(target!).catch(() => null), [target], !!target);
  const [selected, setSelected] = useState<string | null>(null);

  const list = events.data ?? [];
  const current = list.find((e) => e.id === selected) ?? list[0];
  const row = report.data?.rows.find((x) => x.id === current?.id);

  return (
    <Card className="flex flex-col gap-4 p-5 sm:ml-12" role="region" aria-label={r.title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <ListChecksIcon size={20} className="text-accent-text" aria-hidden />
          <h2 className="m-0 text-base font-medium">{r.title}</h2>
          <Badge tone="draft">{r.badge}</Badge>
        </div>
        <IconButton icon={XIcon} label={r.hide} onClick={onClose} />
      </div>
      <p className="m-0 text-sm leading-relaxed text-muted">{reason === "quota" ? r.introQuota : r.introUnavailable}</p>
      {target && <p className="m-0 font-mono text-xs text-muted">{r.month(monthLabel(target))}</p>}

      {(events.error || dash.error) && <p className="m-0 text-sm text-danger">{events.error ?? dash.error}</p>}
      {!events.error && !dash.error && !events.data && (
        <div className="flex flex-col gap-2" aria-label={r.loading}>
          <Skeleton className="h-10" />
          <Skeleton className="h-16" />
        </div>
      )}
      {events.data && list.length === 0 && <p className="m-0 text-sm text-muted">{r.empty}</p>}

      {current && (
        <>
          <label className="flex flex-col gap-1.5 text-[13px] text-muted">
            {r.eventLabel}
            <select
              value={current.id}
              onChange={(e) => setSelected(e.target.value)}
              className="min-h-11 rounded-xl border border-line2 bg-panel px-3 text-sm text-ink"
            >
              {list.map((e) => (
                <option key={e.id} value={e.id}>
                  {formatDate(e.date)} · {t.eventType[e.type]} · {e.asset}
                  {e.valueBrl !== null ? ` · ${formatBRL(e.valueBrl)}` : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="m-0 text-[15px] leading-[1.7] text-pretty">{explain(current, row, t)}</p>
          {!!current.pendingReasons?.length && <p className="m-0 text-sm text-warn">{r.pending(current.pendingReasons.join(" · "))}</p>}
        </>
      )}
    </Card>
  );
}

type T = ReturnType<typeof useI18n>["t"];

/** Texto-modelo preenchido com os campos do evento; campo ausente vira "não informado", nunca zero. */
export function explain(e: TaxEvent, row: ReportRow | undefined, t: T): string {
  const r = t.rules;
  const or = (v: string | null | undefined) => v || r.missing;
  const brl = (v: number | null | undefined) => (v === null || v === undefined ? r.missing : formatBRL(v));
  const costManual = row?.costManual || e.reviewHistory?.some((x) => x.kind === "cost");
  const costUnknown = row?.costUnknown || e.costBrl === null || e.costBrl === undefined;
  return r.text({
    verb: r.verb[e.type],
    quantity: formatQtyFull(e.quantity),
    unit: e.quantityAsset,
    asset: e.asset,
    date: formatDate(e.date),
    price: brl(e.unitPriceBrl),
    source: e.priceSource === "manual" ? r.sourceManual : or(e.priceProvider),
    ptax: e.ptax === null || e.ptax === undefined ? r.missing : formatPtax(e.ptax),
    ptaxDate: e.ptaxDate ? formatDate(`${e.ptaxDate}T15:00:00Z`) : r.missing,
    value: brl(e.valueBrl),
    cost: brl(e.costBrl),
    costStatus: costManual ? r.costStatus.manual : costUnknown ? r.costStatus.unknown : r.costStatus.average,
    gain: brl(e.gainBrl),
    rule: or(e.ruleVersion),
  });
}
