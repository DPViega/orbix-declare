"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FileArrowUpIcon,
  HourglassIcon,
  PackageIcon,
  PencilSimpleIcon,
  SealCheckIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { api, errorMessage, isDemoSession, type EventType, type ReportDetail, type ReportReviewItem } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { config, explorerTxUrl, publicVerifyUrl } from "@/lib/config";
import {
  formatBRL,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatInt,
  formatMoney,
  parseBRLInput,
  formatPtax,
  formatQty,
  formatQtyFull,
  formatTime,
  monthLabel,
  monthLong,
  parseMonthKey,
  shortAddress,
} from "@/lib/format";
import { downloadText, reportToCsv, triggerDownload } from "@/lib/report-file";
import { buildReviewPackage } from "@/lib/review-package";
import { Badge, Button, ButtonLink, Card, InlineError, Input, Kicker, PageHeader, Panel, Skeleton, StateBlock } from "@/components/ui";
import { Table, Td } from "@/components/table";
import { useI18n } from "@/lib/i18n";
import { DemoNotice } from "@/components/demo-notice";
import { LoadFailure } from "@/components/load-failure";

export default function RelatorioPage() {
  const { mes } = useParams<{ mes: string }>();
  // key: ao trocar de mês, avisos, erros e exportações em andamento do mês anterior são descartados.
  return <MonthReport key={mes} mes={mes} />;
}

