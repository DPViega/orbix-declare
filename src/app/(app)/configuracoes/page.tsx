"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ArrowRightIcon, DesktopIcon, MoonIcon, SunIcon, TrashIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useSession } from "@/lib/session";
import { shortAddress } from "@/lib/format";
import { Button, Card, Chip, cn, InlineError, Input, Kicker, Panel, Skeleton } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";

const NETWORK = { solana: "Solana", hyperliquid: "Hyperliquid" } as const;

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const { t } = useI18n();
  const CONFIRM_WORD = t.settings.confirmWord;
  const wallets = useApi(() => api.listWallets(), []);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [dangerOpen, setDangerOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setRemoving(id);
    setWalletError(null);
    try {
      await api.removeWallet(id);
      wallets.setData((prev) => prev?.filter((w) => w.id !== id) ?? null);
      setConfirming(null);
    } catch (err) {
      setWalletError(errorMessage(err));
    } finally {
      setRemoving(null);
    }
  };

  const deleteAll = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      await signOut();
      router.replace("/login");
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  };

  const isPro = user?.plan === "pro";

  return (
    <div className="flex max-w-[912px] flex-col gap-7">
      <h1 className="type-h1 m-0">{t.settings.title}</h1>

      <Card className="grid grid-cols-1 items-center gap-6 p-7 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-2.5">
          <Kicker>{t.settings.plan}</Kicker>
          <span className="font-display text-[30px] font-semibold">{isPro ? t.settings.pro : t.settings.free}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>{t.settings.upTo3}</span>
            <span>{t.settings.monthlyReports}</span>
            <span>
              {t.settings.questions}
              {user && !isPro && <span className="text-faint"> · {t.settings.left(user.agentQuestionsLeft)}</span>}
            </span>
          </div>
        </div>
        {!isPro && (
          <Button iconRight={ArrowRightIcon} className="justify-self-start md:justify-self-end" disabled title={t.settings.soon}>
            {t.settings.discoverPro}
          </Button>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2 m-0">{t.settings.appearance}</h2>
        <ThemePicker />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2 m-0">{t.language.label}</h2>
        <LanguageSwitch size="lg" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-h2 m-0">{t.settings.connected}</h2>
        <InlineError>{walletError}</InlineError>
        <Panel className="overflow-hidden">
          {wallets.error ? (
            <div className="flex flex-wrap items-center gap-3 p-6 text-sm text-danger">
              {wallets.error}
              <Button size="sm" variant="secondary" onClick={wallets.reload}>
                {t.common.retry}
              </Button>
            </div>
          ) : wallets.loading && !wallets.data ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-7" />
              ))}
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {(wallets.data ?? []).map((w) => (
                <li
                  key={w.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-line px-6 py-3.5 last:border-b-0 md:grid-cols-[130px_180px_minmax(0,1fr)_auto]"
                >
                  <span>
                    <Chip>{NETWORK[w.network]}</Chip>
                  </span>
                  <span className="font-mono text-[13px]" title={w.address}>
                    {shortAddress(w.address)}
                  </span>
                  <span className="truncate text-muted max-md:col-span-1">{w.label}</span>
                  <span className="flex justify-end gap-2 max-md:col-start-2">
                    {w.isLogin ? (
                      <span className="text-[13px] text-faint">{t.settings.loginWallet}</span>
                    ) : confirming === w.id ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                          {t.common.cancel}
                        </Button>
                        <Button size="sm" variant="danger" loading={removing === w.id} onClick={() => remove(w.id)}>
                          {t.settings.removeForGood}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-[34px] px-3 text-[13px] text-muted"
                        onClick={() => setConfirming(w.id)}
                      >
                        {t.settings.remove}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <section className="flex flex-col gap-3.5 rounded-xl border border-danger p-7" aria-labelledby="danger-title">
        <div className="flex items-center gap-2.5 text-danger">
          <WarningOctagonIcon size={22} aria-hidden />
          <h2 id="danger-title" className="type-h2 m-0">
            {t.settings.danger}
          </h2>
        </div>
        <p className="m-0 max-w-[640px] text-sm leading-[1.65] text-pretty text-muted">{t.settings.dangerText}</p>
        {!dangerOpen ? (
          <Button variant="danger" icon={TrashIcon} className="self-start" onClick={() => setDangerOpen(true)}>
            {t.settings.deleteData}
          </Button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim().toUpperCase() === CONFIRM_WORD) void deleteAll();
            }}
            className="flex max-w-[520px] flex-col gap-3"
          >
            <label htmlFor="confirm-delete" className="text-[13px] font-medium">
              {t.settings.typeToConfirm} <span className="font-mono">{CONFIRM_WORD}</span>
            </label>
            <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
            <InlineError>{deleteError}</InlineError>
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="submit"
                variant="danger"
                icon={TrashIcon}
                loading={deleting}
                disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
              >
                {t.settings.deleteForever}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDangerOpen(false);
                  setTyped("");
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

const noopSubscribe = () => () => {};

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  // O tema só é conhecido no navegador; no servidor nenhuma opção aparece marcada.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const options = [
    { key: "light", label: t.settings.light, icon: SunIcon },
    { key: "dark", label: t.settings.dark, icon: MoonIcon },
    { key: "system", label: t.settings.system, icon: DesktopIcon },
  ] as const;
  return (
    <div role="radiogroup" aria-label={t.settings.theme} className="flex w-fit gap-1 rounded-xl border border-line bg-panel p-[3px]">
      {options.map(({ key, label, icon: I }) => {
        const active = mounted && theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(key)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-[9px] px-3.5 py-2 text-[13px] transition-colors",
              active ? "bg-chip font-medium text-chip-text" : "text-muted hover:text-ink",
            )}
          >
            <I size={16} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
