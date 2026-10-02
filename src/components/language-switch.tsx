"use client";

import { TranslateIcon } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/locale";
import { cn } from "@/components/ui";

/**
 * Seletor de idioma PT | EN. `tone="brand"` para fundos sempre escuros (sidebar);
 * o padrão segue os tokens do tema. `size="lg"` mostra os nomes completos (Configurações).
 */
export function LanguageSwitch({
  tone = "theme",
  size = "sm",
  className,
}: {
  tone?: "theme" | "brand";
  size?: "sm" | "lg";
  className?: string;
}) {
  const { locale, setLocale, t } = useI18n();
  const brand = tone === "brand";

  return (
    <div
      role="radiogroup"
      aria-label={t.language.label}
      className={cn(
        "flex w-fit items-center gap-1 rounded-xl border p-[3px]",
        brand ? "border-brand-line bg-brand-surface" : "border-line bg-panel",
        className,
      )}
    >
      {size === "sm" && <TranslateIcon size={14} aria-hidden className={cn("mx-1.5", brand ? "text-brand-dim" : "text-faint")} />}
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l === "en" ? "en" : "pt-BR"}
            title={t.language[l]}
            onClick={() => !active && setLocale(l)}
            className={cn(
              "cursor-pointer rounded-[9px] transition-colors",
              size === "sm" ? "px-2.5 py-1 font-mono text-[11px] tracking-[0.06em] uppercase" : "px-3.5 py-2 text-[13px]",
              active
                ? brand
                  ? "bg-brand-deep font-medium text-brand-paper"
                  : "bg-chip font-medium text-chip-text"
                : brand
                  ? "text-brand-dim hover:text-brand-paper"
                  : "text-muted hover:text-ink",
            )}
          >
            {size === "sm" ? l : t.language[l]}
          </button>
        );
      })}
    </div>
  );
}
