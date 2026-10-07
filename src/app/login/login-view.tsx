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
  EnvelopeSimpleIcon,
  EyeIcon,
  GithubLogoIcon,
  GoogleLogoIcon,
  KeyIcon,
  PuzzlePieceIcon,
  SignatureIcon,
} from "@phosphor-icons/react";
import { useWalletLogin } from "@/lib/wallet-login";
import { useSession } from "@/lib/session";
import { api, demoLogin, errorMessage, type OAuthProvider, type Providers, type Session } from "@/lib/api";
import { postLoginRedirect } from "@/lib/auth-redirect";
import { Button, cn, InlineError, Input, LogoMark } from "@/components/ui";
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

type AuthMode = "idle" | "code";

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, user, signIn } = useSession();
  const { t } = useI18n();
  const { wallets, detected, phase, error, formattingError, loginWith, busy } = useWalletLogin();
  const [active, setActive] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  // Marca que o login partiu desta tela; aí quem decide o destino é go(), não o efeito abaixo.
  const loggingIn = useRef(false);

  // Quais formas de login o servidor tem ligadas. null enquanto não chegou (trata como tudo ligado).
  const [providers, setProviders] = useState<Providers | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  // O /auth/callback manda pra cá com ?error= quando o Google/GitHub falha ou o código vence.
  const [authError, setAuthError] = useState<string | null>(() => (params.get("error") ? t.login.oauthErrorGeneric : null));
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [resendLeft, setResendLeft] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .providers()
      .then((p) => alive && setProviders(p))
      .catch(() => alive && setProviders({ wallet: true, email: false, google: false, github: false }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!resendAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
      setResendLeft(left);
      if (left <= 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [resendAt]);

  const go = (s: Session | null) => {
    if (!s) {
      loggingIn.current = false;
      return;
    }
    router.replace(postLoginRedirect(s.user, params.get("next")));
  };

  useEffect(() => {
    if (status === "authenticated" && !loggingIn.current && user) router.replace(postLoginRedirect(user, params.get("next")));
  }, [status, user, router, params]);

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

  const startEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setEmailBusy(true);
    try {
      const res = await api.emailStart(email.trim());
      setResendAt(Date.now() + res.resendAfter * 1000);
      setResendLeft(res.resendAfter);
      setAuthMode("code");
    } catch (err) {
      setAuthError(errorMessage(err));
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setCodeBusy(true);
    loggingIn.current = true;
    try {
      const s = await api.emailVerify(email.trim(), code.trim());
      signIn(s);
      go(s);
    } catch (err) {
      setAuthError(errorMessage(err));
      loggingIn.current = false;
    } finally {
      setCodeBusy(false);
    }
  };

  const startOAuth = async (provider: OAuthProvider) => {
    setAuthError(null);
    setOauthBusy(provider);
    try {
      const next = params.get("next");
      const { url } = await api.oauthStart(provider, next && next.startsWith("/") ? next : undefined);
      window.location.href = url;
    } catch (err) {
      setAuthError(errorMessage(err));
      setOauthBusy(null);
    }
  };

  const noWallet = detected && wallets.length === 0;
  const anyBusy = busy || demoBusy || emailBusy || codeBusy || oauthBusy !== null;
  // Enquanto providers ainda não chegou, mostra tudo (evita esconder botão à toa); depois, respeita o servidor.
  const showWallet = providers?.wallet !== false;
  const showEmail = providers?.email !== false;
  const showGoogle = providers?.google === true;
  const showGithub = providers?.github === true;

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
          {showWallet && authMode === "idle" && (
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
                      disabled={anyBusy}
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
          )}

          {authMode === "idle" && <InlineError>{error}</InlineError>}
          {authMode === "idle" && error && formattingError && (
            <details className="rounded-xl border border-line bg-panel p-4 text-[13px] leading-relaxed">
              <summary className="cursor-pointer font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                {t.walletErrors.recoveryTitle}
              </summary>
              <p className="mt-3 text-muted">{t.walletErrors.recoveryIntro}</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink">
                {t.walletErrors.recoverySteps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <p className="mt-3 text-muted">{t.walletErrors.recoverySafety}</p>
              <p className="mt-3 text-muted">{t.walletErrors.recoveryPersistent}</p>
            </details>
          )}

          {authMode === "code" ? (
            <form onSubmit={verifyEmail} className="flex flex-col gap-3">
              <p className="m-0 text-[13px] text-muted">{t.login.emailSent(email)}</p>
              <label htmlFor="login-code" className="text-[13px] font-medium">
                {t.login.codeLabel}
              </label>
              <Input
                id="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t.login.codePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                autoFocus
                required
              />
              <InlineError>{authError}</InlineError>
              <Button type="submit" size="lg" className="w-full" loading={codeBusy} disabled={code.length !== 6}>
                {t.login.codeButton}
              </Button>
              <div className="flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("idle");
                    setCode("");
                    setAuthError(null);
                  }}
                  className="cursor-pointer bg-transparent p-0 text-accent-text hover:underline"
                >
                  {t.login.useAnotherEmail}
                </button>
                <button
                  type="button"
                  disabled={resendLeft > 0 || emailBusy}
                  onClick={startEmail}
                  className="cursor-pointer bg-transparent p-0 text-accent-text hover:underline disabled:cursor-not-allowed disabled:text-faint disabled:no-underline"
                >
                  {resendLeft > 0 ? t.login.resendIn(resendLeft) : t.login.resend}
                </button>
              </div>
            </form>
          ) : (
            (showEmail || showGoogle || showGithub) && (
              <>
                {showWallet && (
                  <div className="flex items-center gap-3" role="separator" aria-label={t.login.or}>
                    <span className="h-px flex-1 bg-line" />
                    <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{t.login.or}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                {showEmail && (
                  <form onSubmit={startEmail} className="flex gap-2">
                    <label htmlFor="login-email" className="sr-only">
                      {t.login.emailLabel}
                    </label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t.login.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={anyBusy}
                      className="flex-1"
                    />
                    <Button type="submit" variant="secondary" icon={EnvelopeSimpleIcon} loading={emailBusy} disabled={anyBusy && !emailBusy}>
                      {t.login.emailButton}
                    </Button>
                  </form>
                )}
                {(showGoogle || showGithub) && (
                  <div className="flex flex-col gap-2">
                    {showGoogle && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        icon={GoogleLogoIcon}
                        className="w-full"
                        loading={oauthBusy === "google"}
                        disabled={anyBusy && oauthBusy !== "google"}
                        onClick={() => startOAuth("google")}
                      >
                        {t.login.googleButton}
                      </Button>
                    )}
                    {showGithub && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        icon={GithubLogoIcon}
                        className="w-full"
                        loading={oauthBusy === "github"}
                        disabled={anyBusy && oauthBusy !== "github"}
                        onClick={() => startOAuth("github")}
                      >
                        {t.login.githubButton}
                      </Button>
                    )}
                  </div>
                )}
                <InlineError>{authError}</InlineError>
              </>
            )
          )}

          {authMode === "idle" && (
            <>
              <div className="flex items-center gap-3" role="separator" aria-label={t.login.or}>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">{t.login.or}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-xs text-muted">{t.login.demoHint}</p>
                <Button variant="secondary" size="lg" className="w-full" loading={demoBusy} disabled={anyBusy && !demoBusy} onClick={enterDemo}>
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
