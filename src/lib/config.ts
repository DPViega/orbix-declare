/**
 * Configuração pública do front-end.
 *
 * Tudo aqui vem de variáveis NEXT_PUBLIC_* e, portanto, vai para o navegador.
 * NUNCA coloque segredos (HELIUS_API_KEY, ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * chaves do R2 etc.) em variáveis NEXT_PUBLIC_. Esses segredos vivem só no back-end.
 */

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

const cluster = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "mainnet-beta") as SolanaCluster;

export const config = {
  /** URL base da API do back-end, sem barra no final. Ex.: https://api.orbixdeclare.com */
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
  /**
   * Modo demonstração: todas as chamadas são respondidas por src/lib/api/mock.ts.
   * Liga automaticamente quando NEXT_PUBLIC_API_URL está vazio.
   */
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS === "true" || rawApiUrl === "",
  solanaCluster: cluster,
  /** URL pública do app (link de verificação). Vazia = usa o domínio da própria página. */
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, ""),
} as const;

export function explorerTxUrl(signature: string): string {
  const suffix = config.solanaCluster === "mainnet-beta" ? "" : `?cluster=${config.solanaCluster}`;
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

export function publicVerifyUrl(publicId: string): string {
  const origin = config.appUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/v/${publicId}`;
}
