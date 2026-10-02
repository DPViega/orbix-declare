import Link from "next/link";
import { Brand } from "@/components/ui";
import { getMessages } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getMessages();
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-10 text-ink sm:px-12">
      <Brand />
      <div className="page-enter m-auto flex max-w-[480px] flex-col gap-4">
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">{t.notFound.kicker}</span>
        <h1 className="type-h1 m-0">{t.notFound.title}</h1>
        <p className="m-0 text-[15px] leading-relaxed text-muted">{t.notFound.text}</p>
        <Link
          href="/painel"
          className="inline-flex h-11 items-center self-start rounded-xl bg-accent px-5 text-[15px] font-medium text-on-accent no-underline hover:bg-accent-hover"
        >
          {t.common.goToDashboard}
        </Link>
      </div>
    </div>
  );
}
