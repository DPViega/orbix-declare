import { clusterApiUrl, Connection } from "@solana/web3.js";
import type { SolanaCluster } from "./config";

type TxLike = { meta: { err: unknown; logMessages?: string[] | null } | null; transaction: { message: { instructions: unknown[] } } } | null;

export type ChainCheck = "ok" | "mismatch" | "notFound";

/**
 * "notFound" when the RPC has no transaction (not confirmed yet, wrong network, empty answer):
 * that is a warning, never a tampering alert. "mismatch" only when the transaction exists
 * but failed or its Memo (instruction or log) lacks the hash.
 */
export function txHasHash(tx: TxLike, hash: string): ChainCheck {
  if (!tx || !tx.meta) return "notFound";
  if (tx.meta.err) return "mismatch";
  const text = (JSON.stringify(tx.transaction.message.instructions) + (tx.meta.logMessages ?? []).join("\n")).toLowerCase();
  return text.includes(hash.toLowerCase()) ? "ok" : "mismatch";
}

/** Reads the transaction straight from the public RPC, without going through our API. */
export async function checkHashOnChain(signature: string, hash: string, cluster: SolanaCluster): Promise<ChainCheck> {
  const tx = await new Connection(clusterApiUrl(cluster), "confirmed").getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  return txHasHash(tx as TxLike, hash);
}
