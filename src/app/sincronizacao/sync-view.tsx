"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  CircleNotchIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { api, errorMessage, type StepState, type SyncStatus, type SyncWalletProgress } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatDate, formatInt, shortAddress } from "@/lib/format";
import { Badge, Brand, Button, ButtonLink, Card, cn, InlineError, Kicker, LogoMark, Panel, Skeleton } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";
import { WelcomeScreen } from "@/components/welcome-screen";

const POLL_MS = 1500;
const NETWORK_LABEL = { solana: "Solana", hyperliquid: "Hyperliquid" } as const;

export function SyncView() {
  const router = useRouter();
  const { status, user, refreshUser } = useSession();
  const { t } = useI18n();
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Boas-vindas só depois que a pessoa clica em "Ir para o painel" com a leitura concluída.
  const [welcoming, setWelcoming] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;

    const tick = async () => {
      try {
        const s = started.current ? await api.syncStatus() : await api.startSync();
        started.current = true;
        if (!alive) return;
        setSync(s);
        setError(null);
        if (s.state === "done") {
          await refreshUser();
          return;
        }
        if (s.state === "error") return; // o usuário decide quando tentar de novo
      } catch (err) {
        if (alive) setError(errorMessage(err));
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [status, refreshUser]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <LogoMark size={36} className="animate-pulse" />
      </div>
    );
  }

  const pct = sync?.estimated ? Math.min(100, Math.round((sync.read / sync.estimated) * 100)) : null;
  const done = sync?.state === "done";
  const failed = sync?.state === "error";

  if (welcoming) return <WelcomeScreen />;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-5 sm:px-12">
        <Brand />
        <div className="flex items-center gap-4">
          {user && <span className="hidden font-mono text-xs text-muted sm:inline">{shortAddress(user.address)} · Solana</span>}
          <LanguageSwitch />
        </div>
      </header>

      <div className="page-enter mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-10 px-5 py-10 sm:px-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 lg:px-24 lg:pt-[72px] lg:pb-14">
        <div className="flex flex-col gap-9">
          <div className="flex flex-col gap-3">
            <Kicker>{t.sync.kicker(sync ? sync.wallets.length : null)}</Kicker>
            <h1 className="type-h1 m-0" aria-live="polite">
              {done ? t.sync.titleDone : failed ? t.sync.titleFailed : t.sync.titleRunning}
            </h1>
            <p className="m-0 max-w-[560px] text-base leading-relaxed text-muted">
              {done
                ? t.sync.textDone
                : failed
                  ? t.sync.textFailed
                  : t.sync.textRunning(formatDate(`${sync?.since ?? "2025-01-01"}T15:00:00Z`))}
            </p>
          </div>

          <div className="flex flex-wrap items-baseline gap-4">
            {sync ? (
              <span className="font-mono text-[56px] leading-none font-medium tracking-[-0.04em] tabular sm:text-[72px]">
                {formatInt(sync.read)}
              </span>
            ) : (
              <Skeleton className="h-[72px] w-56" />
            )}
            <div className="flex flex-col gap-1">
              <span className="text-base">{t.sync.txRead}</span>
              <span className="font-mono text-xs text-muted">
                {sync?.estimated ? t.sync.estimate(formatInt(sync.estimated), pct ?? 0) : t.sync.estimating}
              </span>
            </div>
          </div>

          <div
            className="relative h-2 overflow-hidden rounded-lg bg-track"
            role="progressbar"
            aria-label={t.sync.progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
          >
            {pct !== null ? (
              <div className="h-full rounded-lg bg-accent transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            ) : (
              <div
                className="absolute inset-y-0 w-1/3 rounded-lg bg-accent/70"
                style={{
                  animation: "progress-sheen 1.4s ease-in-out infinite",
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-3">
            {sync
              ? sync.wallets.map((w) => <WalletRow key={w.walletId} w={w} />)
              : [0, 1].map((i) => <Skeleton key={i} className="h-[84px] rounded-xl" />)}
          </div>

          <InlineError>{error && t.sync.autoRetry(error)}</InlineError>
          {failed && (
            <Button icon={ArrowsClockwiseIcon} className="self-start" onClick={() => window.location.reload()}>
              {t.common.retry}
            </Button>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <Card className="flex flex-col gap-5 p-7">
            <Kicker>{t.sync.whatsHappening}</Kicker>
            <ul className="m-0 flex list-none flex-col gap-5 p-0">
              {(sync?.steps ?? []).map((s) => (
                <li
                  key={s.key}
                  className={cn("flex items-center gap-3", s.state === "pending" && "text-muted", s.state === "running" && "font-medium")}
                >
                  <StepIcon state={s.state} />
                  <span>{s.label}</span>
                </li>
              ))}
              {!sync && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5" />)}
            </ul>
          </Card>
          {!done && !failed && <p className="m-0 text-[13px] leading-relaxed text-muted">{t.sync.canClose}</p>}
          {done ? (
            <Button iconRight={ArrowRightIcon} onClick={() => setWelcoming(true)} className="self-start">
              {t.common.goToDashboard}
            </Button>
          ) : (
            <ButtonLink href="/painel" variant="secondary" iconRight={ArrowRightIcon} className="self-start">
              {t.common.goToDashboard}
            </ButtonLink>
          )}
        </aside>
      </div>
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const { t } = useI18n();
  if (state === "done") return <CheckCircleIcon size={20} className="shrink-0 text-ok" aria-label={t.sync.stepDone} />;
  if (state === "running")
    return <CircleNotchIcon size={20} className="animate-spin-slow shrink-0 text-accent-text" aria-label={t.sync.stepRunning} />;
  if (state === "error") return <WarningCircleIcon size={20} className="shrink-0 text-danger" aria-label={t.common.failed} />;
  return <CircleIcon size={20} className="shrink-0" aria-label={t.sync.stepPending} />;
}

function WalletRow({ w }: { w: SyncWalletProgress }) {
  const { t } = useI18n();
  const pct = w.total ? Math.min(100, (w.read / w.total) * 100) : w.state === "done" ? 100 : 0;
  const countLabel = w.total
    ? t.sync.walletTx(formatInt(w.read), formatInt(w.total))
    : `${t.sync.walletRead(formatInt(w.read))}${w.detail ? ` · ${w.detail}` : ""}`;

  return (
    <Panel className="grid grid-cols-1 items-center gap-4 px-6 py-5 sm:grid-cols-[140px_minmax(0,1fr)_170px] sm:gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-medium">{NETWORK_LABEL[w.network]}</span>
        <span className="font-mono text-xs text-muted">{shortAddress(w.address)}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-md bg-track">
          <div
            className={cn(
              "h-full rounded-md transition-[width] duration-700 ease-out",
              w.state === "done" ? "bg-ok" : w.state === "error" ? "bg-danger" : "bg-accent",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-xs text-muted">
          {w.state === "error" ? w.error : w.total === null && w.read === 0 ? t.sync.waiting : countLabel}
        </span>
      </div>
      <span className="sm:justify-self-end">
        {w.state === "done" && (
          <Badge tone="ok" icon={CheckIcon}>
            {t.sync.stepDone}
          </Badge>
        )}
        {w.state === "running" && (
          <Badge tone="accent" icon={ArrowsClockwiseIcon} spin>
            {t.sync.reading}
          </Badge>
        )}
        {w.state === "pending" && <Badge tone="draft">{t.common.queued}</Badge>}
        {w.state === "error" && (
          <Badge tone="danger" icon={WarningCircleIcon}>
            {t.common.failed}
          </Badge>
        )}
      </span>
    </Panel>
  );
}
