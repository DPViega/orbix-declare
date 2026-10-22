import type { Metadata } from "next";
import Link from "next/link";
import { Brand, Kicker } from "@/components/ui";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.meta.privacy, description: t.meta.privacyDescription };
}

/**
 * Página pública e estática: descreve o que o sistema lê, guarda e expõe (LGPD art. 18 já
 * citado em Configurações). Sem busca de dado, sem sessão — qualquer pessoa pode ler antes
 * de conectar uma carteira.
 */
export default async function PrivacyPage() {
  const t = (await getMessages()).privacy;

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-10 text-ink sm:px-12">
      <Link href="/" aria-label="Orbix Declare" className="no-underline">
        <Brand />
      </Link>
      <div className="page-enter m-auto flex max-w-[640px] flex-col gap-8 py-14">
        <div className="flex flex-col gap-2">
          <Kicker>{t.kicker}</Kicker>
          <h1 className="type-h1 m-0">{t.title}</h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted">{t.intro}</p>
        </div>
        <div className="flex flex-col gap-7">
          {t.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-1.5">
              <h2 className="type-h2 m-0">{section.heading}</h2>
              <p className="m-0 text-[15px] leading-[1.65] text-pretty text-muted">{section.text}</p>
            </section>
          ))}
        </div>
        <p className="m-0 border-t border-line pt-6 text-[15px] leading-relaxed text-muted">{t.outro}</p>
        <Link
          href="/painel"
          className="inline-flex h-11 w-fit items-center rounded-xl bg-accent px-5 text-[15px] font-medium text-on-accent no-underline hover:bg-accent-hover"
        >
          {t.back}
        </Link>
      </div>
    </div>
  );
}
