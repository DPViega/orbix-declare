import { AppShell } from "@/components/app-shell";

/** Área logada: sidebar + guarda de sessão (redireciona para /login sem sessão). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
