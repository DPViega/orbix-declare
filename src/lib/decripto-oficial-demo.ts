import type { TaxEvent } from "@/lib/api/types";

/**
 * Espelho em TS, só para o modo demonstração, do leiaute oficial da DeCripto (Seção 6, registro
 * 0210) que `orbix-core/src/orbix/reports/decripto_oficial.py` gera de verdade no back-end.
 *
 * Existe porque, sem back-end conectado (demo pública, sem `NEXT_PUBLIC_API_URL`), o botão
 * "Baixar DeCripto oficial" não tinha de onde buscar o arquivo e ficava sem efeito — a cara
 * cartão do produto parecia quebrada pra quem só via a demo. Mantém os mesmos campos, na mesma
 * ordem, com a mesma formatação (pipe, CRLF, DDMMAAAA, vírgula decimal): qualquer mudança no
 * leiaute real tem que ser replicada aqui também, ou as duas saídas divergem.
 */

const CRLF = "\r\n";

function alfanumerico(value: string | null | undefined, maxLen: number): string {
  if (!value) return "";
  return Array.from(value)
    .filter((ch) => ch !== "|" && ch.charCodeAt(0) >= 32)
    .join("")
    .slice(0, maxLen);
}

function numerico(value: number | null | undefined, casas: number): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(casas).replace(".", ",");
}

function dataDDMMAAAA(iso: string): string {
  // Fuso de Brasília: o mesmo dia que a tela mostra, igual ao resto do app.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.day}${parts.month}${parts.year}`;
}

/** Só vira registro 0210 a permuta com um único ativo de cada lado e protocolo conhecido. */
function elegivel0210(e: TaxEvent): boolean {
  return e.type === "swap" && e.network === "solana" && e.quantityIn != null && !!e.quantityInAsset && !!e.protocol;
}

function registro0210(e: TaxEvent): string {
  const fields = [
    "0210",
    dataDDMMAAAA(e.date),
    "II", // OperacaoCodigo: permuta entre criptoativos declaráveis
    numerico(e.valueBrl, 2),
    numerico(e.feesBrl ?? 0, 2),
    alfanumerico(e.quantityInAsset, 10),
    numerico(e.quantityIn, 10),
    alfanumerico(e.quantityAsset, 10),
    numerico(e.quantity, 10),
    "", // AvaliacaoAlternativaValor
    "8", // PermutanteTipoNI: Plataforma Descentralizada
    "BR", // PermutantePais
    "", // PermutanteCPFCNPJ
    "", // PermutanteNI
    "", // PermutanteNome
    alfanumerico(e.protocol, 80), // PermutantePlataforma
  ];
  return fields.join("|");
}

export function buildDecriptoOficialDemo(events: TaxEvent[]): { content: string; includedCount: number; excludedCount: number } {
  const swaps = events.filter((e) => e.type === "swap" && e.network === "solana");
  const included = swaps.filter(elegivel0210);
  const excluded = swaps.length - included.length;
  const lines = included.map(registro0210);
  return { content: lines.length ? lines.join(CRLF) + CRLF : "", includedCount: included.length, excludedCount: excluded };
}
