"use client";

import { useState } from "react";
import { ArrowSquareOutIcon, CheckCircleIcon, MagnifyingGlassIcon, SealCheckIcon, SealWarningIcon, UploadSimpleIcon, XCircleIcon } from "@phosphor-icons/react";
import { api, type PublicVerification } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { explorerTxUrl } from "@/lib/config";
import { formatDate, formatInt, formatTime } from "@/lib/format";
import { sha256Hex } from "@/lib/report-file";
import { Brand, Card, cn, Kicker, Panel, Skeleton, StateBlock, StateIcon } from "@/components/ui";

export function VerifyView({ publicId }: { publicId: string }) {
  const { data, error, loading } = useApi(() => api.verifyPublic(publicId), [publicId]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-line px-5 sm:px-12 lg:px-24">
        <div className="flex items-baseline gap-4">
          <Brand />
          <Kicker as="span" className="hidden sm:inline">
            Verificação pública
          </Kicker>
        </div>
        <span className="text-[13px] text-muted">Não precisa de conta</span>
      </header>

      <main className="page-enter mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-12 px-5 py-12 sm:px-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:px-24 lg:py-16">
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="size-[60px] rounded-xl" />
            <Skeleton className="h-24 max-w-[760px]" />
            <Skeleton className="h-64" />
          </div>
        ) : error || !data ? (
          <StateBlock icon={MagnifyingGlassIcon} tone="danger" title="Relatório não encontrado">
            {error ?? "Confira se o link está completo."} O código de verificação fica no fim do link, por exemplo /v/a3f9c27e.
          </StateBlock>
        ) : (
          <Result data={data} />
        )}

        <aside className="flex flex-col gap-5">
          <Card className="flex flex-col gap-[18px] p-7">
            <Kicker>Como funciona</Kicker>
            {[
              "Ao finalizar o relatório, calculamos o hash SHA-256 do arquivo.",
              "O hash é gravado numa transação pública na Solana.",
              "Esta página recalcula o hash e compara com o registro.",
            ].map((t, i) => (
              <div key={i} className="flex gap-3.5">
                <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
                <span className="leading-[1.55]">{t}</span>
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
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex flex-col gap-[18px]">
        <StateIcon icon={data.valid ? SealCheckIcon : SealWarningIcon} tone={data.valid ? "ok" : "danger"} size={60} />
        <h1 className="m-0 max-w-[760px] font-display text-[32px] leading-[1.12] font-semibold tracking-[-0.025em] text-pretty sm:text-[42px]">
          {data.valid
            ? `Relatório verificado: não foi alterado desde ${formatDate(data.registeredAt)}`
            : "Atenção: o registro on-chain não confere com este relatório"}
        </h1>
        <p className="m-0 max-w-[620px] text-base leading-relaxed text-muted">
          {data.valid
            ? "O hash deste relatório é idêntico ao registrado na blockchain Solana. Qualquer alteração no arquivo mudaria o hash."
            : "O hash guardado é diferente do gravado na transação Solana. Não confie neste arquivo sem falar com quem o enviou."}
        </p>
      </div>

      <Panel className="px-7 py-2">
        <Row label="Relatório">{data.description}</Row>
        <Row label="Hash SHA-256">
          <span className="font-mono text-[13px] break-all">{data.hash}</span>
        </Row>
        <Row label="Transação Solana">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[13px] break-all">{data.txSignature}</span>
            <a href={explorerTxUrl(data.txSignature)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-text">
              Ver no Solana Explorer
              <ArrowSquareOutIcon size={15} aria-hidden />
            </a>
          </div>
        </Row>
        <Row label="Registrado em" last>
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
        {!state ? "Tem o arquivo em mãos?" : match ? "O arquivo é o mesmo do registro" : "Este arquivo é diferente do registrado"}
      </span>
      <span className="text-[13px] leading-[1.55] text-muted">
        {!state ? (
          "Arraste o CSV do relatório aqui para conferir no seu navegador. O arquivo não é enviado."
        ) : (
          <>
            <span className="text-ink">{state.name}</span>
            <span className="mt-1 block font-mono text-[11.5px] break-all">{state.hash}</span>
            <span className="mt-2 block">Clique ou arraste outro arquivo para conferir de novo.</span>
          </>
        )}
      </span>
    </label>
  );
}
