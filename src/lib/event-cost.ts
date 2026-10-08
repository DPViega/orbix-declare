import type { ReportRow, TaxEvent } from "@/lib/api/types";

/** Indicadores explícitos vencem os fallbacks; custo zero nunca implica custo desconhecido. */
export function eventCost(event: TaxEvent, row?: ReportRow) {
  const applicable = event.type === "swap" || event.type === "perp";
  return {
    costUnknown: applicable && (event.costUnknown ?? row?.costUnknown ?? (event.costBrl == null)),
    costManual: applicable && (event.costManual ?? row?.costManual ?? !!event.reviewHistory?.some((r) => r.kind === "cost")),
  };
}

export function eventMonth(date: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date(date));
}
