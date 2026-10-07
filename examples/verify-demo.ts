/**
 * Confere os exemplos desta pasta contra o modo demonstração (src/lib/api/mock.ts).
 * Uso: npx tsx examples/verify-demo.ts
 * Sai com código 1 se algum valor esperado não bater.
 */
import { readFileSync } from "node:fs";
import { mockApi } from "../src/lib/api/mock";

type Json = Record<string, unknown>;
const load = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")) as Json;

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (esperado ${JSON.stringify(expected)})`}`);
}

async function main() {
  const month = "2026-09";
  const events = await mockApi.events(month);
  const report = await mockApi.report(month);
  const ev = (id: string) => events.find((e) => e.id === id)!;
  const row = (id: string) => report.rows.find((r) => r.id === id);

  // 01 · swap com stablecoin
  const ex1 = load("./01-swap-stablecoin.json").expected as Json;
  const e1 = ev("ev_2026-09_0");
  check("01 preço unitário", e1.unitPriceBrl, ex1.unitPriceBrl);
  check("01 valor", e1.valueBrl, ex1.valueBrl);
  check("01 custo", e1.costBrl, ex1.costBrl);
  check("01 ganho", e1.gainBrl, ex1.gainBrl);
  check("01 taxas", e1.feesBrl, ex1.feesBrl);
  check("01 custo desconhecido", row(e1.id)?.costUnknown, ex1.costUnknown);

  // 02 · perp + funding
  const ex2 = load("./02-perp-funding.json").expected as Record<string, Json>;
  for (const [key, id] of [
    ["perp", "ev_2026-09_1"],
    ["funding", "ev_2026-09_2"],
  ] as const) {
    const e = ev(id);
    for (const f of ["unitPriceBrl", "valueBrl", "costBrl", "gainBrl", "feesBrl"] as const) check(`02 ${key} ${f}`, e[f], ex2[key][f]);
  }

  // 03 · custo informado: antes e depois da revisão
  const ex3 = load("./03-custo-informado.json") as { input: { review: Json }; expected: { before: Json; after: Json } };
  const id3 = "ev_2026-09_3";
  check("03 antes: custo", ev(id3).costBrl, ex3.expected.before.costBrl);
  check("03 antes: ganho", ev(id3).gainBrl, ex3.expected.before.gainBrl);
  check("03 antes: custo desconhecido", row(id3)?.costUnknown, ex3.expected.before.costUnknown);
  const review = ex3.input.review as { costBrl: number; reason: string; evidence: string };
  const after = await mockApi.reviewAcquisitionCost(id3, { ...review, confirmed: true });
  const reportAfter = await mockApi.report(month);
  check("03 depois: custo", after.costBrl, ex3.expected.after.costBrl);
  check("03 depois: ganho", after.gainBrl, ex3.expected.after.gainBrl);
  check("03 depois: custo informado", reportAfter.rows.find((r) => r.id === id3)?.costManual, ex3.expected.after.costManual);
  check("03 depois: pendências", after.pendingReasons, ex3.expected.after.pendingReasons);
  const h = after.reviewHistory?.at(-1);
  check(
    "03 depois: histórico",
    h && { kind: h.kind, previousCostBrl: h.previousCostBrl, newCostBrl: h.newCostBrl },
    (ex3.expected.after.reviewHistory as Json[])[0],
  );

  console.log(failures ? `\n${failures} divergência(s).` : "\nTodos os exemplos batem com o modo demonstração.");
  process.exit(failures ? 1 : 0);
}

void main();
