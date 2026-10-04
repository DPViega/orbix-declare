import type { User } from "@/lib/api";

/** Só caminhos internos, para não virar open redirect. */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/painel";
}

/**
 * Para onde mandar a pessoa depois de logar, nessa ordem:
 * 1. Sem nenhuma carteira (entrou por e-mail, Google ou GitHub) → /carteiras, para adicionar a primeira.
 * 2. Com carteira mas sem a primeira sincronização concluída → /sincronizacao.
 * 3. Caso contrário → `next` (se for um caminho interno válido) ou /painel.
 */
export function postLoginRedirect(user: User, next: string | null): string {
  if (!user.hasWallets) return "/carteiras";
  if (!user.onboarded) return "/sincronizacao";
  return safeNext(next);
}
