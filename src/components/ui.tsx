"use client";

/**
 * Componentes base do Orbix Declare. Medidas, raios e tipografia seguem os mockups em docs/:
 * botões de 44px (52px no login), raio de 12px, rótulos em JetBrains Mono maiúsculo,
 * títulos em Outfit e corpo em DM Sans.
 */
import Image from "next/image";
import Link from "next/link";
import { forwardRef } from "react";
import { CircleNotchIcon, type Icon } from "@phosphor-icons/react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Botões ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover font-medium",
  secondary: "bg-transparent text-ink border border-line2 hover:bg-card/60 hover:border-soft/50",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-card/50",
  danger: "bg-danger text-on-danger hover:brightness-110 font-medium",
  link: "bg-transparent text-accent-text hover:underline font-medium px-0! h-auto!",
};

const sizeClass: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-13 px-6 text-base gap-2.5",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: Icon;
  iconRight?: Icon;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: IconL, iconRight: IconR, loading, className, children, disabled, ...rest },
  ref,
) {
  const iconSize = size === "lg" ? 20 : size === "sm" ? 14 : 18;
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl whitespace-nowrap transition-[background-color,border-color,color,filter] duration-150 select-none",
        "disabled:cursor-not-allowed disabled:opacity-55",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <CircleNotchIcon size={iconSize} className="animate-spin-slow" aria-hidden />
      ) : (
        IconL && <IconL size={iconSize} aria-hidden />
      )}
      {children}
      {IconR && !loading && <IconR size={size === "sm" ? 14 : 16} aria-hidden />}
    </button>
  );
});

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: Icon;
  iconRight?: Icon;
}

export function ButtonLink({ variant = "primary", size = "md", icon: IconL, iconRight: IconR, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl whitespace-nowrap no-underline transition-colors duration-150",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {IconL && <IconL size={size === "sm" ? 14 : 18} aria-hidden />}
      {children}
      {IconR && <IconR size={size === "sm" ? 14 : 16} aria-hidden />}
    </Link>
  );
}

export function IconButton({
  icon: I,
  label,
  className,
  spinning,
  ...rest
}: { icon: Icon; label: string; spinning?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line2 bg-transparent text-muted transition-colors hover:border-soft/60 hover:text-ink disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...rest}
    >
      <I size={16} className={spinning ? "animate-spin-slow" : undefined} aria-hidden />
    </button>
  );
}

/* ---------------- Tipografia ---------------- */

export function Kicker({ children, className, as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "span" | "h2" | "h3" }) {
  return <Tag className={cn("font-mono text-[11px] tracking-[0.08em] text-muted uppercase", className)}>{children}</Tag>;
}

export function PageHeader({
  kicker,
  title,
  actions,
  badge,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {kicker && <Kicker>{kicker}</Kicker>}
        <div className="flex flex-wrap items-center gap-3.5">
          <h1 className="type-h1 text-balance">{title}</h1>
          {badge}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

/* ---------------- Superfícies ---------------- */

/** Bloco lilás (var(--card)), sem borda — KPIs, destaques, dicas. */
export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl bg-card", className)} {...rest} />;
}

/** Painel com borda (var(--panel)) — tabelas, formulários, listas. */
export function Panel({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-panel", className)} {...rest} />;
}

/* ---------------- Selos e chips ---------------- */

type Tone = "ok" | "warn" | "danger" | "accent" | "draft" | "neutral";

const toneClass: Record<Tone, string> = {
  ok: "text-ok bg-ok-bg",
  warn: "text-warn bg-warn-bg",
  danger: "text-danger bg-danger-bg",
  accent: "text-chip-text bg-chip",
  draft: "text-muted border border-dashed border-line2",
  neutral: "text-ink border border-line2",
};

export function Badge({
  tone = "accent",
  icon: I,
  children,
  className,
  spin,
}: {
  tone?: Tone;
  icon?: Icon;
  children: React.ReactNode;
  className?: string;
  spin?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs leading-[1.4] whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      {I && <I size={14} aria-hidden className={spin ? "animate-spin-slow" : undefined} />}
      {children}
    </span>
  );
}

/** Chip de rede/tipo: "Solana", "swap". */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block rounded-lg bg-chip px-2 py-[3px] font-mono text-xs whitespace-nowrap text-chip-text", className)}>
      {children}
    </span>
  );
}

/* ---------------- Formulário ---------------- */

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border bg-bg px-3.5 font-mono text-sm text-ink transition-colors outline-none",
        "focus:border-accent focus-visible:outline-none",
        invalid ? "border-danger" : "border-line2",
        className,
      )}
      {...rest}
    />
  );
});

/* ---------------- Marca ---------------- */

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/orbix-declare-logo.png"
      alt=""
      width={Math.round(size * (931 / 654))}
      height={size}
      className={cn("block h-auto", className)}
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}

export function Brand({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="font-display text-xl font-semibold tracking-[-0.02em]"><span className="text-gold">Orbix</span>{" "}Declare</span>
    </div>
  );
}

/* ---------------- Carregamento e estados ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-track", className)} />;
}

/** Tile de ícone 52×52 dos estados vazios/erro. */
export function StateIcon({ icon: I, tone = "accent", size = 52 }: { icon: Icon; tone?: "accent" | "danger" | "warn" | "ok"; size?: number }) {
  const t = {
    accent: "bg-card text-accent-text",
    danger: "bg-danger-bg text-danger",
    warn: "bg-warn-bg text-warn",
    ok: "bg-ok-bg text-ok",
  }[tone];
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-xl", t)} style={{ width: size, height: size }}>
      <I size={Math.round(size / 2)} aria-hidden />
    </div>
  );
}

export function StateBlock({
  icon,
  tone,
  title,
  children,
  actions,
  className,
}: {
  icon: Icon;
  tone?: "accent" | "danger" | "warn" | "ok";
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[18px] rounded-xl border border-line bg-panel p-7 md:p-9", className)}>
      <StateIcon icon={icon} tone={tone} />
      <h2 className="type-h2 m-0">{title}</h2>
      {children && <div className="max-w-[62ch] text-sm leading-[1.65] text-muted">{children}</div>}
      {actions && <div className="mt-2 flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

/** Mensagem curta de erro inline (formulários, ações). */
export function InlineError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] leading-normal text-danger">
      {children}
    </p>
  );
}

/** Rótulo de linha "chave — valor" usado em painéis laterais. */
export function KeyValue({ label, value, last, valueClassName }: { label: string; value: React.ReactNode; last?: boolean; valueClassName?: string }) {
  return (
    <div className={cn("flex justify-between gap-4 py-2.5 font-mono text-[13px]", !last && "border-b border-line")}>
      <span className="text-muted">{label}</span>
      <span className={cn("text-right", valueClassName)}>{value}</span>
    </div>
  );
}
