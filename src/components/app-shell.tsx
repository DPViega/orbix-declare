"use client";

import { OrbixSignature } from "@/components/orbix-signature";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileTextIcon,
  GearSixIcon,
  ListIcon,
  SignOutIcon,
  SparkleIcon,
  SquaresFourIcon,
  WalletIcon,
  XIcon,
  type Icon,
} from "@phosphor-icons/react";
import { useSession } from "@/lib/session";
import { shortAddress } from "@/lib/format";
import { config } from "@/lib/config";
import { cn, LogoMark } from "@/components/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n, type Messages } from "@/lib/i18n";

/** Rotas que ocupam a área inteira, sem o padding padrão (ex.: chat do agente). */
const FULL_BLEED = ["/agente"];

const NAV: { href: string; key: keyof Messages["nav"]; icon: Icon }[] = [
  { href: "/painel", key: "dashboard", icon: SquaresFourIcon },
  { href: "/carteiras", key: "wallets", icon: WalletIcon },
  { href: "/relatorios", key: "reports", icon: FileTextIcon },
  { href: "/agente", key: "agent", icon: SparkleIcon },
];

function NavItem({
  href,
  label,
  icon: I,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium no-underline transition-colors",
        active ? "bg-accent text-brand-paper" : "text-brand-nav hover:bg-brand-surface hover:text-brand-paper",
      )}
    >
      <I size={20} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

/** Sidebar fixa de 248px — sempre escura, nos dois temas (igual ao mockup). */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const router = useRouter();
  const { t } = useI18n();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col px-4 pt-7 pb-5">
      <Link href="/painel" onClick={onNavigate} className="flex items-center gap-3 px-3 pb-9 no-underline">
        <LogoMark size={30} />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-[19px] leading-[1.1] font-semibold tracking-[-0.02em] text-brand-paper"><span className="text-gold">Orbix</span>{" "}Declare</span>
          <span className="font-mono text-[10px] tracking-[0.04em] text-brand-paper"><OrbixSignature text={t.common.byOrbix} /></span>
        </span>
      </Link>

      <nav aria-label={t.nav.main} className="flex flex-col gap-1">
        {NAV.map((n) => (
          <NavItem key={n.href} href={n.href} icon={n.icon} label={t.nav[n.key]} active={isActive(n.href)} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col gap-3 border-t border-brand-line pt-4">
        <NavItem
          href="/configuracoes"
          label={t.nav.settings}
          icon={GearSixIcon}
          active={isActive("/configuracoes")}
          onNavigate={onNavigate}
        />
        <div className="flex flex-col gap-2.5 rounded-xl border border-brand-line bg-brand-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[13px] text-brand-paper" title={user?.address}>
              {user ? shortAddress(user.address) : "—"}
            </span>
            <span className="rounded-md bg-brand-deep px-[7px] py-[3px] font-mono text-[10px] tracking-[0.06em] text-brand-lilac uppercase">
              Solana
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              router.replace("/login");
              void signOut();
            }}
            className="flex cursor-pointer items-center gap-2 bg-transparent p-0 text-left text-[13px] text-brand-dim transition-colors hover:text-brand-paper"
          >
            <SignOutIcon size={16} aria-hidden />
            <span>{t.nav.signOut}</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <LanguageSwitch tone="brand" />
          {config.useMocks && (
            <span className="px-1 font-mono text-[10px] tracking-[0.06em] text-brand-dim uppercase">{t.common.demoMode}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname + window.location.search)}`);
  }, [status, router, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg" aria-busy="true">
        <LogoMark size={36} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 bg-brand-night lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile: barra superior + gaveta */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between bg-brand-night px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Link href="/painel" className="flex items-center gap-2.5 no-underline">
          <LogoMark size={24} />
          <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-brand-paper"><span className="text-gold">Orbix</span>{" "}Declare</span>
        </Link>
        <button
          type="button"
          aria-label={t.nav.openMenu}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-brand-paper hover:bg-brand-surface"
        >
          <ListIcon size={22} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <button
            aria-label={t.nav.closeMenu}
            className="absolute inset-0 cursor-default bg-brand-night/60 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="page-enter absolute inset-y-0 left-0 w-[272px] max-w-[85vw] bg-brand-night shadow-frame">
            <button
              type="button"
              aria-label={t.nav.closeMenu}
              onClick={() => setOpen(false)}
              className="absolute top-6 right-3 flex size-9 cursor-pointer items-center justify-center rounded-xl text-brand-nav hover:text-brand-paper"
            >
              <XIcon size={18} aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {FULL_BLEED.some((p) => pathname.startsWith(p)) ? (
        <main className="flex min-h-dvh min-w-0 flex-1 flex-col pt-[calc(56px+env(safe-area-inset-top))] lg:h-dvh lg:pt-0">{children}</main>
      ) : (
        <main className="min-w-0 flex-1 px-4 pt-[calc(56px+24px+env(safe-area-inset-top))] pb-12 sm:px-8 lg:px-12 lg:pt-10">
          <div key={pathname} className="page-enter mx-auto flex w-full max-w-[1192px] flex-col gap-6 md:gap-7">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}