function MonthReport({ mes }: { mes: string }) {
  const { t } = useI18n();
  const valid = !!parseMonthKey(mes);
  const { data, error, loading, reload, setData } = useApi(() => api.report(mes), [mes], valid);
  // Exportar só com o relatório deste mês carregado e atualizado.
  const ready = !!data && !loading;
  const [busy, setBusy] = useState<"csv" | "package" | "decripto" | "finalize" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  // Relatório final, atestação ainda não confirmou na Solana: recarrega até ela aparecer.
  const pendingAttestation = data?.status === "final" && data.attestation === null;
  useEffect(() => {
    if (!pendingAttestation) return;
    const id = setInterval(reload, 5000);
    return () => clearInterval(id);
  }, [pendingAttestation, reload]);

  if (valid && error && !data) {
    return (
      <>
        <PageHeader kicker={t.reports.title} title={t.report.notFound} />
        <LoadFailure
          title={t.report.cantOpen}
          error={error}
          onRetry={reload}
          extraAction={
            <ButtonLink href="/relatorios" variant="secondary" icon={ArrowLeftIcon}>
              {t.report.back}
            </ButtonLink>
          }
        />
      </>
    );
  }

  if (!valid) {
    return (
      <>
        <PageHeader kicker={t.reports.title} title={t.report.notFound} />
        <StateBlock
          icon={WarningIcon}
          tone="danger"
          title={t.report.invalidMonth}
          actions={
            <>
              <ButtonLink href="/relatorios" variant="secondary" icon={ArrowLeftIcon}>
                {t.report.back}
              </ButtonLink>
            </>
          }
        >
          {t.report.invalidMonthText}
        </StateBlock>
      </>
    );
  }

  const downloadCsv = async () => {
    if (!data || !ready) return;
    setBusy("csv");
    setActionError(null);
    try {
      if (config.useMocks || isDemoSession()) {
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

  // Pacote para revisão: CSV detalhado + leia-me, montados no navegador com o relatório e os eventos do mês.
  const downloadPackage = async () => {
    if (!data || !ready) return;
    setBusy("package");
    setActionError(null);
    setNotice(null);
    try {
      const events = await api.events(mes);
      const pkg = buildReviewPackage(data, events, t.reviewPackage, { monthLabel: monthLong(mes), formatBRL, formatDate, formatDateTime });
      const files = [
        { ...pkg.csv, mime: "text/csv;charset=utf-8" },
        ...(pkg.transfers ? [{ ...pkg.transfers, mime: "text/csv;charset=utf-8" }] : []),
        { ...pkg.readme, mime: "text/markdown;charset=utf-8" },
      ];
      for (const [i, file] of files.entries()) {
        // Pequeno intervalo: alguns navegadores ignoram downloads que saem todos juntos.
        if (i > 0) await new Promise((r) => setTimeout(r, 400));
        downloadText(file.name, file.text, file.mime);
      }
      setNotice(t.reviewPackage.downloaded(files.map((f) => f.name)));
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const generateDecripto = async () => {
    if (!ready || !decriptoReady) return;
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

  const finalize = async () => {
    if (!ready || !data || data.status !== "draft") return;
    setBusy("finalize");
    setActionError(null);
    setNotice(null);
    try {
      const updated = await api.finalizeReport(mes);
      setData(updated);
      setConfirmFinalize(false);
      setNotice(t.report.finalized);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const review = data?.review;
  const hasReviewItems = !!review?.reviewItems?.length;
  const decriptoReady = !!data && data.status === "final" && review?.decriptoReady === true &&
    review.coverage.state === "complete" && !!review.coverage.importedFrom && !!review.coverage.importedThrough &&
    review.coverage.importedEvents !== null && review.pendingReasons.length === 0 && review.unsupportedOperations.length === 0 && !hasReviewItems;

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
          confirmFinalize ? (
            <>
              <span className="self-center text-sm text-muted">{t.report.finalizeConfirmText}</span>
              <Button variant="secondary" onClick={() => setConfirmFinalize(false)} disabled={busy !== null}>
                {t.common.cancel}
              </Button>
              <Button icon={SealCheckIcon} onClick={finalize} loading={busy === "finalize"} disabled={busy !== null}>
                {t.report.finalizeConfirmButton}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                icon={DownloadSimpleIcon}
                onClick={downloadCsv}
                loading={busy === "csv"}
                disabled={!ready || busy !== null}
              >
                {t.report.downloadReviewCsv}
              </Button>
              <Button
                icon={PackageIcon}
                onClick={downloadPackage}
                loading={busy === "package"}
                disabled={!data || !ready || busy !== null || data.rows.length === 0}
                title={t.reviewPackage.buttonTitle}
              >
                {t.reviewPackage.button}
              </Button>
              {data?.status === "draft" && (
                <Button
                  variant="secondary"
                  icon={SealCheckIcon}
                  onClick={() => setConfirmFinalize(true)}
                  disabled={!ready || busy !== null || data.rows.length === 0}
                >
                  {t.report.finalize}
                </Button>
              )}
              <Button
                variant="secondary"
                icon={FileArrowUpIcon}
                onClick={generateDecripto}
                loading={busy === "decripto"}
                disabled={!data || !ready || !decriptoReady || busy !== null || data.rows.length === 0}
                title={t.report.decriptoSummaryNote}
              >
                {t.report.generateDecripto}
                {review?.decriptoReady !== true && <span className="rounded border border-line px-1.5 py-0.5 text-xs">{t.report.comingSoon}</span>}
              </Button>
            </>
          )
        }
      />

      <DemoNotice text={t.demo.report} />

      {/*
        A5 · o botão "Gerar DeCripto" ainda não entrega o arquivo no leiaute oficial. A explicação fica
        aqui, visível sem passar o mouse (nem title, nem tooltip), com link para o pacote de revisão.
      */}
      <Card className="px-5 py-4 text-sm leading-relaxed text-muted">
        {t.report.decriptoSoonBefore}
        <button
          type="button"
          onClick={downloadPackage}
          disabled={!data || !ready || busy !== null || data.rows.length === 0}
          className="cursor-pointer bg-transparent p-0 font-medium text-accent-text underline decoration-line2 underline-offset-4 hover:decoration-accent disabled:cursor-not-allowed disabled:text-muted"
        >
          {t.report.decriptoSoonLink}
        </button>
        {t.report.decriptoSoonAfter}
      </Card>

      {data && <ReportReviewPanel report={data} onReviewed={reload} />}

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

function ReportReviewPanel({ report, onReviewed }: { report: ReportDetail; onReviewed: () => void }) {
  const { t } = useI18n();
  const [history, setHistory] = useState<Record<string, ReviewRecord[]>>({});
  const review = report.review;
  const coverage = review?.coverage;
  const period = coverage?.importedFrom && coverage.importedThrough
    ? `${formatDate(`${coverage.importedFrom}T12:00:00Z`)} – ${formatDate(`${coverage.importedThrough}T12:00:00Z`)}`
    : t.report.notReported;
  const ready = report.status === "final" && review?.decriptoReady === true && coverage?.state === "complete" &&
    !!coverage.importedFrom && !!coverage.importedThrough && coverage.importedEvents !== null &&
    review.pendingReasons.length === 0 && review.unsupportedOperations.length === 0 && !review.reviewItems?.length;

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-h2 m-0">{t.report.reviewTitle}</h2>
        <Badge tone={coverage?.state === "complete" ? "ok" : "warn"}>
          {coverage?.state === "complete" ? t.report.coverageComplete : coverage?.state === "partial" ? t.report.coveragePartial : t.report.coverageUnknown}
        </Badge>
      </div>
      {coverage?.state === "partial" && (
        <p role="status" className="m-0 rounded-lg bg-warn-bg p-3 text-sm text-warn">
          {t.report.coveragePartialNotice}
        </p>
      )}
      <dl className="m-0 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <ReviewField label={t.report.coveragePeriod} value={period} />
        <ReviewField label={t.report.importedEvents} value={coverage?.importedEvents == null ? t.report.notReported : String(coverage.importedEvents)} />
        <ReviewField label={t.report.engineVersion} value={review?.engineVersion || t.report.notReported} />
        <ReviewField label={t.report.decriptoStatus} value={ready ? t.report.decriptoReady : t.report.decriptoUnavailable} last />
      </dl>
      {!!review?.limitations.length && <ReviewList title={t.report.limitations} items={review.limitations} />}
      {!!review?.pendingReasons.length && <ReviewList title={t.report.pending} items={review.pendingReasons} />}
      {!!review?.unsupportedOperations.length && <ReviewList title={t.report.unsupported} items={review.unsupportedOperations} />}
      {!!review?.reviewItems?.length && (
        <section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="review-actions-title">
          <h3 id="review-actions-title" className="m-0 text-sm font-medium">{t.report.reviewActions}</h3>
          {review.reviewItems.map((item) => (
            <ReviewAction
              key={item.id}
              item={item}
              history={history[item.id] ?? []}
              onSave={(entry) => setHistory((current) => ({ ...current, [item.id]: [...(current[item.id] ?? []), entry] }))}
              onReviewed={onReviewed}
            />
          ))}
        </section>
      )}
      {!review && <p className="m-0 text-sm text-muted">{t.report.reviewMetadataMissing}</p>}
      {review && (coverage?.state !== "complete" || !coverage.importedFrom || !coverage.importedThrough || coverage.importedEvents == null || !!review.pendingReasons.length || !!review.unsupportedOperations.length || !!review.reviewItems?.length) && <p className="m-0 text-sm text-muted">{t.report.decriptoBlocked}</p>}
    </Panel>
  );
}

interface ReviewRecord {
  before: string;
  after: string;
  reason: string;
  evidence: string;
  createdAt: string;
}

function ReviewAction({
  item,
  history,
  onSave,
  onReviewed,
}: {
  item: ReportReviewItem;
  history: ReviewRecord[];
  onSave: (record: ReviewRecord) => void;
  onReviewed: () => void;
}) {
  const { t } = useI18n();
  const isCost = item.kind === "acquisition_cost";
  // A classificação ainda não tem rota no back-end: só funciona na demonstração.
  const demoOnly = !isCost;
  const usable = isCost || config.useMocks || isDemoSession();
  const [raw, setRaw] = useState("");
  const [classification, setClassification] = useState<EventType | "">("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cost = parseBRLInput(raw);
  const after = isCost
    ? cost !== null && cost >= 0 ? formatBRL(cost) : ""
    : classification ? t.eventType[classification] : "";
  const canSubmit = usable && !!after && !!reason.trim() && !!evidence.trim() && confirmed;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || cost === null) return;
    setError(null);
    if (isCost) {
      setSaving(true);
      try {
        await api.reviewAcquisitionCost(item.id, { costBrl: cost, reason: reason.trim(), evidence: evidence.trim(), confirmed: true });
        onReviewed();
      } catch (err) {
        setError(errorMessage(err));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onSave({ before: t.report.reviewPending, after, reason: reason.trim(), evidence: evidence.trim(), createdAt: new Date().toISOString() });
    setRaw("");
    setClassification("");
    setReason("");
    setEvidence("");
    setConfirmed(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-medium">{item.label}</span>
        <Badge tone="warn">{isCost ? t.report.cost : t.report.classification}</Badge>
      </div>
      {demoOnly && !usable && <p className="m-0 text-[13px] text-muted">{t.report.reviewBackendUnavailable}</p>}
      <form onSubmit={submit} className="flex flex-col gap-3">
        {isCost ? (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor={`${item.id}-cost`}>
            {t.report.costAmount}
            <Input id={`${item.id}-cost`} inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor={`${item.id}-class`}>
            {t.report.classification}
            <select
              id={`${item.id}-class`}
              value={classification}
              onChange={(e) => setClassification(e.target.value as EventType | "")}
              disabled={!usable}
              className="h-11 w-full rounded-xl border border-line2 bg-bg px-3.5 text-sm text-ink disabled:opacity-60"
            >
              <option value="">{t.report.classifyPlaceholder}</option>
              {(["swap", "perp", "funding"] as const).map((type) => <option key={type} value={type}>{t.eventType[type]}</option>)}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-bg px-3 py-2.5 text-xs">
          <span className="text-muted">{t.report.reviewBefore}</span>
          <span className="text-right">{t.report.reviewPending}</span>
          <span className="text-muted">{t.report.reviewAfter}</span>
          <span className="text-right">{after || "—"}</span>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor={`${item.id}-reason`}>
          {t.report.reviewReason}
          <Input id={`${item.id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} disabled={!usable} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium" htmlFor={`${item.id}-evidence`}>
          {t.report.reviewEvidence}
          <textarea
            id={`${item.id}-evidence`}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={!usable}
            rows={2}
            className="w-full resize-y rounded-xl border border-line2 bg-bg px-3.5 py-3 text-sm text-ink outline-none focus:border-accent disabled:opacity-60"
          />
        </label>
        {usable && (
          <label className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
            {t.report.confirmReview}
          </label>
        )}
        <InlineError>{error}</InlineError>
        <Button type="submit" size="sm" loading={saving} disabled={!canSubmit}>
          {isCost ? t.report.resolveCostAction : t.report.classifyAction}
        </Button>
      </form>
      {history.map((record, index) => (
        <div key={`${record.createdAt}-${index}`} role="status" className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
          <p className="m-0">{isCost ? t.report.reviewSaved : t.report.reviewSavedDemo} · {formatDateTime(record.createdAt)}</p>
          <p className="m-0">{record.before} → {record.after}</p>
          <p className="m-0">{record.reason} · {record.evidence}</p>
        </div>
      ))}
    </div>
  );
}

function ReviewField({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex min-w-0 justify-between gap-4 border-t border-line py-2.5 text-sm ${last ? "sm:col-span-2" : ""}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 text-right font-mono break-words">{value}</dd>
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <h3 className="m-0 text-sm font-medium">{title}</h3>
      <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-muted">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function RowsTable({ report }: { report: ReportDetail }) {
  const { t } = useI18n();
  const c = t.report.cols;
  const cols = [
    { label: c.date, width: "76px" },
    { label: c.type, width: "76px" },
    { label: c.asset },
    { label: c.qty, width: "128px", align: "right" as const },
    { label: c.ptax, width: "78px", align: "right" as const },
    { label: c.value, width: "100px", align: "right" as const },
    { label: c.cost, width: "100px", align: "right" as const },
    { label: c.gain, width: "96px", align: "right" as const },
  ];
  const mono = "font-mono text-[12.5px]";
  return (
    <Table
      dense
      caption={t.report.rowsCaption(monthLong(report.month))}
      // F13: cabe na coluna ao lado do cartão de verificação (1192 − 340 − 20 = 832 px) sem rolagem lateral.
      minWidth={820}
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
                className="ml-2 inline-block whitespace-nowrap rounded-md border border-dashed border-line2 px-1.5 py-px font-mono text-[10.5px] text-muted"
                title={t.common.manualTitle}
              >
                {t.common.manual}
              </span>
            )}
            {r.costManual && (
              <span
                className="ml-2 inline-block whitespace-nowrap rounded-md border border-dashed border-line2 px-1.5 py-px font-mono text-[10.5px] text-muted"
                title={t.report.costManualTitle}
              >
                {t.report.costManualBadge}
              </span>
            )}
            {r.costUnknown && (
              <span
                className="ml-2 inline-block whitespace-nowrap rounded-md border border-dashed border-warn px-1.5 py-px font-mono text-[10.5px] text-warn"
                title={t.report.costUnknownTitle}
              >
                {t.report.costUnknownBadge}
              </span>
            )}
          </Td>
          <Td align="right" className={mono}>
            <span className="whitespace-nowrap" title={formatQtyFull(r.quantity)}>{formatQty(r.quantity)}</span>
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
      {config.useMocks || isDemoSession() ? (
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
            href={explorerTxUrl(a.txSignature, config.attestationCluster)}
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
