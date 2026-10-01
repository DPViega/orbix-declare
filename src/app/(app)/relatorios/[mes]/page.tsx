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
import { formatBRL, formatDate, formatDayMonth, formatInt, formatMoney, formatPtax, formatQty, formatTime, monthLabel, monthLong, parseMonthKey, shortAddress } from "@/lib/format";
import { downloadText, reportToCsv, triggerDownload } from "@/lib/report-file";
import { Badge, Button, ButtonLink, Card, InlineError, Kicker, PageHeader, Panel, Skeleton, StateBlock } from "@/components/ui";
import { Table, Td } from "@/components/table";

const TYPE_LABEL = { swap: "Swap", perp: "Perp", funding: "Funding" } as const;

export default function RelatorioPage() {
  const { mes } = useParams<{ mes: string }>();
  const valid = !!parseMonthKey(mes);
  const { data, error, loading, reload } = useApi(() => api.report(mes), [mes], valid);
  const [busy, setBusy] = useState<"csv" | "decripto" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!valid || (error && !data)) {
    return (
      <>
        <PageHeader kicker="Relatórios" title="Relatório não encontrado" />
        <StateBlock
          icon={WarningIcon}
          tone="danger"
          title={valid ? "Não conseguimos abrir este relatório" : "Mês inválido"}
          actions={
            <>
              {valid && <Button onClick={reload}>Tentar de novo</Button>}
              <ButtonLink href="/relatorios" variant="secondary" icon={ArrowLeftIcon}>
                Voltar aos relatórios
              </ButtonLink>
            </>
          }
        >
          {valid ? error : "O endereço precisa estar no formato /relatorios/AAAA-MM, por exemplo /relatorios/2026-09."}
        </StateBlock>
      </>
    );
  }

  const downloadCsv = async () => {
    if (!data) return;
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
    setBusy("decripto");
    setActionError(null);
    setNotice(null);
    try {
      const link = await api.generateDecripto(mes);
      if (link.url) triggerDownload(link.url, link.filename);
      else setNotice("Modo demonstração: o arquivo da DeCripto é gerado pelo back-end. Com a API conectada, o download começa aqui.");
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
                Relatórios
              </Link>{" "}
              / {monthLabel(mes)}
            </>
          }
          title={`Relatório de ${monthLong(mes)}`}
          badge={
            data ? (
              data.status === "final" ? (
                <Badge tone="ok" icon={SealCheckIcon}>Final</Badge>
              ) : (
                <Badge tone="draft" icon={PencilSimpleIcon}>Rascunho</Badge>
              )
            ) : null
          }
          actions={
            <>
              <Button variant="secondary" icon={DownloadSimpleIcon} onClick={downloadCsv} loading={busy === "csv"} disabled={!data}>
                Baixar CSV
              </Button>
              <Button icon={FileArrowUpIcon} onClick={generateDecripto} loading={busy === "decripto"} disabled={!data || data.rows.length === 0}>
                Gerar DeCripto
              </Button>
            </>
          }
        />

      <InlineError>{actionError}</InlineError>
      {notice && (
        <Card role="status" className="px-5 py-4 text-sm text-muted">
          {notice}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data ? (
          <>
            <Total label="Total alienado" value={data.totals.disposedBrl} />
            <Total label="Custo de aquisição" value={data.totals.costBrl} />
            <Total label="Ganho de capital" value={data.totals.gainBrl} />
            <Total label="Imposto devido" value={data.totals.taxBrl} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="overflow-hidden">
          {loading && !data ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : data && data.rows.length === 0 ? (
            <p className="m-0 p-8 text-sm text-muted">Nenhuma alienação cotada neste mês.</p>
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
  const cols = [
    { label: "Data", width: "68px" },
    { label: "Tipo", width: "76px" },
    { label: "Ativo" },
    { label: "Qtd.", width: "90px", align: "right" as const },
    { label: "PTAX", width: "70px", align: "right" as const },
    { label: "Valor R$", width: "100px", align: "right" as const },
    { label: "Custo R$", width: "100px", align: "right" as const },
    { label: "Ganho R$", width: "96px", align: "right" as const },
  ];
  const mono = "font-mono text-[12.5px]";
  return (
    <Table
      dense
      caption={`Alienações de ${monthLong(report.month)}`}
      minWidth={720}
      columns={cols}
      footer={
        <tr className="bg-card font-medium">
          <Td colSpan={5} className={`${mono} pl-5! text-right`}>
            <span className="font-sans text-sm">Total</span>
          </Td>
          <Td align="right" className={mono}>{formatMoney(report.totals.disposedBrl)}</Td>
          <Td align="right" className={mono}>{formatMoney(report.totals.costBrl)}</Td>
          <Td align="right" className={`${mono} pr-5!`}>{formatMoney(report.totals.gainBrl)}</Td>
        </tr>
      }
    >
      {report.rows.map((r) => (
        <tr key={r.id}>
          <Td className={`${mono} pl-5!`}>{formatDayMonth(r.date)}</Td>
          <Td className={`${mono} text-muted`}>{TYPE_LABEL[r.type]}</Td>
          <Td className="text-sm font-medium">
            {r.asset}
            {r.manualPrice && (
              <span className="ml-2 rounded-md border border-dashed border-line2 px-1.5 py-px font-mono text-[10.5px] text-muted" title="Preço informado manualmente">
                manual
              </span>
            )}
          </Td>
          <Td align="right" className={mono}>{formatQty(r.quantity)}</Td>
          <Td align="right" className={`${mono} text-muted`}>{formatPtax(r.ptax)}</Td>
          <Td align="right" className={mono}>{formatMoney(r.valueBrl)}</Td>
          <Td align="right" className={`${mono} text-muted`}>{formatMoney(r.costBrl)}</Td>
          <Td align="right" className={`${mono} pr-5! ${r.gainBrl >= 0 ? "text-ok" : "text-danger"}`}>{formatMoney(r.gainBrl)}</Td>
        </tr>
      ))}
    </Table>
  );
}

function VerificationPanel({ report }: { report: ReportDetail }) {
  const [copied, setCopied] = useState(false);
  const a = report.attestation;

  if (!a) {
    return (
      <Panel className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5">
          <HourglassIcon size={24} className="text-muted" aria-hidden />
          <h2 className="m-0 font-display text-lg font-medium">Verificação on-chain</h2>
        </div>
        <p className="m-0 text-sm leading-relaxed text-muted">
          {report.status === "draft"
            ? "Este relatório ainda é um rascunho. Quando ele for finalizado, o hash SHA-256 do arquivo é gravado na Solana e um link público de verificação aparece aqui."
            : "O registro na Solana deste relatório ainda está sendo confirmado. Volte em alguns minutos."}
        </p>
      </Panel>
    );
  }

  const url = publicVerifyUrl(a.publicId);
  const display = url.replace(/^https?:\/\//, "");

  return (
    <Panel className="flex flex-col gap-[18px] p-6">
      <div className="flex items-center gap-2.5">
        <SealCheckIcon size={24} className="text-accent-text" aria-hidden />
        <h2 className="m-0 font-display text-lg font-medium">Verificação on-chain</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        <Kicker>Hash do relatório · SHA-256</Kicker>
        <span className="rounded-xl border border-line bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed break-all">{a.hash}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Kicker>Registrado na Solana</Kicker>
        <span className="font-mono text-[13px]" title={a.txSignature}>{shortAddress(a.txSignature, 8, 4)}</span>
        <span className="text-[13px] text-muted">
          {formatDate(a.registeredAt)} às {formatTime(a.registeredAt)} · slot {formatInt(a.slot)}
        </span>
      </div>
      <a href={explorerTxUrl(a.txSignature)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-text">
        Ver no Solana Explorer
        <ArrowSquareOutIcon size={16} aria-hidden />
      </a>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <Kicker>Link público</Kicker>
        <div className="flex gap-2">
          <Link href={`/v/${a.publicId}`} className="min-w-0 flex-1 truncate rounded-xl border border-line bg-bg px-3 py-[9px] font-mono text-[12.5px] text-ink no-underline hover:border-line2">
            {display}
          </Link>
          <button
            type="button"
            aria-label={copied ? "Link copiado" : "Copiar link público"}
            title={copied ? "Copiado" : "Copiar link"}
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
