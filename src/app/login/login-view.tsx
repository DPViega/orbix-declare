"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { useWalletLogin, type LoginPhase } from "@/lib/wallet-login";
import { useSession } from "@/lib/session";
import { demoLogin, type Session } from "@/lib/api";
import { config } from "@/lib/config";
import { Button, cn, InlineError, LogoMark } from "@/components/ui";
import { FloatingPaths } from "@/components/floating-paths";

/*
 * Layout inspirado no bloco "auth-5" do Efferd (efferd.com): painel de marca com linhas animadas
 * à esquerda, formulário centralizado à direita, um botão por provedor, divisor e alternativa abaixo.
 * Adaptado para a paleta do Orbix Declare e para o login com carteira Solana (sem e-mail/senha).
 */

const STEPS = ["Conecte a carteira com uma assinatura", "O agente lê swaps, perps e funding", "Revise e gere a DeCripto em R$"];

const PHASE_LABEL: Record<Exclude<LoginPhase, "idle">, string> = {
  connecting: "Conectando…",
  signing: "Assine na carteira…",
  verifying: "Verificando…",
};

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
      {/* ───────── Painel da marca (sempre roxo profundo) ───────── */}
      <section className="relative hidden min-h-dvh flex-col overflow-hidden bg-brand-deep p-12 text-brand-mist lg:flex xl:p-14">
        {/* Feixe de ondas no espaço livre acima do texto */}
        <FloatingPaths position={1} className="absolute inset-0 h-full w-full text-soft" />
        <FloatingPaths position={-1} className="absolute inset-0 h-full w-full text-brand-lilac" />
        {/* Escurece a base para o texto ficar legível sobre as linhas */}
        <div aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent from-30% via-brand-deep/85 via-55% to-brand-deep to-70%" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-60 bg-linear-to-b from-brand-deep from-55% to-transparent" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div className="flex rounded-xl bg-brand-paper px-3 py-2.5">
            <Image src="/brand/orbix-declare-logo.png" alt="" width={43} height={30} style={{ height: 30, width: "auto" }} priority />
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="font-display text-2xl leading-[1.1] font-semibold tracking-[-0.02em] text-brand-paper">Orbix Declare</span>
            <span className="font-mono text-[11px] tracking-[0.04em] text-soft">por orbix. lab</span>
          </div>
        </div>

        <div className="relative z-10 mt-auto flex flex-col gap-7">
          <h2 className="m-0 max-w-[15ch] font-display text-[clamp(36px,3.4vw,52px)] leading-[1.04] font-medium tracking-[-0.03em] text-pretty text-brand-paper">
            Seus impostos cripto, calculados em reais.
          </h2>
          <p className="m-0 max-w-[460px] text-base leading-relaxed text-pretty text-brand-lilac">
            Um agente de IA lê suas carteiras Solana e Hyperliquid, converte cada evento pela PTAX e prepara a DeCripto do mês para a
            Receita Federal.
          </p>
          <ol className="m-0 flex list-none flex-col gap-3 border-t border-brand-deep-line p-0 pt-6">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-baseline gap-4">
                <span className="font-mono text-xs text-soft">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[15px]">{s}</span>
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

        <div className="page-enter mx-auto flex w-full max-w-[400px] flex-col gap-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark size={26} />
            <span className="font-display text-lg font-semibold tracking-[-0.02em]">Orbix Declare</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em]">Entrar no Orbix Declare</h1>
            <p className="m-0 text-[15px] leading-relaxed text-muted">Use sua carteira Solana como login. Sem senha, sem cadastro.</p>
          </div>

          {/* Um botão por carteira detectada (Wallet Standard) */}
          <div className="flex flex-col gap-2.5">
            {!detected ? (
              <Button size="lg" loading disabled className="w-full">
                Procurando carteiras…
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
                        {PHASE_LABEL[phase]}
                      </>
                    ) : (
                      <>Continuar com {w.adapter.name}</>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <InlineError>{error}</InlineError>

          {config.useMocks && (
            <>
              <div className="flex items-center gap-3" role="separator" aria-label="ou">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">ou</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="m-0 text-xs text-muted">Avaliando o projeto? Explore com dados de exemplo, sem conectar nada.</p>
                <Button variant="secondary" size="lg" className="w-full" loading={demoBusy} disabled={busy} onClick={enterDemo}>
                  Entrar no modo demonstração
                </Button>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-5 text-[13px] leading-[1.55] text-muted">
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-ink/80">
              <span className="inline-flex items-center gap-1.5">
                <EyeIcon size={14} className="text-accent-text" aria-hidden />
                Somente leitura
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyIcon size={14} className="text-accent-text" aria-hidden />
                Sem chave privada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SignatureIcon size={14} className="text-accent-text" aria-hidden />
                Só uma assinatura
              </span>
            </div>
            <p className="m-0 text-pretty">
              Vamos pedir só a assinatura de uma mensagem para confirmar que a carteira é sua. Nenhuma transação é enviada e nenhum fundo pode ser
              movido.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Estado "sem extensão": card discreto com ícone pequeno e as ações ao lado. */
function NoWalletCard() {
  return (
    <div role="status" className="flex gap-3.5 rounded-xl border border-line bg-panel p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-card text-accent-text">
        <PuzzlePieceIcon size={18} aria-hidden />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="m-0 text-sm font-medium">Nenhuma carteira Solana neste navegador</p>
        <p className="m-0 text-[13px] leading-normal text-muted">Instale a Phantom ou a Solflare e recarregue a página para entrar.</p>
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
            Recarregar
          </button>
        </div>
      </div>
    </div>
  );
}
