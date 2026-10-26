"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BellIcon,
  CaretDownIcon,
  CrownSimpleIcon,
  FileTextIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  SquaresFourIcon,
  WalletIcon,
  WarningIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { TaxEvent, Wallet } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatBRL, formatDate, identityLabel, shortAddress } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { LumeIcon } from "@/components/lume-icon";
import { TokenIcon } from "@/components/token-icon";

/*
 * Barra do topo do painel: busca (Ctrl/⌘ K), notificações e menu da conta.
 * Tudo sai de dados que o painel já carregou; as notificações são derivadas (sem preço, sem custo,
 * carteira com erro, primeira leitura, mês tributável), não há serviço de notificação no back-end.
 */

/** Fecha o popover com clique fora ou Escape (o foco volta ao botão). */
function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, root, trigger };
}

const noSubscribe = () => () => {};
const POPOVER = "absolute top-[calc(100%+8px)] right-0 z-20 rounded-2xl border border-line bg-panel p-2 shadow-frame";
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Result = { id: string; label: string; detail: string; icon: React.ReactNode; run: () => void };

export function SearchBox({
  events,
  wallets,
  onOpenEvent,
}: {
  events: TaxEvent[] | null;
  wallets: Wallet[] | null;
  onOpenEvent: (e: TaxEvent) => void;
}) {
  const { t } = useI18n();
  const s = t.dashboard.search;
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const isMac = useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const has = (...parts: (string | null | undefined)[]) => normalize(parts.filter(Boolean).join(" ")).includes(q);
    const pageIcon = (I: Icon | typeof LumeIcon) => <I size={16} aria-hidden />;
    const pages: Result[] = [
      { href: "/painel", label: t.nav.dashboard, icon: SquaresFourIcon },
      { href: "/carteiras", label: t.nav.wallets, icon: WalletIcon },
      { href: "/relatorios", label: t.nav.reports, icon: FileTextIcon },
      { href: "/agente", label: t.nav.agent, icon: LumeIcon },
      { href: "/configuracoes", label: t.nav.settings, icon: GearSixIcon },
    ]
      .filter((p) => has(p.label))
      .map((p) => ({ id: p.href, label: p.label, detail: p.href, icon: pageIcon(p.icon), run: () => router.push(p.href) }));
    const walletResults: Result[] = (wallets ?? [])
      .filter((w) => has(w.label, w.address, w.network))
      .slice(0, 4)
      .map((w) => ({
        id: `w-${w.id}`,
        label: w.label,
        detail: shortAddress(w.address),
        icon: pageIcon(WalletIcon),
        run: () => router.push("/carteiras"),
      }));
    const eventResults: Result[] = (events ?? [])
      .filter((e) => has(e.asset, e.quantityAsset, t.eventType[e.type], e.protocol, e.network, formatDate(e.date), e.txHash))
      .slice(0, 6)
      .map((e) => ({
        id: `e-${e.id}`,
        label: e.asset,
        detail: `${t.eventType[e.type]} · ${formatDate(e.date)} · ${e.valueBrl === null ? t.dashboard.noPrice : formatBRL(e.valueBrl)}`,
        icon: <TokenIcon symbol={e.quantityAsset} size={18} />,
        run: () => onOpenEvent(e),
      }));
    return [
      { title: s.events, items: eventResults },
      { title: s.wallets, items: walletResults },
      { title: s.pages, items: pages },
    ].filter((g) => g.items.length > 0);
  }, [query, events, wallets, t, s, router, onOpenEvent]);

  const flat = groups.flatMap((g) => g.items);
  const open = focused && query.trim().length > 0;
  const current = flat[Math.min(active, flat.length - 1)];

  const choose = (r: Result) => {
    r.run();
    setQuery("");
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="relative w-full md:w-[340px]">
      <MagnifyingGlassIcon size={17} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 z-[1] -translate-y-1/2 text-muted" />
      <input
        ref={input}
        role="combobox"
        aria-label={s.label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && current ? `${listId}-${current.id}` : undefined}
        value={query}
        placeholder={s.placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (flat.length) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : flat.length - 1)) % flat.length);
          } else if (e.key === "Enter" && open && current) {
            e.preventDefault();
            choose(current);
          } else if (e.key === "Escape") {
            setQuery("");
          }
        }}
        className="h-11 w-full rounded-xl border border-line bg-panel/80 pr-16 pl-10 text-[13.5px] text-ink backdrop-blur outline-none placeholder:text-faint focus:border-accent"
      />
      <kbd className="pointer-events-none absolute max-sm:hidden top-1/2 right-3 -translate-y-1/2 rounded-md border border-line2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
        {isMac ? "⌘ K" : "Ctrl K"}
      </kbd>
      {open && (
        <div id={listId} role="listbox" aria-label={s.label} className={cn(POPOVER, "left-0 max-h-[60vh] overflow-y-auto")}>
          {groups.length === 0 ? (
            <p className="m-0 px-3 py-2.5 text-[13px] text-muted">{s.empty}</p>
          ) : (
            groups.map((g) => (
              <div key={g.title} role="group" aria-label={g.title} className="flex flex-col py-1">
                <span className="px-3 pt-1 pb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">{g.title}</span>
                {g.items.map((r) => (
                  <div
                    key={r.id}
                    id={`${listId}-${r.id}`}
                    role="option"
                    aria-selected={r === current}
                    // mousedown: escolhe antes do blur do campo fechar a lista.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(r);
                    }}
                    onMouseEnter={() => setActive(flat.indexOf(r))}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2",
                      r === current ? "bg-chip text-chip-text" : "text-ink",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-bg text-accent-text">{r.icon}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13.5px] font-medium">{r.label}</span>
                      <span className="truncate text-[12px] text-muted">{r.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export interface Notice {
  id: string;
  text: string;
  href: string;
  tone: "warn" | "danger" | "accent";
}

export function NotificationsMenu({ notices }: { notices: Notice[] }) {
  const { t } = useI18n();
  const n = t.dashboard.notifications;
  const { open, setOpen, root, trigger } = usePopover();
  const label = notices.length ? `${n.label} · ${n.count(notices.length)}` : n.label;

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-panel/80 text-ink backdrop-blur transition-colors hover:border-line2"
      >
        <BellIcon size={19} aria-hidden />
        {notices.length > 0 && (
          <span aria-hidden className="absolute top-2 right-2.5 size-2.5 rounded-full border-2 border-panel bg-danger" />
        )}
      </button>
      {open && (
        <div className={cn(POPOVER, "w-[min(340px,calc(100vw-32px))]")}>
          <p className="m-0 px-3 pt-1.5 pb-2 font-mono text-[10.5px] tracking-[0.08em] text-muted uppercase">{n.label}</p>
          {notices.length === 0 ? (
            <p className="m-0 px-3 pb-2.5 text-[13px] text-muted">{n.empty}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {notices.map((x) => (
                <li key={x.id}>
                  <Link
                    href={x.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-[13px] text-ink no-underline hover:bg-chip"
                  >
                    <WarningIcon
                      size={17}
                      aria-hidden
                      className={cn("mt-px shrink-0", x.tone === "danger" ? "text-danger" : x.tone === "warn" ? "text-warn" : "text-accent-text")}
                    />
                    {x.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function AccountMenu() {
  const { t } = useI18n();
  const a = t.dashboard.account;
  const { user, signOut } = useSession();
  const router = useRouter();
  const { open, setOpen, root, trigger } = usePopover();
  if (!user) return null;

  const name = user.displayName ?? identityLabel(user);
  const initial = (user.displayName ?? user.email ?? "O").trim().charAt(0).toUpperCase();
  const planName = user.plan === "pro" ? t.settings.pro : user.plan === "accountant" ? a.accountant : t.settings.free;
  const item = "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-ink no-underline hover:bg-chip";

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label={a.open}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 cursor-pointer items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 text-left transition-colors hover:bg-panel/70"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-brand-deep font-display text-[15px] font-semibold text-brand-paper"
        >
          {user.displayName || user.email ? initial : <WalletIcon size={16} />}
        </span>
        <span className="hidden min-w-0 flex-col sm:flex">
          <span className="max-w-[140px] truncate text-[13.5px] font-semibold text-ink">{name}</span>
          <span className="text-[11.5px] text-muted">{a.plan(planName)}</span>
        </span>
        <CaretDownIcon size={14} aria-hidden className="text-muted" />
      </button>
      {open && (
        <div className={cn(POPOVER, "flex w-[260px] flex-col gap-0.5")}>
          <div className="flex flex-col gap-0.5 px-3 pt-1.5 pb-2.5">
            <span className="truncate text-[13.5px] font-semibold text-ink">{name}</span>
            <span className="text-[12px] text-muted">{a.questionsLeft(user.agentQuestionsLeft)}</span>
          </div>
          <Link href="/configuracoes" onClick={() => setOpen(false)} className={item}>
            <GearSixIcon size={17} aria-hidden />
            {t.nav.settings}
          </Link>
          <Link href="/precos" onClick={() => setOpen(false)} className={item}>
            <CrownSimpleIcon size={17} aria-hidden />
            {a.seePlans}
          </Link>
          <button
            type="button"
            onClick={() => {
              router.replace("/login");
              void signOut();
            }}
            className={cn(item, "cursor-pointer bg-transparent text-left")}
          >
            <SignOutIcon size={17} aria-hidden />
            {t.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
