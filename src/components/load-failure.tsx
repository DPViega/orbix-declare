"use client";

import { ArrowsClockwiseIcon, SignOutIcon, WarningIcon } from "@phosphor-icons/react";
import { useSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { Button, StateBlock } from "@/components/ui";

/**
 * Falha ao carregar uma tela sem nenhum dado para mostrar (ex.: API fora do ar).
 * Sempre oferece uma saída: tentar de novo, a ação extra da tela (ex.: voltar) e sair da conta.
 */
export function LoadFailure({
  title,
  error,
  onRetry,
  extraAction,
}: {
  title: string;
  error: string;
  onRetry?: () => void;
  extraAction?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { signOut } = useSession();
  return (
    <StateBlock
      icon={WarningIcon}
      tone="danger"
      title={title}
      actions={
        <>
          {onRetry && (
            <Button icon={ArrowsClockwiseIcon} onClick={onRetry}>
              {t.common.retry}
            </Button>
          )}
          {extraAction}
          <Button variant="secondary" icon={SignOutIcon} onClick={() => void signOut()}>
            {t.nav.signOut}
          </Button>
        </>
      }
    >
      <p className="m-0">{error}</p>
      <p className="m-0 mt-2">{t.common.loadFailedHint}</p>
    </StateBlock>
  );
}

/** Erro ao atualizar dados que já estão na tela: avisa sem esconder o que foi carregado. */
export function StaleDataError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-bg px-4 py-2.5 text-[13px] leading-normal text-danger"
    >
      <span>{t.common.staleData(error)}</span>
      <Button size="sm" variant="secondary" icon={ArrowsClockwiseIcon} onClick={onRetry}>
        {t.common.retry}
      </Button>
    </div>
  );
}
