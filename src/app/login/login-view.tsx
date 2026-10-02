"use client";

import { OrbixSignature } from "@/components/orbix-signature";

import { LoginPlanet } from "@/components/login-planet";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Wallet as AdapterWallet } from "@solana/wallet-adapter-react";
import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CircleNotchIcon,
  EyeIcon,
  KeyIcon,
  PuzzlePieceIcon,
  SignatureIcon,
} from "@phosphor-icons/react";
import { useWalletLogin } from "@/lib/wallet-login";
import { useSession } from "@/lib/session";
import { demoLogin, type Session } from "@/lib/api";
import { config } from "@/lib/config";
import { Button, cn, InlineError, LogoMark } from "@/components/ui";
import { StarField } from "@/components/star-field";
import { TypewriterText } from "@/components/typewriter-text";
import { LanguageSwitch } from "@/components/language-switch";
import { useI18n } from "@/lib/i18n";

/*
 * Layout inspirado no bloco "auth-5" do Efferd (efferd.com): painel de marca com estrelas animadas
 * à esquerda, formulário centralizado à direita, um botão por provedor, divisor e alternativa abaixo.
 * Adaptado para a paleta do Orbix Declare e para o login com carteira Solana (sem e-mail/senha).
 */

const INSTALL_LINKS = [
  { name: "Phantom", href: "https://phantom.app/download" },
  { name: "Solflare", href: "https://solflare.com/download" },
];

