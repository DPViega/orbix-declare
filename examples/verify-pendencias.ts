/** Regressões F8/F9/D1/D2: npx tsx examples/verify-pendencias.ts */
import assert from "node:assert/strict";
import { mockApi } from "../src/lib/api/mock";
import { eventCost, eventMonth } from "../src/lib/event-cost";
import { config, explorerTxUrl } from "../src/lib/config";
import { reportToCsv, sha256Hex } from "../src/lib/report-file";
import { buildReviewPackage } from "../src/lib/review-package";
import { setCurrentLocale } from "../src/lib/i18n/locale";
import { pt } from "../src/lib/i18n/messages/pt";
import { en } from "../src/lib/i18n/messages/en";

async function main() {
  const events = await mockApi.events("2026-09");
  const report = await mockApi.report("2026-09");
  const unknown = events.find((e) => report.rows.find((r) => r.id === e.id)?.costUnknown)!;
  const row = report.rows.find((r) => r.id === unknown.id)!;
  assert.equal(unknown.costBrl, 0);
  assert.equal(eventCost(unknown, row).costUnknown, true);
  assert.equal(eventCost({ ...unknown, costUnknown: false }, row).costUnknown, false);
  assert.equal(eventCost({ ...unknown, type: "transfer", costBrl: null }, row).costUnknown, false);
  assert.equal(eventCost({ ...unknown, costManual: true }, row).costManual, true);
  assert.equal(eventMonth("2026-06-01T02:59:59Z"), "2026-05");
  const official = reportToCsv(report);
  const lines = official.trimEnd().split("\n");
  assert.ok(lines.every((l) => l.split(",").length === 13));
  assert.equal(lines.at(-2)!.split(",")[9], "");
  assert.equal(lines[1].split(",")[12], `${events.find((e) => e.id === report.rows[0].id)!.wallet!.address.slice(0, 4)}…${events.find((e) => e.id === report.rows[0].id)!.wallet!.address.slice(-4)}`);
  assert.equal(await sha256Hex(official), report.attestation!.hash);
  assert.notEqual(await sha256Hex(official + "x"), report.attestation!.hash);
  assert.equal(new URL(explorerTxUrl("fixture", "devnet")).searchParams.get("cluster"), "devnet");
  assert.ok(config.attestationCluster);
  for (const [locale, m] of [["pt", pt.reviewPackage], ["en", en.reviewPackage]] as const) {
    setCurrentLocale(locale);
    for (const quantity of [39482.24168, 10362.03]) {
      const event = { ...events[0], quantity, quantityIn: quantity, positionBeforeQty: quantity };
      const sample = { ...report, rows: [{ ...report.rows[0], id: event.id, quantity }] };
      const csv = buildReviewPackage(sample, [event], m, { monthLabel: "fixture", formatBRL: String, formatDate: String, formatDateTime: String }).csv.text;
      const fields = csv.trimEnd().split("\n")[1].split(locale === "pt" ? ";" : ",");
      assert.equal(fields.length, 26);
      for (const index of [5, 21, 23]) assert.equal(fields[index], locale === "pt" ? String(quantity).replace(".", ",") : String(quantity));
    }
  }
  console.log("F8/F9/D1/D2: indicadores, fuso, quantidades PT/EN, 13/26 colunas, carteira, total e hash OK.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
