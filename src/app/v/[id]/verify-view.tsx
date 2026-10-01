"use client";

import { useState } from "react";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  SealCheckIcon,
  SealWarningIcon,
  UploadSimpleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { api, type PublicVerification } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { explorerTxUrl } from "@/lib/config";
import { formatDate, formatInt, formatTime } from "@/lib/format";
import { sha256Hex } from "@/lib/report-file";
import { Brand, Card, cn, Kicker, Panel, Skeleton, StateBlock, StateIcon } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";

export function VerifyView({ publicId }: { publicId: string }) {
  const { t, locale } = useI18n();
  // locale nas deps: a descrição do relatório vem do back-end no idioma pedido (Accept-Language).
  const { data, error, loading } = useApi(() => api.verifyPublic(publicId), [publicId, locale]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line px-5 sm:px-12 lg:px-24">
        <div className="flex items-baseline gap-4">
          <Brand />
          <Kicker as="span" className="hidden sm:inline">
            {t.verify.kicker}
          </Kicker>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] text-muted sm:inline">{t.verify.noAccount}</span>
          <LanguageSwitch />
        </div>
      </header>

      <main className="page-enter mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-12 px-5 py-12 sm:px-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:px-24 lg:py-16">
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="size-[60px] rounded-xl" />
            <Skeleton className="h-24 max-w-[760px]" />
            <Skeleton className="h-64" />
          </div>
        ) : error || !data ? (
          <StateBlock icon={MagnifyingGlassIcon} tone="danger" title={t.verify.notFound}>
            {error ?? t.verify.checkLink} {t.verify.codeHint}
          </StateBlock>
        ) : (
          <Result data={data} />
        )}

        <aside className="flex flex-col gap-5">
          <Card className="flex flex-col gap-[18px] p-7">
            <Kicker>{t.verify.howItWorks}</Kicker>
            {t.verify.how.map((step, i) => (
              <div key={i} className="flex gap-3.5">
                <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
                <span className="leading-[1.55]">{step}</span>
              </div>
            ))}
          </Card>
          {data && <FileCheck expected={data.hash} />}
        </aside>
      </main>
    </div>
  );
}

function Result({ data }: { data: PublicVerification }) {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-[18px]">
        <StateIcon icon={data.valid ? SealCheckIcon : SealWarningIcon} tone={data.valid ? "ok" : "danger"} size={60} />
        <h1 className="type-h1 m-0 max-w-[760px] text-pretty">
          {data.valid ? t.verify.validTitle(formatDate(data.registeredAt)) : t.verify.invalidTitle}
        </h1>
        <p className="m-0 max-w-[620px] text-base leading-relaxed text-muted">{data.valid ? t.verify.validText : t.verify.invalidText}</p>
      </div>

      <Panel className="px-7 py-2">
        <Row label={t.verify.report}>{data.description}</Row>
        <Row label={t.verify.hash}>
          <span className="font-mono text-[13px] break-all">{data.hash}</span>
        </Row>
        <Row label={t.verify.tx}>
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[13px] break-all">{data.txSignature}</span>
            <a
              href={explorerTxUrl(data.txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-text"
            >
              {t.common.viewOnExplorer}
              <ArrowSquareOutIcon size={15} aria-hidden />
            </a>
          </div>
        </Row>
        <Row label={t.verify.registeredAt} last>
          <span className="font-mono text-[13px]">
            {formatDate(data.registeredAt)} · {formatTime(data.registeredAt, true)} (BRT) · slot {formatInt(data.slot)}
          </span>
        </Row>
      </Panel>
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("grid grid-cols-1 gap-2 py-[18px] sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6", !last && "border-b border-line")}>
      <Kicker as="span">{label}</Kicker>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Confere um arquivo local: o hash é calculado no navegador e o arquivo nunca é enviado. */
function FileCheck({ expected }: { expected: string }) {
  const [state, setState] = useState<{ name: string; hash: string } | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const check = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      setState({ name: file.name, hash });
    } finally {
      setBusy(false);
    }
  };

  const match = state && state.hash === expected.toLowerCase();

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void check(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-dashed p-6 transition-colors",
        over ? "border-accent bg-card/50" : "border-line2 hover:border-soft/60",
      )}
    >
      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void check(e.target.files?.[0])} />
      {state ? (
        match ? (
          <CheckCircleIcon size={24} className="text-ok" aria-hidden />
        ) : (
          <XCircleIcon size={24} className="text-danger" aria-hidden />
        )
      ) : (
        <UploadSimpleIcon size={24} className={cn("text-muted", busy && "animate-pulse")} aria-hidden />
      )}
      <span className="font-medium" aria-live="polite">
        {!state ? t.verify.fileQuestion : match ? t.verify.fileMatch : t.verify.fileMismatch}
      </span>
      <span className="text-[13px] leading-[1.55] text-muted">
        {!state ? (
          t.verify.fileHint
        ) : (
          <>
            <span className="text-ink">{state.name}</span>
            <span className="mt-1 block font-mono text-[11.5px] break-all">{state.hash}</span>
            <span className="mt-2 block">{t.verify.fileAgain}</span>
          </>
        )}
      </span>
    </label>
  );
}
