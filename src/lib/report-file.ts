import type { ReportDetail } from "@/lib/api/types";

/**
 * Geração de CSV e hash SHA-256 no navegador.
 *
 * O hash é calculado sobre os BYTES do arquivo. O back-end deve usar exatamente o mesmo
 * algoritmo (SHA-256, hex minúsculo) sobre o mesmo arquivo para que a verificação pública
 * (/v/[id]) funcione. No modo demonstração o CSV é gerado aqui; com back-end real, o CSV
 * oficial vem do back-end (GET /api/report/:mes/csv) e o front só confere o hash na página /v/[id].
 */

const CSV_HEADER = ["data", "tipo", "ativo", "quantidade", "ptax", "valor_brl", "custo_brl", "ganho_brl", "preco_manual"];

const num = (v: number, digits = 2) => v.toFixed(digits);
/** AAAA-MM-DD no fuso de Brasília (o mesmo dia que a tela mostra). */
const isoDateBR = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function reportToCsv(report: ReportDetail): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of report.rows) {
    lines.push(
      [
        isoDateBR(r.date),
        r.type,
        cell(r.asset),
        num(r.quantity, 8),
        num(r.ptax, 4),
        num(r.valueBrl),
        num(r.costBrl),
        num(r.gainBrl),
        r.manualPrice ? "sim" : "nao",
      ].join(","),
    );
  }
  lines.push(
    ["total", "", "", "", "", num(report.totals.disposedBrl), num(report.totals.costBrl), num(report.totals.gainBrl), ""].join(
      ",",
    ),
  );
  return lines.join("\n") + "\n";
}

export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Dispara o download de um texto como arquivo, sem sair da página. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
