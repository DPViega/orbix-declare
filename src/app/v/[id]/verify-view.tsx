"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
import { config, explorerTxUrl } from "@/lib/config";
import { formatDate, formatInt, formatTime } from "@/lib/format";
import { sha256Hex } from "@/lib/report-file";
import { Brand, Button, Card, cn, Kicker, Panel, Skeleton, StateBlock, StateIcon } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";
import { DemoNotice } from "@/components/demo-notice";

export function VerifyView({ publicId }: { publicId: string }) {
  return <VerificationPage key={publicId} publicId={publicId} />;
}

type FileResult = { name: string; hash: string; expected: string } | null;

function VerificationPage({ publicId }: { publicId: string }) {
  const { t, locale } = useI18n();
  // locale nas deps: a descrição do relatório vem do back-end no idioma pedido (Accept-Language).
  const { data, error, loading, reload } = useApi(() => api.verifyPublic(publicId), [publicId, locale]);
  const [file, setFile] = useState<FileResult>(null);
  const currentFile = file?.expected === data?.hash.toLowerCase() ? file : null;
  const match = currentFile ? currentFile.hash === data?.hash.toLowerCase() : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line px-5 sm:px-12 lg:px-24">
        <div className="flex items-baseline gap-4">
          {/* Saída da página pública: o painel (sem sessão, o app manda para o login). */}
          <Link
            href="/painel"
            aria-label={t.common.goToDashboard}
            title={t.common.goToDashboard}
            className="rounded-lg text-ink no-underline transition-opacity hover:opacity-80"
          >
            <Brand />
          </Link>
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
          <StateBlock
            icon={MagnifyingGlassIcon}
            tone="danger"
            title={t.verify.notFound}
            actions={error ? <Button onClick={reload}>{t.common.retry}</Button> : undefined}
          >
            {error ?? t.verify.checkLink} {t.verify.codeHint}
          </StateBlock>
        ) : (
          <Result data={data} match={match} />
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
          {data && !loading && !error && <FileCheck key={data.hash} expected={data.hash} state={currentFile} onChange={setFile} />}
        </aside>
      </main>
    </div>
  );
}

function Result({ data, match }: { data: PublicVerification; match: boolean | null }) {
  const { t } = useI18n();
  // Modo demonstração: hash e transação são fictícios; nada pode parecer um registro real na Solana.
  const demo = config.useMocks;
  const failed = !data.valid || match === false;
  const verified = data.valid && match === true;
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <DemoNotice text={t.demo.verify} />
      <div className="flex flex-col gap-[18px]">
        <StateIcon icon={failed ? SealWarningIcon : verified ? SealCheckIcon : MagnifyingGlassIcon} tone={failed ? "danger" : demo ? "warn" : verified ? "ok" : "accent"} size={60} />
        <h1 aria-live="polite" className={cn("type-h1 m-0 max-w-[760px] text-pretty", failed && "text-danger", verified && !demo && "text-ok")}>
          {match === false ? t.verify.mismatchTitle : !data.valid ? t.verify.invalidTitle : demo ? t.demo.verifyTitle : verified ? t.verify.validTitle(formatDate(data.registeredAt)) : t.verify.awaitingTitle}
        </h1>
        <p className="m-0 max-w-[620px] text-base leading-relaxed text-muted">
          {match === false ? t.verify.fileMismatch : !data.valid ? t.verify.invalidText : demo ? t.demo.verifyText : verified ? t.verify.validText : t.verify.fileHint}
        </p>
      </div>

      <Panel className="px-7 py-2">
        <Row label={t.verify.report}>{data.description}</Row>
        <Row label={t.verify.hash}>
          <span className="font-mono text-[13px] break-all">{data.hash}</span>
        </Row>
        <Row label={`${t.verify.tx} · ${config.attestationCluster === "mainnet-beta" ? config.attestationCluster : t.verify.testNetwork(config.attestationCluster)}`}>
          {demo ? (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[13px] break-all text-muted">{data.txSignature}</span>
              <span className="text-[13px] text-warn">{t.demo.fakeTx}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[13px] break-all">{data.txSignature}</span>
              <a
                href={explorerTxUrl(data.txSignature, config.attestationCluster)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-text"
              >
                {t.common.viewOnExplorer}
                <ArrowSquareOutIcon size={15} aria-hidden />
              </a>
            </div>
          )}
        </Row>
        <Row label={t.verify.registeredAt} last>
          <span className="font-mono text-[13px]">
            {formatDate(data.registeredAt)} · {formatTime(data.registeredAt, true)} (BRT)
            {!demo && <> · slot {formatInt(data.slot)}</>}
          </span>
        </Row>
      </Panel>
      <p className="m-0 text-sm leading-relaxed text-muted">{t.verify.hashDisclaimer}</p>
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
function FileCheck({ expected, state, onChange }: { expected: string; state: FileResult; onChange: (value: FileResult) => void }) {
  const request = useRef(0);
  const [error, setError] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  const check = async (file: File | undefined) => {
    if (!file) return;
    const current = ++request.current;
    onChange(null);
    setError(false);
    setBusy(true);
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      if (current === request.current) onChange({ name: file.name, hash, expected: expected.toLowerCase() });
    } catch {
      if (current === request.current) setError(true);
    } finally {
      if (current === request.current) setBusy(false);
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
        {error ? t.verify.fileError : busy ? t.verify.fileChecking : !state ? t.verify.fileQuestion : match ? t.verify.fileMatch : t.verify.fileMismatch}
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
