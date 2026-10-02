"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FileArrowUpIcon,
  HourglassIcon,
  PencilSimpleIcon,
  SealCheckIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { api, errorMessage, type ReportDetail } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { config, explorerTxUrl, publicVerifyUrl } from "@/lib/config";
import {
  formatBRL,
  formatDate,
  formatDayMonth,
  formatInt,
  formatMoney,
  formatPtax,
  formatQty,
  formatTime,
  monthLabel,
  monthLong,
  parseMonthKey,
  shortAddress,
} from "@/lib/format";
import { downloadText, reportToCsv, triggerDownload } from "@/lib/report-file";
import { Badge, Button, ButtonLink, Card, InlineError, Kicker, PageHeader, Panel, Skeleton, StateBlock } from "@/components/ui";
import { Table, Td } from "@/components/table";
import { useI18n } from "@/lib/i18n";
import { DemoNotice } from "@/components/demo-notice";

export default function RelatorioPage() {
  const { mes } = useParams<{ mes: string }>();
  // key: ao trocar de mês, avisos, erros e exportações em andamento do mês anterior são descartados.
  return <MonthReport key={mes} mes={mes} />;
}

function MonthReport({ mes }: { mes: string }) {
  const { t } = useI18n();
  const valid = !!parseMonthKey(mes);
  const { data, error, loading, reload } = useApi(() => api.report(mes), [mes], valid);
  // Exportar só com o relatório deste mês carregado e atualizado.
  const ready = !!data && !loading;
  const [busy, setBusy] = useState<"csv" | "decripto" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!valid || (error && !data)) {
    return (
      <>
        <PageHeader kicker={t.reports.title} title={t.report.notFound} />
        <StateBlock
          icon={WarningIcon}
          tone="danger"
          title={valid ? t.report.cantOpen : t.report.invalidMonth}
          actions={
            <>
              {valid && <Button onClick={reload}>{t.common.retry}</Button>}
              <ButtonLink href="/relatorios" variant="secondary" icon={ArrowLeftIcon}>
                {t.report.back}
              </ButtonLink>
            </>
          }
        >
          {valid ? error : t.report.invalidMonthText}
        </StateBlock>
      </>
    );
  }

  const downloadCsv = async () => {
    if (!data || !ready) return;
    setBusy("csv");
    setActionError(null);
    try {
      if (config.useMocks) {
        downloadText(`orbix-declare-${mes}.csv`, reportToCsv(data));
      } else {
        const link = await api.reportCsv(mes);
        triggerDownload(link.url, link.filename);
      }
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const generateDecripto = async () => {
    if (!ready) return;
    setBusy("decripto");
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.generateDecripto(mes);
      if (link.url) triggerDownload(link.url, link.filename);
      else setNotice(t.report.demoDecripto);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        kicker={
          <>
            <Link href="/relatorios" className="text-muted no-underline hover:text-ink">
              {t.reports.title}
            </Link>{" "}
            / {monthLabel(mes)}
          </>
        }
        title={t.report.title(monthLong(mes))}
        badge={
          data ? (
            data.status === "final" ? (
              <Badge tone="ok" icon={SealCheckIcon}>
                {t.common.final}
              </Badge>
            ) : (
              <Badge tone="draft" icon={PencilSimpleIcon}>
                {t.common.draft}
              </Badge>
            )
          ) : null
        }
        actions={
          <>
            <Button variant="secondary" icon={DownloadSimpleIcon} onClick={downloadCsv} loading={busy === "csv"} disabled={!ready || busy !== null}>
              {t.report.downloadCsv}
            </Button>
            <Button
              icon={FileArrowUpIcon}
              onClick={generateDecripto}
              loading={busy === "decripto"}
              disabled={!data || !ready || busy !== null || data.rows.length === 0}
            >
              {t.report.generateDecripto}
            </Button>
          </>
        }
      />

      <DemoNotice text={t.demo.report} />

      <InlineError>{actionError}</InlineError>
      {notice && (
        <Card role="status" className="px-5 py-4 text-sm text-muted">
          {notice}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <Total label={t.report.disposed} value={data.totals.disposedBrl} />
            <Total label={t.report.cost} value={data.totals.costBrl} />
            <Total label={t.report.gain} value={data.totals.gainBrl} />
            <Total label={t.report.taxDue} value={data.totals.taxBrl} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="overflow-hidden">
          {loading && !data ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : data && data.rows.length === 0 ? (
            <p className="m-0 p-8 text-sm text-muted">{t.report.noRows}</p>
          ) : (
            data && <RowsTable report={data} />
          )}
        </Panel>

        {data ? <VerificationPanel report={data} /> : <Skeleton className="h-[420px] rounded-xl" />}
      </div>
    </>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-2.5 px-[22px] py-[18px]">
      <Kicker as="h2">{label}</Kicker>
      <span className="font-mono text-[22px] font-medium">{formatBRL(value)}</span>
    </Card>
  );
}

function RowsTable({ report }: { report: ReportDetail }) {
  const { t } = useI18n();
  const c = t.report.cols;
  const cols = [
    { label: c.date, width: "76px" },
    { label: c.type, width: "76px" },
    { label: c.asset },
    { label: c.qty, width: "90px", align: "right" as const },
    { label: c.ptax, width: "70px", align: "right" as const },
    { label: c.value, width: "100px", align: "right" as const },
    { label: c.cost, width: "100px", align: "right" as const },
    { label: c.gain, width: "96px", align: "right" as const },
  ];
  const mono = "font-mono text-[12.5px]";
  return (
    <Table
      dense
      caption={t.report.rowsCaption(monthLong(report.month))}
      minWidth={720}
      columns={cols}
      footer={
        <tr className="bg-card font-medium">
          <Td colSpan={5} className={`${mono} pl-5! text-right`}>
            <span className="font-sans text-sm">{t.common.total}</span>
          </Td>
          <Td align="right" className={mono}>
            {formatMoney(report.totals.disposedBrl)}
          </Td>
          <Td align="right" className={mono}>
            {formatMoney(report.totals.costBrl)}
          </Td>
          <Td align="right" className={`${mono} pr-5!`}>
            {formatMoney(report.totals.gainBrl)}
          </Td>
        </tr>
      }
    >
      {report.rows.map((r) => (
        <tr key={r.id}>
          <Td className={`${mono} pl-5! whitespace-nowrap`}>{formatDayMonth(r.date)}</Td>
          <Td className={`${mono} text-muted`}>{t.eventType[r.type]}</Td>
          <Td className="text-sm font-medium">
            {r.asset}
            {r.manualPrice && (
              <span
                className="ml-2 rounded-md border border-dashed border-line2 px-1.5 py-px font-mono text-[10.5px] text-muted"
                title={t.common.manualTitle}
              >
                {t.common.manual}
              </span>
            )}
          </Td>
          <Td align="right" className={mono}>
            {formatQty(r.quantity)}
          </Td>
          <Td align="right" className={`${mono} text-muted`}>
            {formatPtax(r.ptax)}
          </Td>
          <Td align="right" className={mono}>
            {formatMoney(r.valueBrl)}
          </Td>
          <Td align="right" className={`${mono} text-muted`}>
            {formatMoney(r.costBrl)}
          </Td>
          <Td align="right" className={`${mono} pr-5! ${r.gainBrl >= 0 ? "text-ok" : "text-danger"}`}>
            {formatMoney(r.gainBrl)}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

function VerificationPanel({ report }: { report: ReportDetail }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const a = report.attestation;

  if (!a) {
    return (
      <Panel className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5">
          <HourglassIcon size={24} className="text-muted" aria-hidden />
          <h2 className="type-h2 m-0">{t.report.onchain}</h2>
        </div>
        <p className="m-0 text-sm leading-relaxed text-muted">{report.status === "draft" ? t.report.draftNote : t.report.pendingNote}</p>
      </Panel>
    );
  }

  const url = publicVerifyUrl(a.publicId);
  const display = url.replace(/^https?:\/\//, "");

  return (
    <Panel className="flex flex-col gap-[18px] p-6">
      <div className="flex items-center gap-2.5">
        <SealCheckIcon size={24} className="text-accent-text" aria-hidden />
        <h2 className="type-h2 m-0">{t.report.onchain}</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        <Kicker>{t.report.hash}</Kicker>
        <span className="rounded-xl border border-line bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed break-all">{a.hash}</span>
      </div>
      {config.useMocks ? (
        <div className="flex flex-col gap-1.5">
          <Kicker>{t.demo.fakeRecord}</Kicker>
          <p className="m-0 text-[13px] leading-relaxed text-muted">{t.demo.fakeRecordText}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Kicker>{t.report.registered}</Kicker>
            <span className="font-mono text-[13px]" title={a.txSignature}>
              {shortAddress(a.txSignature, 8, 4)}
            </span>
            <span className="text-[13px] text-muted">
              {t.report.registeredAt(formatDate(a.registeredAt), formatTime(a.registeredAt))} · slot {formatInt(a.slot)}
            </span>
          </div>
          <a
            href={explorerTxUrl(a.txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-text"
          >
            {t.common.viewOnExplorer}
            <ArrowSquareOutIcon size={16} aria-hidden />
          </a>
        </>
      )}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <Kicker>{t.report.publicLink}</Kicker>
        <div className="flex gap-2">
          <Link
            href={`/v/${a.publicId}`}
            className="min-w-0 flex-1 truncate rounded-xl border border-line bg-bg px-3 py-[9px] font-mono text-[12.5px] text-ink no-underline hover:border-line2"
          >
            {display}
          </Link>
          <button
            type="button"
            aria-label={copied ? t.report.copied : t.report.copy}
            title={copied ? t.report.copiedShort : t.report.copyShort}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                /* sem permissão de clipboard: o link continua visível para copiar à mão */
              }
            }}
            className="flex w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line2 bg-transparent text-ink transition-colors hover:border-soft/60"
          >
            {copied ? <CheckIcon size={16} className="text-ok" aria-hidden /> : <CopyIcon size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </Panel>
  );
}
