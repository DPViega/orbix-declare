"use client";

import Link from "next/link";
import { ArrowRightIcon, ArrowsClockwiseIcon, CalendarCheckIcon, FileTextIcon, PencilSimpleIcon, SealCheckIcon } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatBRL, formatDate, monthLabel, monthName, parseMonthKey } from "@/lib/format";
import { Badge, Button, Card, PageHeader, Panel, Skeleton, StateBlock } from "@/components/ui";
import { Table, Td } from "@/components/table";

/** Prazo da DeCripto: último dia útil do mês seguinte ao das operações. */
function decriptoDeadline(monthKey: string): Date {
  const p = parseMonthKey(monthKey)!;
  // dia 0 do mês +2 = último dia do mês seguinte
  const d = new Date(Date.UTC(p.year, p.month + 1, 0, 15));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export default function RelatoriosPage() {
  const { data, error, loading, reload } = useApi(() => api.reports(), []);
  const years = data ? [...new Set(data.map((r) => r.month.slice(0, 4)))].join(", ") : "";
  const draft = data?.find((r) => r.status === "draft");

  return (
    <>
      <PageHeader kicker={data ? `${data.length} ${data.length === 1 ? "mês" : "meses"} · ${years}` : "Carregando…"} title="Relatórios" />

      {draft && (
        <Card className="flex items-center gap-3 px-5 py-4 text-sm">
          <CalendarCheckIcon size={20} className="shrink-0 text-accent-text" aria-hidden />
          <span>
            A DeCripto de {monthName(draft.month)} deve ser enviada até{" "}
            <span className="font-mono">{formatDate(decriptoDeadline(draft.month).toISOString())}</span>, último dia útil do mês seguinte.
          </span>
        </Card>
      )}

      {error ? (
        <StateBlock icon={ArrowsClockwiseIcon} tone="danger" title="Não conseguimos carregar os relatórios" actions={<Button onClick={reload}>Tentar de novo</Button>}>
          {error}
        </StateBlock>
      ) : data && data.length === 0 ? (
        <StateBlock icon={FileTextIcon} title="Nenhum relatório ainda">
          Assim que a primeira sincronização terminar, cada mês com operações aparece aqui como rascunho.
        </StateBlock>
      ) : (
        <Panel className="overflow-hidden">
          <Table
            caption="Relatórios mensais"
            minWidth={820}
            columns={[
              { label: "Mês" },
              { label: "Status", width: "150px" },
              { label: "Eventos", width: "110px", align: "right" },
              { label: "Total em R$", width: "200px", align: "right" },
              { label: "Atualizado em", width: "170px" },
              { label: "", width: "120px" },
            ]}
          >
            {loading && !data
              ? [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <Td colSpan={6}>
                      <Skeleton className="h-7" />
                    </Td>
                  </tr>
                ))
              : data!.map((r) => (
                  <tr key={r.month} className="transition-colors hover:bg-card/40">
                    <Td className="py-3.5">
                      <Link href={`/relatorios/${r.month}`} className="font-display text-base font-medium text-ink no-underline hover:text-accent-text">
                        {monthLabel(r.month)}
                      </Link>
                    </Td>
                    <Td>
                      {r.status === "final" ? (
                        <Badge tone="ok" icon={SealCheckIcon}>Final</Badge>
                      ) : (
                        <Badge tone="draft" icon={PencilSimpleIcon}>Rascunho</Badge>
                      )}
                    </Td>
                    <Td align="right" className="font-mono text-[13px] text-muted">{r.events}</Td>
                    <Td align="right" className="font-mono text-sm">{formatBRL(r.totalBrl)}</Td>
                    <Td className="font-mono text-[13px] text-muted">{formatDate(r.updatedAt)}</Td>
                    <Td align="right">
                      <Link
                        href={`/relatorios/${r.month}`}
                        aria-label={`Abrir relatório de ${monthLabel(r.month)}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line2 px-3.5 text-sm font-medium text-accent-text no-underline transition-colors hover:border-accent"
                      >
                        Abrir
                        <ArrowRightIcon size={14} aria-hidden />
                      </Link>
                    </Td>
                  </tr>
                ))}
          </Table>
        </Panel>
      )}
    </>
  );
}
