import { describe, expect, it } from "vitest";
import { txHasHash } from "./onchain-verify";

const hash = "ab".repeat(32);
const tx = (memo: string, err: unknown = null) => ({
  meta: { err, logMessages: [] },
  transaction: { message: { instructions: [{ program: "spl-memo", parsed: memo }] } },
});

describe("txHasHash", () => {
  it("finds the hash in the memo, ignoring case", () => expect(txHasHash(tx(`orbix:${hash.toUpperCase()}`), hash)).toBe(true));
  it("rejects a memo with another hash", () => expect(txHasHash(tx("orbix:" + "cd".repeat(32)), hash)).toBe(false));
  it("rejects a failed transaction", () => expect(txHasHash(tx(hash, { InstructionError: [] }), hash)).toBe(false));
  it("rejects a missing transaction", () => expect(txHasHash(null, hash)).toBe(false));
});
