import { afterEach, describe, expect, it } from "vitest";
import { setCurrentLocale } from "@/lib/i18n/locale";
import {
  formatBRL,
  formatBRLShort,
  formatDate,
  formatDayMonth,
  formatMoney,
  formatPct,
  formatQty,
  formatQtyFull,
  formatUnitPriceBRL,
  identityLabel,
  isPseudoHash,
  monthLabel,
  monthLong,
  monthName,
  monthSlash,
  parseBRLInput,
  parseMonthKey,
  previousMonthKey,
  shortAddress,
} from "@/lib/format";

afterEach(() => setCurrentLocale("en"));

describe("formatBRL", () => {
  it("formata em português com vírgula decimal e sem NBSP", () => {
    setCurrentLocale("pt");
    expect(formatBRL(28940.13)).toBe("R$ 28.940,13");
  });

  it("formata em inglês sem espaço entre o símbolo e o valor", () => {
    setCurrentLocale("en");
    expect(formatBRL(28940.13)).toBe("R$28,940.13");
  });

  it("não deixa nenhum NBSP escapar nos dois idiomas", () => {
    for (const locale of ["pt", "en"] as const) {
      setCurrentLocale(locale);
      expect(formatBRL(1234.5)).not.toMatch(/ /);
    }
  });
});

describe("formatUnitPriceBRL", () => {
  it("usa o formato padrão quando o valor é 0 ou >= 1", () => {
    setCurrentLocale("pt");
    expect(formatUnitPriceBRL(0)).toBe(formatBRL(0));
    expect(formatUnitPriceBRL(910)).toBe(formatBRL(910));
  });

  it("não deixa um token barato virar R$ 0,00", () => {
    setCurrentLocale("pt");
    const out = formatUnitPriceBRL(0.0000107);
    expect(out).not.toBe("R$ 0,00");
    expect(out).toContain("0,00001070");
  });
});

describe("formatBRLShort", () => {
  it("corta os centavos só quando o valor é inteiro", () => {
    setCurrentLocale("pt");
    expect(formatBRLShort(35000)).toBe("R$ 35.000");
    expect(formatBRLShort(35000.5)).toBe("R$ 35.000,50");
  });
});

describe("formatQty", () => {
  it("mostra zero como 0, sem casas decimais", () => {
    expect(formatQty(0)).toBe("0");
  });

  it("mantém dígitos significativos para quantidades menores que 1", () => {
    setCurrentLocale("pt");
    expect(formatQty(0.000123)).toBe("0,000123");
  });

  it("usa 2 a 4 casas para quantidades >= 1", () => {
    setCurrentLocale("pt");
    expect(formatQty(12.5)).toBe("12,50");
  });
});

describe("formatQtyFull e formatMoney e formatPct", () => {
  it("formatQtyFull não arredonda a quantidade completa", () => {
    setCurrentLocale("en");
    expect(formatQtyFull(0.123456789012345)).toBe("0.123456789012345");
  });

  it("formatMoney sempre mostra 2 casas", () => {
    setCurrentLocale("pt");
    expect(formatMoney(28940)).toBe("28.940,00");
  });

  it("formatPct prefixa o sinal de mais nos valores positivos", () => {
    setCurrentLocale("en");
    expect(formatPct(12.4)).toBe("+12.4%");
    expect(formatPct(-3)).toBe("-3.0%");
  });
});

describe("datas", () => {
  // meio-dia UTC: nunca vira o dia anterior/seguinte ao converter para America/Sao_Paulo (UTC-3)
  const noon = "2026-09-30T12:00:00Z";

  it("formatDate: dd/mm/aaaa em português, mês abreviado em inglês", () => {
    setCurrentLocale("pt");
    expect(formatDate(noon)).toBe("30/09/2026");
    setCurrentLocale("en");
    expect(formatDate(noon)).toBe("Sep 30, 2026");
  });

  it("formatDayMonth: sem o ano", () => {
    setCurrentLocale("pt");
    expect(formatDayMonth(noon)).toBe("30/09");
  });
});