function safeNext(raw: string | null) {
  // Só caminhos internos, para não virar open redirect.
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/painel";
}

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, signIn } = useSession();
  const { t } = useI18n();
  const { wallets, detected, phase, error, loginWith, busy } = useWalletLogin();
  const [active, setActive] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  // Marca que o login partiu desta tela; aí quem decide o destino é go(), não o efeito abaixo.
  const loggingIn = useRef(false);

  const go = (s: Session | null) => {
    if (!s) {
      loggingIn.current = false;
      return;
    }
    router.replace(s.user.onboarded ? safeNext(params.get("next")) : "/sincronizacao");
  };

  useEffect(() => {
    if (status === "authenticated" && !loggingIn.current) router.replace(safeNext(params.get("next")));
  }, [status, router, params]);

  const connect = async (w: AdapterWallet) => {
    loggingIn.current = true;
    setActive(w.adapter.name);
    const s = await loginWith(w);
    setActive(null);
    go(s);
  };

  const enterDemo = async () => {
    loggingIn.current = true;
    setDemoBusy(true);
    try {
      const s = await demoLogin();
      signIn(s);
      go(s);
    } catch {
      loggingIn.current = false;
      setDemoBusy(false);
    }
  };

  const noWallet = detected && wallets.length === 0;

  return (
    <main className="relative min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
      {/* ───────── Painel da marca (c?u estrelado) ───────── */}
      <section className="relative hidden min-h-dvh flex-col overflow-hidden bg-brand-deep p-12 text-brand-mist lg:flex xl:p-14">
        <StarField />
        <div aria-hidden="true" className="login-panel-blend" />

        <div className="relative z-10 flex items-center gap-3.5">
          <LoginPlanet />
          <div className="flex flex-col gap-[3px]">
            <span className="font-display text-2xl leading-[1.1] font-semibold tracking-[-0.02em] text-brand-paper"><span className="text-gold">Orbix</span>{" "}Declare</span>
            <span className="font-mono text-[11px] tracking-[0.04em] text-brand-paper"><OrbixSignature text={t.common.byOrbix} /></span>
          </div>
        </div>

        <div className="login-brand-copy relative z-10 mt-auto flex flex-col gap-7">
          <h2 className="type-h1 m-0 max-w-[15ch] text-pretty text-brand-paper">
            <TypewriterText text={t.login.headline} />
          </h2>
          <p className="m-0 max-w-[460px] text-base leading-relaxed text-pretty text-brand-lilac">
            <TypewriterText text={t.login.pitch} start={Array.from(t.login.headline).length + 10} />
          </p>
          <ol
            className="login-typed-steps relative m-0 flex list-none flex-col gap-3 p-0 pt-6"
            style={{
              "--divider-delay": `${150 + (Array.from(t.login.headline + t.login.pitch + t.login.steps.join("")).length + 20 + Math.max(0, t.login.steps.length - 1) * 8) * 22 + 200}ms`,
            } as CSSProperties}
          >
            {t.login.steps.map((s, i) => (
              <li key={s} className="flex items-baseline gap-4">
                <span className="font-mono text-xs text-soft">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[15px]">
                  <TypewriterText
                    text={s}
                    start={Array.from(t.login.headline + t.login.pitch + t.login.steps.slice(0, i).join("")).length + 20 + i * 8}
                  />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── Formulário ───────── */}
      <section className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-16 sm:px-10">
        {/* Brilho suave no canto, na cor da marca */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-64 -right-32 h-[640px] w-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]" />
        </div>

        <LanguageSwitch className="absolute top-5 right-5 sm:top-6 sm:right-6" />

        <div className="page-enter mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size={26} />
            <span className="font-display text-lg font-semibold tracking-[-0.02em]"><span className="text-gold">Orbix</span>{" "}Declare</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="type-h1 m-0">
              {/* Primeira frase em branco; a promessa (segunda frase) em lilás, como o "Declare" da marca. */}
              {t.login.title.split(/(?<=\.)\s/).map((part, i) => (
                <span key={i} className={i > 0 ? "block text-accent-text" : "block"}>
                  {part}
                </span>
              ))}
            </h1>
            <p className="m-0 text-[15px] leading-relaxed text-muted">{t.login.subtitle}</p>
          </div>

          {/* Um botão por carteira detectada (Wallet Standard) */}
          <div className="flex flex-col gap-2.5">
            {!detected ? (
              <Button size="lg" loading disabled className="w-full">
                {t.login.searching}
              </Button>
            ) : noWallet ? (
              <NoWalletCard />
            ) : (
              wallets.map((w) => {
                const isActive = active === w.adapter.name;
                return (
                  <button
                    key={w.adapter.name}
                    type="button"
                    disabled={busy || demoBusy}
                    aria-busy={isActive || undefined}
                    onClick={() => connect(w)}
                    className={cn(
                      "group relative flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-accent px-4 text-[15px] font-medium text-on-accent transition-colors",
                      "hover:bg-accent-hover disabled:cursor-not-allowed",
                      busy && !isActive && "opacity-55",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- ícone da carteira vem como data: URI */}
                    <img src={w.adapter.icon} alt="" width={22} height={22} className="absolute left-4 rounded-md" />
                    {isActive && phase !== "idle" ? (
                      <>
                        <CircleNotchIcon size={18} className="animate-spin-slow" aria-hidden />
                        {t.login.phase[phase]}
                      </>
                    ) : (
                      <>{t.login.continueWith(w.adapter.name)}</>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <InlineError>{error}</InlineError>

          {config.useMocks && (
            <>
              <div className="flex items-center gap-3" role="separator" aria-label={t.login.or}>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{t.login.or}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-xs text-muted">{t.login.demoHint}</p>
                <Button variant="secondary" size="lg" className="w-full" loading={demoBusy} disabled={busy} onClick={enterDemo}>
                  {t.login.demoButton}
                </Button>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-5 text-[13px] leading-[1.55] text-muted">
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-ink/80">
              <span className="inline-flex items-center gap-1.5">
                <EyeIcon size={14} className="text-accent-text" aria-hidden />
                {t.common.readOnly}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyIcon size={14} className="text-accent-text" aria-hidden />
                {t.login.noPrivateKey}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SignatureIcon size={14} className="text-accent-text" aria-hidden />
                {t.login.oneSignature}
              </span>
            </div>
            <p className="m-0 text-pretty">{t.login.signatureNote}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Estado "sem extensão": card discreto com ícone pequeno e as ações ao lado. */
function NoWalletCard() {
  const { t } = useI18n();
  return (
    <div role="status" className="flex gap-3.5 rounded-xl border border-line bg-panel p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-accent-text">
        <PuzzlePieceIcon size={18} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-sm font-medium">{t.login.noWalletTitle}</p>
        <p className="m-0 text-[13px] leading-normal text-muted">{t.login.noWalletText}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {INSTALL_LINKS.map((l) => (
            <a
              key={l.name}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line2 px-2.5 text-[13px] font-medium text-ink no-underline transition-colors hover:border-accent"
            >
              {l.name}
              <ArrowSquareOutIcon size={13} className="text-muted" aria-hidden />
            </a>
          ))}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-accent-text transition-colors hover:bg-card"
          >
            <ArrowClockwiseIcon size={13} aria-hidden />
            {t.login.reload}
          </button>
        </div>
      </div>
    </div>
  );
}
