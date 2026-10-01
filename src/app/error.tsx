"use client";

import { useEffect } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { Button, StateBlock } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-5 text-ink">
      <StateBlock
        icon={WarningIcon}
        tone="danger"
        title="Algo deu errado nesta tela"
        className="w-full max-w-[520px]"
        actions={<Button onClick={reset}>Tentar de novo</Button>}
      >
        Seus dados não foram alterados. Tente de novo; se o erro continuar, recarregue a página.
        {error.digest && <span className="mt-2 block font-mono text-xs text-faint">Código: {error.digest}</span>}
      </StateBlock>
    </div>
  );
}
