import Link from "next/link";
import { Brand } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-10 text-ink sm:px-12">
      <Brand />
      <div className="page-enter m-auto flex max-w-[480px] flex-col gap-4">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Erro 404</span>
        <h1 className="m-0 font-display text-4xl font-semibold tracking-[-0.02em]">Página não encontrada</h1>
        <p className="m-0 text-[15px] leading-relaxed text-muted">O endereço pode ter mudado ou estar incompleto.</p>
        <Link
          href="/painel"
          className="inline-flex h-11 items-center self-start rounded-xl bg-accent px-5 text-[15px] font-medium text-on-accent no-underline hover:bg-accent-hover"
        >
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}
