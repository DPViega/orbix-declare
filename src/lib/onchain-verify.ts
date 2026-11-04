import { clusterApiUrl, Connection } from "@solana/web3.js";
import type { SolanaCluster } from "./config";

type TxLike = { meta: { err: unknown; logMessages?: string[] | null } | null; transaction: { message: { instructions: unknown[] } } } | null;

/** True when the transaction succeeded and its Memo (instruction or log) contains the hash. */
export function txHasHash(tx: TxLike, hash: string): boolean {
  if (!tx || !tx.meta || tx.meta.err) return false;
  const text = (JSON.stringify(tx.transaction.message.instructions) + (tx.meta.logMessages ?? []).join("\n")).toLowerCase();
  return text.includes(hash.toLowerCase());
}

/** Reads the transaction straight from the public RPC, without going through our API. */
export async function checkHashOnChain(signature: string, hash: string, cluster: SolanaCluster): Promise<boolean> {
  const tx = await new Connection(clusterApiUrl(cluster), "confirmed").getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
  return txHasHash(tx as TxLike, hash);
}