describe("meses (chave AAAA-MM)", () => {
  it("parseMonthKey rejeita formato e mês inválidos", () => {
    expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("lixo")).toBeNull();
  });

  it("monthLabel, monthLong, monthSlash e monthName nos dois idiomas", () => {
    setCurrentLocale("pt");
    expect(monthLabel("2026-09")).toBe("Setembro 2026");
    expect(monthLong("2026-09")).toBe("setembro de 2026");
    expect(monthSlash("2026-03")).toBe("março/2026");
    expect(monthName("2026-08")).toBe("agosto");

    setCurrentLocale("en");
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLong("2026-09")).toBe("September 2026");
    expect(monthSlash("2026-03")).toBe("Mar/2026");
  });

  it("monthLabel devolve a própria chave quando ela é inválida", () => {
    expect(monthLabel("não-é-mês")).toBe("não-é-mês");
  });

  it("previousMonthKey cruza o fim do ano corretamente", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
    expect(previousMonthKey("2026-09")).toBe("2026-08");
  });
});

describe("shortAddress", () => {
  it("encurta mantendo início e fim", () => {
    expect(shortAddress("7xKp9mQ2vR4tLw8NcZ1bYd6HsJe5fGu3Hd83fQa")).toBe("7xKp…3fQa");
  });

  it("endereço EVM mantém o prefixo 0x visível", () => {
    expect(shortAddress("0x4f2A9c1E00000000000000000000000000000000")).toBe("0x4f2A…0000");
  });

  it("endereço curto não é cortado, e vazio/nulo vira string vazia", () => {
    expect(shortAddress("abc123")).toBe("abc123");
    expect(shortAddress(null)).toBe("");
    expect(shortAddress(undefined)).toBe("");
  });
});

describe("identityLabel", () => {
  it("prioriza nome, depois e-mail, depois endereço, depois travessão", () => {
    const base = { address: null, email: null, displayName: null };
    expect(identityLabel({ ...base, displayName: "Erik" })).toBe("Erik");
    expect(identityLabel({ ...base, email: "erik@orbixlab.com.br" })).toBe("erik@orbixlab.com.br");
    expect(identityLabel({ ...base, address: "7xKp9mQ2vR4tLw8NcZ1bYd6HsJe5fGu3Hd83fQa" })).toBe("7xKp…3fQa");
    expect(identityLabel(base)).toBe("—");
  });
});

describe("parseBRLInput", () => {
  it("lê o formato brasileiro (vírgula decimal, ponto de milhar)", () => {
    setCurrentLocale("pt");
    expect(parseBRLInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRLInput("3,08")).toBe(3.08);
  });

  it("lê o formato americano (ponto decimal, vírgula de milhar)", () => {
    setCurrentLocale("en");
    expect(parseBRLInput("R$1,234.56")).toBe(1234.56);
    expect(parseBRLInput("3.08")).toBe(3.08);
  });

  it("rejeita vazio, negativo e lixo", () => {
    setCurrentLocale("pt");
    expect(parseBRLInput("")).toBeNull();
    expect(parseBRLInput("-5")).toBeNull();
    expect(parseBRLInput("abc")).toBeNull();
  });

  it("é o inverso de formatMoney: parseBRLInput(formatMoney(x)) === x", () => {
    for (const locale of ["pt", "en"] as const) {
      setCurrentLocale(locale);
      for (const value of [0, 3.08, 1234.56, 35000]) {
        expect(parseBRLInput(formatMoney(value))).toBe(value);
      }
    }
  });
});

describe("isPseudoHash", () => {
  it("identificador interno da Hyperliquid (sem hash real) é pseudo", () => {
    expect(isPseudoHash("hl:@53:1234")).toBe(true);
  });

  it("hash real da Solana ou EVM não é pseudo", () => {
    expect(isPseudoHash("4Zq8nV2xB5mT2k")).toBe(false);
    expect(isPseudoHash("0x9a3fE41c")).toBe(false);
  });

  it("nulo/vazio é tratado como pseudo (não há link para mostrar)", () => {
    expect(isPseudoHash(null)).toBe(true);
    expect(isPseudoHash(undefined)).toBe(true);
    expect(isPseudoHash("")).toBe(true);
  });
});
