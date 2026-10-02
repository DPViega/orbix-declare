"use client";

import { useEffect, useState } from "react";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  HourglassIcon,
  EyeIcon,
  PlusIcon,
  SealCheckIcon,
  SignatureIcon,
  TrayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { api, errorMessage, type Network, type Wallet } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, formatDateTime, shortAddress } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  Chip,
  cn,
  IconButton,
  InlineError,
  Input,
  Kicker,
  PageHeader,
  Panel,
  Skeleton,
  StateBlock,
} from "@/components/ui";
import { Table, Td } from "@/components/table";
import { useI18n } from "@/lib/i18n";
import { LoadFailure, StaleDataError } from "@/components/load-failure";

const NETWORK = { solana: "Solana", hyperliquid: "Hyperliquid" } as const;
const ADDRESS: Record<Network, RegExp> = {
  hyperliquid: /^0x[0-9a-fA-F]{40}$/,
  // Base58: 32 a 44 caracteres, sem 0, O, I e l.
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
};
/**
 * Enquanto o back-end ainda está importando alguma carteira, a lista é atualizada sozinha.
 * Cada consulta só é agendada depois que a anterior responde (nunca há duas no ar), e o
 * acompanhamento para após MAX_POLLS tentativas ou num erro; a pessoa retoma com "Verificar agora".
 */
const POLL_MS = 4000;
const MAX_POLLS = 30;
const isImporting = (w: Wallet) => w.status === "pending" || w.status === "syncing";

