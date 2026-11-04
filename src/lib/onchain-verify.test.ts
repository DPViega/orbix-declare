import { describe, expect, it } from "vitest";
import { txHasHash } from "./onchain-verify";

const hash = "ab".repeat(32);
const tx = (memo: string, err: unknown = null) => ({
  meta: { err, logMessages: [] },
  transaction: { message: { instructions: [{ program: "spl-memo", parsed: memo }] } },
});

describe("txHasHash", () => {
  it("finds the hash in the memo, ignoring case", () => expect(txHasHash(tx(`orbix:${hash.toUpperCase()}`), hash)).toBe("ok"));
  it("rejects a memo with another hash", () => expect(txHasHash(tx("orbix:" + "cd".repeat(32)), hash)).toBe("mismatch"));
  it("rejects a failed transaction", () => expect(txHasHash(tx(hash, { InstructionError: [] }), hash)).toBe("mismatch"));
  it("reports a missing transaction as not found, not as tampering", () => expect(txHasHash(null, hash)).toBe("notFound"));
});
