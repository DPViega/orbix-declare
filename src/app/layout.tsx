import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { intlLocale } from "@/lib/i18n/locale";
import { getMessages, getRequestLocale } from "@/lib/i18n/server";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
});
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: { default: "Orbix Declare", template: "%s · Orbix Declare" },
    description: t.meta.description,
    applicationName: "Orbix Declare",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5FF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0A18" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Idioma: cookie "orbix.locale" ou Accept-Language (lib/i18n). Lido aqui para a página já vir traduzida.
  const locale = await getRequestLocale();
  return (
    <html lang={intlLocale(locale)} suppressHydrationWarning className={`${outfit.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <head>
        {/*
          Esconde a abertura antes da hidratação quando ela já foi vista nesta aba ou quando o sistema
          pede redução de movimento, para não piscar (ver components/splash-screen.tsx).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(sessionStorage.getItem("orbix.splash")==="seen"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.splash="seen"}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