export default function CarteirasPage() {
  const { t } = useI18n();
  const list = useApi(() => api.listWallets(), []);
  const [network, setNetwork] = useState<Network>("solana");
  const [address, setAddress] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  const wallets = list.data ?? [];
  const loginWallet = wallets.find((w) => w.isLogin);
  const emptyWallet = wallets.find((w) => w.status === "empty" && w.lastSyncAt);
  const importing = wallets.some((w) => isImporting(w) && !syncing[w.id]);
  const pollStopped = importing && polls >= MAX_POLLS;

  const { loading: listLoading, error: listError, reload: reloadList } = list;
  useEffect(() => {
    // Só agenda a próxima consulta quando a anterior terminou; em erro, para e mostra o aviso.
    if (!importing || listLoading || listError || polls >= MAX_POLLS) return;
    const id = setTimeout(() => {
      setPolls((n) => n + 1);
      reloadList();
    }, POLL_MS);
    return () => clearTimeout(id);
  }, [importing, listLoading, listError, polls, reloadList]);

  /** Recomeça o acompanhamento automático (depois de um erro, do limite ou de uma nova carteira). */
  const resumePolling = () => {
    setPolls(0);
    list.reload();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = address.trim();
    if (!ADDRESS[network].test(value)) {
      setAddError(network === "solana" ? t.wallets.invalidSolana : t.wallets.invalidAddress);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const w = await api.addWallet({ network, address: value });
      list.setData((prev) => [...(prev ?? []), w]);
      setAddress("");
      setPolls(0);
      void sync(w);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const sync = async (w: Wallet) => {
    // O back-end ainda está importando esta carteira: não dispara outra importação por cima.
    if (syncing[w.id] || isImporting(w)) return;
    setSyncing((s) => ({ ...s, [w.id]: true }));
    setRowError(null);
    try {
      const updated = await api.syncWallet(w.id);
      list.setData((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
      setPolls(0);
    } catch (err) {
      setRowError(`${shortAddress(w.address)}: ${errorMessage(err)}`);
    } finally {
      setSyncing((s) => ({ ...s, [w.id]: false }));
    }
  };

  return (
    <>
      <PageHeader
        kicker={list.data ? t.wallets.kicker(wallets.length) : list.error ? undefined : t.common.loading}
        title={t.wallets.title}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {loginWallet ? (
          <Card className="flex min-w-0 flex-col gap-5 p-7">
            <div className="flex items-center justify-between gap-3">
              <Kicker>{t.wallets.loginWallet}</Kicker>
              <Badge tone="ok" icon={SealCheckIcon}>
                {t.wallets.verified}
              </Badge>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="font-display text-[22px] font-medium">
                {NETWORK[loginWallet.network]} · {loginWallet.label}
              </span>
              <span className="font-mono text-sm break-all text-muted">{loginWallet.address}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
              {loginWallet.verifiedAt && (
                <span className="flex items-center gap-1.5">
                  <SignatureIcon size={16} aria-hidden />
                  {t.wallets.signedOn(formatDate(loginWallet.verifiedAt))}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <EyeIcon size={16} aria-hidden />
                {t.common.readOnly}
              </span>
            </div>
          </Card>
        ) : list.data || list.error ? null : (
          <Skeleton className="h-[196px] rounded-xl" />
        )}

        <Panel className="flex flex-col gap-4 p-7">
          <Kicker as="h2">{t.wallets.addTitle}</Kicker>
          <div
            role="radiogroup"
            aria-label={t.wallets.networkLabel}
            className="flex w-fit gap-1 rounded-xl border border-line bg-bg p-[3px]"
          >
            {(["solana", "hyperliquid"] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={network === n}
                onClick={() => {
                  setNetwork(n);
                  setAddError(null);
                }}
                className={cn(
                  "cursor-pointer rounded-[9px] px-3.5 py-1.5 text-[13px] transition-colors",
                  network === n ? "bg-chip font-medium text-chip-text" : "text-muted hover:text-ink",
                )}
              >
                {NETWORK[n]}
              </button>
            ))}
          </div>
          <form onSubmit={add} className="flex flex-col gap-2.5 sm:flex-row">
            <label htmlFor="wallet-address" className="sr-only">
              {t.wallets.addressLabel(NETWORK[network])}
            </label>
            <Input
              id="wallet-address"
              placeholder={t.wallets.placeholder[network]}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (addError) setAddError(null);
              }}
              invalid={!!addError}
              autoComplete="off"
              spellCheck={false}
              className="flex-1"
            />
            <Button type="submit" icon={PlusIcon} loading={adding}>
              {t.wallets.addButton}
            </Button>
          </form>
          <InlineError>{addError}</InlineError>
          <p className="m-0 text-[13px] leading-[1.55] text-muted">{t.wallets.addNote}</p>
        </Panel>
      </div>

      {emptyWallet && (
        <StateBlock
          icon={TrayIcon}
          title={t.wallets.emptyTitle}
          actions={
            <>
              <Button onClick={() => document.getElementById("wallet-address")?.focus()}>{t.wallets.addAnother}</Button>
              <Button variant="secondary" icon={ArrowsClockwiseIcon} loading={syncing[emptyWallet.id]} onClick={() => sync(emptyWallet)}>
                {t.wallets.syncAgain}
              </Button>
            </>
          }
        >
          {t.wallets.emptyText(formatDate(emptyWallet.lastSyncAt!))[0]}
          <span className="font-mono text-ink">{shortAddress(emptyWallet.address)}</span>
          {t.wallets.emptyText(formatDate(emptyWallet.lastSyncAt!))[1]}
        </StateBlock>
      )}

      <InlineError>{rowError}</InlineError>
      <StaleDataError error={list.data ? list.error : null} onRetry={resumePolling} />
      {pollStopped && !list.error && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-bg px-4 py-2.5 text-[13px] leading-normal text-ink"
        >
          <span>{t.wallets.pollStopped}</span>
          <Button size="sm" variant="secondary" icon={ArrowsClockwiseIcon} loading={list.loading} onClick={resumePolling}>
            {t.wallets.checkNow}
          </Button>
        </div>
      )}

      {list.error && !list.data ? (
        <LoadFailure title={t.wallets.loadError} error={list.error} onRetry={resumePolling} />
      ) : (
        <Panel className="overflow-hidden">
          <Table
            caption={t.wallets.tableCaption}
            minWidth={860}
            columns={[
              { label: t.wallets.cols.network, width: "150px" },
              { label: t.wallets.cols.address, width: "200px" },
              { label: t.wallets.cols.label },
              { label: t.wallets.cols.lastSync, width: "220px" },
              { label: t.wallets.cols.status, width: "160px" },
              { label: "", width: "72px" },
            ]}
          >
            {list.loading && !list.data ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <Td colSpan={6}>
                    <Skeleton className="h-6" />
                  </Td>
                </tr>
              ))
            ) : wallets.length === 0 ? (
              <tr>
                <Td colSpan={6} className="py-8 text-sm text-muted">
                  {t.wallets.noWallets}
                </Td>
              </tr>
            ) : (
              wallets.map((w) => (
                <tr key={w.id}>
                  <Td className="py-4">
                    <Chip>{NETWORK[w.network]}</Chip>
                  </Td>
                  <Td className="font-mono text-[13px]">
                    <span title={w.address}>{shortAddress(w.address)}</span>
                  </Td>
                  <Td>{w.label}</Td>
                  <Td className="font-mono text-[13px] text-muted">{w.lastSyncAt ? formatDateTime(w.lastSyncAt) : "—"}</Td>
                  <Td>
                    <WalletStatus w={w} syncing={!!syncing[w.id]} />
                  </Td>
                  <Td align="right">
                    <IconButton
                      icon={ArrowsClockwiseIcon}
                      label={isImporting(w) ? t.wallets.importBusy : t.wallets.syncWallet(shortAddress(w.address))}
                      spinning={!!syncing[w.id]}
                      disabled={!!syncing[w.id] || isImporting(w)}
                      onClick={() => sync(w)}
                      className="ml-auto"
                    />
                  </Td>
                </tr>
              ))
            )}
          </Table>
        </Panel>
      )}
    </>
  );
}

function WalletStatus({ w, syncing }: { w: Wallet; syncing: boolean }) {
  const { t } = useI18n();
  if (syncing || w.status === "syncing")
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-[13px] text-accent-text">
        <ArrowsClockwiseIcon size={16} className="animate-spin-slow" aria-hidden />
        {t.wallets.syncing}
      </span>
    );
  if (w.status === "error")
    return (
      <span className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] text-danger">
          <WarningCircleIcon size={16} aria-hidden />
          {t.wallets.failed}
        </span>
        <span className="text-xs leading-snug text-muted">{w.error || t.wallets.failedHint}</span>
      </span>
    );
  if (w.status === "empty")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <TrayIcon size={16} aria-hidden />
        {t.wallets.noHistory}
      </span>
    );
  if (w.status === "pending")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <HourglassIcon size={16} aria-hidden />
        {t.wallets.pending}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ok">
      <CheckCircleIcon size={16} aria-hidden />
      {t.wallets.synced}
    </span>
  );
}
