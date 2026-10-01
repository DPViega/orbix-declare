import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "Orbix Declare", template: "%s · Orbix Declare" },
  description:
    "Seus impostos cripto, calculados em reais. Um agente de IA lê suas carteiras Solana e Hyperliquid, converte cada evento pela PTAX e prepara a DeCripto do mês.",
  applicationName: "Orbix Declare",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5FF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0A18" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${outfit.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
