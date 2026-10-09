import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n/server";

// A página é client component e não exporta metadata; sem isto a aba ficava com o título da
// página anterior (ex.: "Entrar · Orbix Declare" depois do login, no celular).
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.settings };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
