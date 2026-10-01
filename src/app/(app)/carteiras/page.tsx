"use client";

import { useState } from "react";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  EyeIcon,
  PlusIcon,
  SealCheckIcon,
  SignatureIcon,
  TrayIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { api, errorMessage, type Wallet } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { formatDate, formatDateTime, shortAddress } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  Chip,
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

const NETWORK = { solana: "Solana", hyperliquid: "Hyperliquid" } as const;
const HL_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export default function CarteirasPage() {
  const { t } = useI18n();
  const list = useApi(() => api.listWallets(), []);
  const [address, setAddress] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<string | null>(null);

  const wallets = list.data ?? [];
  const loginWallet = wallets.find((w) => w.isLogin);
  const emptyWallet = wallets.find((w) => w.status === "empty" && w.lastSyncAt);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = address.trim();
    if (!HL_ADDRESS.test(value)) {
      setAddError(t.wallets.invalidAddress);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const w = await api.addWallet({ network: "hyperliquid", address: value });
      list.setData((prev) => [...(prev ?? []), w]);
      setAddress("");
      void sync(w);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const sync = async (w: Wallet) => {
    setSyncing((s) => ({ ...s, [w.id]: true }));
    setRowError(null);
    try {
      const updated = await api.syncWallet(w.id);
      list.setData((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
    } catch (err) {
      setRowError(`${shortAddress(w.address)}: ${errorMessage(err)}`);
    } finally {
      setSyncing((s) => ({ ...s, [w.id]: false }));
    }
  };

  return (
    <>
      <PageHeader kicker={list.data ? t.wallets.kicker(wallets.length) : t.common.loading} title={t.wallets.title} />

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
        ) : list.error ? null : (
          <Skeleton className="h-[196px] rounded-xl" />
        )}

        <Panel className="flex flex-col gap-4 p-7">
          <Kicker as="h2">
            <label htmlFor="hl-address">{t.wallets.addTitle}</label>
          </Kicker>
          <form onSubmit={add} className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              id="hl-address"
              placeholder="0x..."
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
              <Button onClick={() => document.getElementById("hl-address")?.focus()}>{t.wallets.addAnother}</Button>
              <Button variant="secondary" icon={ArrowsClockwiseIcon} loading={syncing[emptyWallet.id]} onClick={() => sync(emptyWallet)}>
                {t.wallets.syncAgain}
              </Button>
            </>
          }
        >
          {t.wallets.emptyText(formatDate("2025-01-01T15:00:00Z"))[0]}
          <span className="font-mono text-ink">{shortAddress(emptyWallet.address)}</span>
          {t.wallets.emptyText(formatDate("2025-01-01T15:00:00Z"))[1]}
        </StateBlock>
      )}

      <InlineError>{rowError}</InlineError>

      <Panel className="overflow-hidden">
        {list.error ? (
          <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-danger">
            {list.error}
            <Button size="sm" variant="secondary" onClick={list.reload}>
              {t.common.retry}
            </Button>
          </div>
        ) : (
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
            {list.loading && !list.data
              ? [0, 1, 2].map((i) => (
                  <tr key={i}>
                    <Td colSpan={6}>
                      <Skeleton className="h-6" />
                    </Td>
                  </tr>
                ))
              : wallets.map((w) => (
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
                        label={t.wallets.syncWallet(shortAddress(w.address))}
                        spinning={!!syncing[w.id]}
                        disabled={!!syncing[w.id]}
                        onClick={() => sync(w)}
                        className="ml-auto"
                      />
                    </Td>
                  </tr>
                ))}
          </Table>
        )}
      </Panel>
    </>
  );
}

function WalletStatus({ w, syncing }: { w: Wallet; syncing: boolean }) {
  const { t } = useI18n();
  if (syncing || w.status === "syncing")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-accent-text">
        <ArrowsClockwiseIcon size={16} className="animate-spin-slow" aria-hidden />
        {t.wallets.syncing}
      </span>
    );
  if (w.status === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-danger" title={w.error ?? undefined}>
        <WarningCircleIcon size={16} aria-hidden />
        {t.common.failed}
      </span>
    );
  if (w.status === "empty")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
        <TrayIcon size={16} aria-hidden />
        {t.wallets.noHistory}
      </span>
    );
  if (w.status === "pending") return <span className="text-[13px] text-muted">{t.common.queued}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ok">
      <CheckCircleIcon size={16} aria-hidden />
      {t.wallets.synced}
    </span>
  );
}
