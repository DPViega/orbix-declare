"use client";

import { FlaskIcon } from "@phosphor-icons/react";
import { isDemoSession } from "@/lib/api";
import { config } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/components/ui";

/**
 * Aviso de dados simulados. Aparece no modo demonstração (sem NEXT_PUBLIC_API_URL) e também
 * para quem entrou pelo botão "Entrar no modo demonstração" com a API real configurada.
 */
export function DemoNotice({ text, className }: { text?: string; className?: string }) {
  const { t } = useI18n();
  if (!config.useMocks && !isDemoSession()) return null;
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-dashed border-warn bg-warn-bg px-5 py-3.5 text-sm text-ink",
        className,
      )}
    >
      <FlaskIcon size={20} className="mt-px shrink-0 text-warn" aria-hidden />
      <p className="m-0 leading-normal">
        <strong className="font-semibold">{t.demo.title}</strong> {text ?? t.demo.text}
      </p>
    </div>
  );
}
