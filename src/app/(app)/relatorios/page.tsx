"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CalendarCheckIcon,
  FileTextIcon,
  PencilSimpleIcon,
  SealCheckIcon,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatBRL, formatDate, monthLabel, monthName, parseMonthKey } from "@/lib/format";
import { Badge, Button, Card, PageHeader, Panel, Skeleton, StateBlock } from "@/components/ui";
import { Table, Td } from "@/components/table";
import { useI18n } from "@/lib/i18n";

/** Prazo da DeCripto: último dia útil do mês seguinte ao das operações. */
function decriptoDeadline(monthKey: string): Date {
  const p = parseMonthKey(monthKey)!;
  // dia 0 do mês +2 = último dia do mês seguinte
  const d = new Date(Date.UTC(p.year, p.month + 1, 0, 15));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export default function RelatoriosPage() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useApi(() => api.reports(), []);
  const years = data ? [...new Set(data.map((r) => r.month.slice(0, 4)))].join(", ") : "";
  const draft = data?.find((r) => r.status === "draft");

  return (
    <>
      <PageHeader kicker={data ? t.reports.kicker(data.length, years) : t.common.loading} title={t.reports.title} />

      {draft && (
        <Card className="flex items-center gap-3 px-5 py-4 text-sm">
          <CalendarCheckIcon size={20} className="shrink-0 text-accent-text" aria-hidden />
          <span>
            {t.reports.deadline(monthName(draft.month))[0]}
            <span className="font-mono">{formatDate(decriptoDeadline(draft.month).toISOString())}</span>
            {t.reports.deadline(monthName(draft.month))[1]}
          </span>
        </Card>
      )}

      {error ? (
        <StateBlock
          icon={ArrowsClockwiseIcon}
          tone="danger"
          title={t.reports.loadError}
          actions={<Button onClick={reload}>{t.common.retry}</Button>}
        >
          {error}
        </StateBlock>
      ) : data && data.length === 0 ? (
        <StateBlock icon={FileTextIcon} title={t.reports.emptyTitle}>
          {t.reports.emptyText}
        </StateBlock>
      ) : (
        <Panel className="overflow-hidden">
          <Table
            caption={t.reports.tableCaption}
            minWidth={820}
            columns={[
              { label: t.reports.cols.month },
              { label: t.reports.cols.status, width: "150px" },
              { label: t.reports.cols.events, width: "110px", align: "right" },
              { label: t.reports.cols.total, width: "200px", align: "right" },
              { label: t.reports.cols.updated, width: "170px" },
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
                      <Link
                        href={`/relatorios/${r.month}`}
                        className="font-display text-base font-medium text-ink no-underline hover:text-accent-text"
                      >
                        {monthLabel(r.month)}
                      </Link>
                    </Td>
                    <Td>
                      {r.status === "final" ? (
                        <Badge tone="ok" icon={SealCheckIcon}>
                          {t.common.final}
                        </Badge>
                      ) : (
                        <Badge tone="draft" icon={PencilSimpleIcon}>
                          {t.common.draft}
                        </Badge>
                      )}
                    </Td>
                    <Td align="right" className="font-mono text-[13px] text-muted">
                      {r.events}
                    </Td>
                    <Td align="right" className="font-mono text-sm">
                      {formatBRL(r.totalBrl)}
                    </Td>
                    <Td className="font-mono text-[13px] text-muted">{formatDate(r.updatedAt)}</Td>
                    <Td align="right">
                      <Link
                        href={`/relatorios/${r.month}`}
                        aria-label={t.reports.openReport(monthLabel(r.month))}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line2 px-3.5 text-sm font-medium text-accent-text no-underline transition-colors hover:border-accent"
                      >
                        {t.reports.open}
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
