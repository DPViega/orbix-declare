"use client";

import { useEffect } from "react";
import { WarningIcon } from "@phosphor-icons/react";
import { Button, StateBlock } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-5 text-ink">
      <StateBlock
        icon={WarningIcon}
        tone="danger"
        title={t.error.title}
        className="w-full max-w-[520px]"
        actions={<Button onClick={reset}>{t.common.retry}</Button>}
      >
        {t.error.text}
        {error.digest && <span className="mt-2 block font-mono text-xs text-faint">{t.error.code(error.digest)}</span>}
      </StateBlock>
    </div>
  );
}
