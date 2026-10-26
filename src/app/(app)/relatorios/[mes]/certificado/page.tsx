"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon, SealCheckIcon, WarningIcon } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { config, explorerTxUrl, publicVerifyUrl } from "@/lib/config";
import { formatBRL, formatDate, formatTime, monthLong, parseMonthKey } from "@/lib/format";
import { Badge, Brand, Button, ButtonLink, StateBlock } from "@/components/ui";
import { LoadFailure } from "@/components/load-failure";
import { useI18n } from "@/lib/i18n";

export default function CertificadoPage() {
  const { mes } = useParams<{ mes: string }>();
  return <Certificate key={mes} mes={mes} />;
}

function Certificate({ mes }: { mes: string }) {
  const { t } = useI18n();
  const valid = !!parseMonthKey(mes);
  const { data, error, reload } = useApi(() => api.report(mes), [mes], valid);

  if (!valid || (error && !data)) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-5 p-6">
        {!valid ? (
          <StateBlock icon={WarningIcon} tone="danger" title={t.report.invalidMonth}>
            {t.report.invalidMonthText}
          </StateBlock>
        ) : (
          <LoadFailure title={t.report.cantOpen} error={error ?? ""} onRetry={reload} />
        )}
        <ButtonLink href={`/relatorios/${mes}`} variant="secondary" icon={ArrowLeftIcon} className="self-start">
          {t.report.back}
        </ButtonLink>
      </div>
    );
  }

  const attestation = data?.attestation ?? null;
  const verifyUrl = attestation ? publicVerifyUrl(attestation.publicId) : null;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/relatorios/${mes}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-ink">
          <ArrowLeftIcon size={16} aria-hidden />
          {t.report.back}
        </Link>
        <Button icon={PrinterIcon} onClick={() => window.print()} disabled={!data}>
          {t.certificate.print}
        </Button>
      </div>

      <div id="certificado" className="flex flex-col gap-7 rounded-2xl border border-line bg-panel p-8 print:rounded-none print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-line pb-6">
          <div className="flex flex-col gap-1">
            <Brand size={26} />
            <span className="type-h1 m-0">{t.certificate.title}</span>
            <span className="text-sm text-muted">{t.certificate.subtitle(monthLong(mes))}</span>
          </div>
          {data && (
            <Badge tone={data.status === "final" ? "ok" : "draft"} icon={data.status === "final" ? SealCheckIcon : WarningIcon}>
              {data.status === "final" ? t.common.final : t.common.draft}
            </Badge>
          )}
        </div>

        {!data ? (
          <p className="m-0 text-sm text-muted">{t.common.loading}</p>
        ) : (
          <>
            {data.status === "draft" && <p className="m-0 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">{t.certificate.draftWarning}</p>}

            <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5">
              <CertField label={t.report.disposed} value={formatBRL(data.totals.disposedBrl)} />
              <CertField label={t.report.cost} value={formatBRL(data.totals.costBrl)} />
              <CertField label={t.report.gain} value={formatBRL(data.totals.gainBrl)} />
              <CertField label={t.report.taxDue} value={formatBRL(data.totals.taxBrl)} />
            </dl>

            <div className="flex flex-col gap-3 border-t border-line pt-6">
              <span className="font-display text-sm font-semibold">{t.certificate.authenticity}</span>
              {attestation ? (
                <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
                  <span>
                    {t.report.hash}: <span className="font-mono break-all">{attestation.hash}</span>
                  </span>
                  <span>
                    {t.report.registered}:{" "}
                    <span className="font-mono break-all">{attestation.txSignature}</span>
                    {" · "}
                    {t.report.registeredAt(formatDate(attestation.registeredAt), formatTime(attestation.registeredAt))}
                  </span>
                  <span className="break-all text-muted">
                    {explorerTxUrl(attestation.txSignature, config.attestationCluster)}
                  </span>
                  {verifyUrl && (
                    <span>
                      {t.report.publicLink}: <span className="break-all text-muted">{verifyUrl}</span>
                    </span>
                  )}
                </div>
              ) : (
                <p className="m-0 text-sm text-muted">{data.status === "draft" ? t.report.draftNote : t.report.pendingNote}</p>
              )}
            </div>

            <p className="m-0 border-t border-line pt-5 text-xs leading-relaxed text-muted">
              {t.certificate.disclaimer}
              <br />
              {t.certificate.generatedAt(formatDate(new Date().toISOString()), formatTime(new Date().toISOString()))}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CertField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs tracking-[0.04em] text-muted uppercase">{label}</dt>
      <dd className="m-0 font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}
