import type { Metadata } from "next";
import { Suspense } from "react";
import { getMessages } from "@/lib/i18n/server";

// A página é client component e não exporta metadata; sem isto a aba ficava com o título da
// página anterior (ex.: "Entrar · Orbix Declare" depois do login, no celular).
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.agent };
}

// Suspense: a página lê ?q= (pergunta vinda do mapa interativo do painel) com useSearchParams.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
