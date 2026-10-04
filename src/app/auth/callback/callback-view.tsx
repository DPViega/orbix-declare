"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { postLoginRedirect, safeNext } from "@/lib/auth-redirect";
import { Button, LogoMark, StateBlock } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

/**
 * Volta do Google/GitHub (ou do atalho de demonstração em mock.ts). O back-end redireciona
 * para cá com `#code=…&next=…` ou `#error=…`; os dados ficam no fragmento de propósito
 * (não vão a nenhum servidor nem aparecem em log). POST /api/auth/exchange troca o código
 * de uso único pela sessão de verdade.
 */
export function CallbackView() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSession();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const next = hash.get("next");
    const errorCode = hash.get("error");
    const code = hash.get("code");
    // Limpa o fragmento da barra de endereço assim que ele é lido.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    if (errorCode) {
      router.replace(`/login?${new URLSearchParams({ next: next ? safeNext(next) : "/painel", error: errorCode })}`);
      return;
    }
    if (!code) {
      // Adiado pro microtask: setState síncrono dentro do corpo do efeito não é permitido.
      queueMicrotask(() => setError(t.authCallback.failedTitle));
      return;
    }
    api
      .exchange(code)
      .then((session) => {
        signIn(session);
        router.replace(postLoginRedirect(session.user, next));
      })
      .catch((err) => setError(errorMessage(err)));
    // Roda uma única vez, na montagem: o código só pode ser trocado uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg px-6 text-ink">
        <StateBlock
          icon={WarningIcon}
          tone="danger"
          title={t.authCallback.failedTitle}
          actions={
            <Button onClick={() => router.replace(`/login?${new URLSearchParams(params.toString())}`)}>
              {t.authCallback.backToLogin}
            </Button>
          }
        >
          {error}
        </StateBlock>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg text-ink" aria-busy="true">
      <LogoMark size={36} className="animate-pulse" />
      <p className="m-0 text-sm text-muted">{t.authCallback.connecting}</p>
    </main>
  );
}
