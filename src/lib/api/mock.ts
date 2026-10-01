/**
 * Back-end simulado (modo demonstração).
 *
 * Responde a todas as funções de src/lib/api/index.ts com os dados dos mockups em docs/,
 * para que o front rode sem nenhum serviço externo. É ativado quando NEXT_PUBLIC_API_URL
 * está vazia ou NEXT_PUBLIC_USE_MOCKS=true. O estado vive em memória (recarregar a página
 * reinicia tudo, exceto a sessão e o progresso da sincronização).
 *
 * Nenhum cálculo fiscal "de verdade" acontece aqui: os números são os do mockup, escalados
 * para os outros meses. O motor fiscal é responsabilidade do back-end.
 */
import { ApiError } from "./client";
import type {
  AddWalletRequest,
  AgentReply,
  AgentRequest,
  Dashboard,
  DownloadLink,
  EventType,
  NonceResponse,
  PublicVerification,
  ReportDetail,
  ReportRow,
  ReportSummary,
  Session,
  SyncStatus,
  TaxEvent,
  User,
  VerifyRequest,
  Wallet,
} from "./types";
import { reportToCsv, sha256Hex } from "@/lib/report-file";
import { explorerTxUrl } from "@/lib/config";
import { monthLabel, monthSlash, previousMonthKey } from "@/lib/format";

const wait = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 220));

/** Data às 12:00 de Brasília (15:00 UTC) para não "virar o dia" em fuso nenhum do BR. */
const day = (y: number, m: number, d: number, h = 15, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min)).toISOString();

const DEMO_ADDRESS = "7xKp9mQ2vR4tLw8NcZ1bYd6HsJe5fGu3Hd83fQa";
const FULL_TX = "5hN2vQpR8cW3mT7yLk4dZs1aFj6uBe9xGt2HnV8qKr3MwY5pC7oDiE4bUz1Xk9P";

/* ---------------- Estado em memória ---------------- */

let user: User = {
  id: "usr_demo",
  address: DEMO_ADDRESS,
  plan: "free",
  agentQuestionsLeft: 20,
  onboarded: false,
};

let wallets: Wallet[] = [
  {
    id: "w_sol_main",
    network: "solana",
    address: DEMO_ADDRESS,
    label: "Principal",
    isLogin: true,
    verifiedAt: day(2026, 9, 2, 13, 10),
    lastSyncAt: day(2026, 9, 30, 17, 32),
    status: "synced",
  },
  {
    id: "w_hl_perps",
    network: "hyperliquid",
    address: "0x4f2A8b1C9d3E7f6A5b2C1d0E9f8A7b6C5d4E9c1E",
    label: "Trading de perps",
    isLogin: false,
    verifiedAt: null,
    lastSyncAt: day(2026, 9, 30, 17, 35),
    status: "synced",
  },
  {
    id: "w_sol_reserve",
    network: "solana",
    address: "9bWeT3kR7pQ1mZ5xN8vC2yH6jL4fD0sA9gU3Lm4T",
    label: "Reserva",
    isLogin: false,
    verifiedAt: null,
    lastSyncAt: day(2026, 9, 28, 12, 10),
    status: "synced",
  },
];

/* ---------------- Dados-base (setembro/2026, idênticos ao mockup) ---------------- */

interface BaseEvent {
  d: number;
  network: TaxEvent["network"];
  type: EventType;
  asset: string;
  qty: number;
  qtyAsset: string;
  brl: number | null;
  hash: string;
  ptax: number;
  cost: number;
}

const BASE: BaseEvent[] = [
  { d: 28, network: "solana", type: "swap", asset: "SOL → USDC", qty: 12.4, qtyAsset: "SOL", brl: 11284.0, hash: "4Zq8nV2xK9pR3sL7wY1cB5mT2k", ptax: 5.4128, cost: 9412.6 },
  { d: 26, network: "hyperliquid", type: "perp", asset: "HYPE-PERP", qty: 150, qtyAsset: "HYPE", brl: 6912.5, hash: "0x9a3f7c2b5e8d1a4f6c3b9e2d7a5f8c1be41c", ptax: 5.4096, cost: 5980.0 },
  { d: 25, network: "hyperliquid", type: "funding", asset: "USDC", qty: 18.42, qtyAsset: "USDC", brl: 99.83, hash: "0x1c7e4a9d2f6b8c3e5a1d7f9b2c4e6a8db208", ptax: 5.4096, cost: 0 },
  { d: 21, network: "solana", type: "swap", asset: "JUP → SOL", qty: 2400, qtyAsset: "JUP", brl: 7416.0, hash: "2vRt6yH3kP9mW1qN5xC8bL4jZ7f8KpL", ptax: 5.3987, cost: 6524.4 },
  { d: 17, network: "hyperliquid", type: "perp", asset: "HYPE-PERP", qty: 60, qtyAsset: "HYPE", brl: 2764.8, hash: "0x6d02b8e1f4a7c3d9e5b2a6f1c8d4e7b37f9a", ptax: 5.3915, cost: 2410.77 },
  { d: 12, network: "solana", type: "swap", asset: "USDC → SOL", qty: 85, qtyAsset: "USDC", brl: 463.0, hash: "5mWc8tR2nK6pX4vB9yL1hQ7jF3dTz3Q", ptax: 5.4471, cost: 430.0 },
  { d: 9, network: "solana", type: "swap", asset: "JUP → USDC", qty: 310, qtyAsset: "JUP", brl: null, hash: "2kLm7pV4xN1rT8cW5bQ9yH3jZ6fQw7R", ptax: 5.4302, cost: 801.6 },
];

const BASE_TOTAL = 28940.13;

/** Meses disponíveis, com o total (em R$) que cada um deve somar. */
const MONTHS: { key: string; total: number; status: ReportSummary["status"]; updatedAt: string; events: number }[] = [
  { key: "2026-10", total: 6214.9, status: "draft", updatedAt: day(2026, 9, 30, 17, 35), events: 4 },
  { key: "2026-09", total: BASE_TOTAL, status: "final", updatedAt: day(2026, 10, 5, 13, 14), events: 7 },
  { key: "2026-08", total: 41207.88, status: "final", updatedAt: day(2026, 9, 4), events: 12 },
  { key: "2026-07", total: 19563.4, status: "final", updatedAt: day(2026, 8, 6), events: 9 },
  { key: "2026-06", total: 36118.02, status: "final", updatedAt: day(2026, 7, 3), events: 14 },
  { key: "2026-05", total: 12870.55, status: "final", updatedAt: day(2026, 6, 5), events: 6 },
  { key: "2026-03", total: 52304.9, status: "final", updatedAt: day(2026, 4, 6), events: 18 },
];

/** Preços manuais informados pelo usuário (id do evento → preço unitário em R$). */
const manualPrices = new Map<string, number>();

function monthInfo(key: string) {
  const m = MONTHS.find((x) => x.key === key);
  if (!m) throw new ApiError("Não há dados para este mês.", 404, "month_not_found");
  return m;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Outubro é rascunho e tem só 4 eventos; os demais meses reaproveitam os 7 eventos-base. */
const baseFor = (key: string) => (key === "2026-10" ? BASE.slice(2, 6) : BASE);

function eventsFor(key: string): TaxEvent[] {
  const info = monthInfo(key);
  const [y, mo] = key.split("-").map(Number);
  const factor = info.total / BASE_TOTAL;
  const base = baseFor(key);
  return base.map((b, i) => {
    const id = `ev_${key}_${i}`;
    const manual = manualPrices.get(id);
    const qty = round2(b.qty * factor);
    const value = b.brl === null ? (manual !== undefined ? round2(manual * qty) : null) : round2(b.brl * factor);
    const dd = key === "2026-10" ? Math.min(b.d, 29) - 20 + 1 : b.d;
    const hash = key === "2026-09" ? b.hash : `${b.hash.slice(0, -4)}${(i * 7919 + y + mo).toString(36).slice(-4)}`;
    return {
      id,
      date: day(y, mo, Math.max(1, dd)),
      network: b.network,
      type: b.type,
      asset: b.asset,
      quantity: qty,
      quantityAsset: b.qtyAsset,
      valueBrl: value,
      priceSource: b.brl === null ? (manual !== undefined ? "manual" : null) : "auto",
      txHash: hash,
      explorerUrl: b.network === "solana" ? explorerTxUrl(hash) : `https://app.hyperliquid.xyz/explorer/tx/${hash}`,
    } satisfies TaxEvent;
  });
}

function rowsFor(key: string): ReportRow[] {
  const factor = monthInfo(key).total / BASE_TOTAL;
  const base = baseFor(key);
  return eventsFor(key)
    .map((e, i) => ({ e, b: base[i] }))
    .filter(({ e }) => e.valueBrl !== null)
    .map(({ e, b }, i) => {
      const cost = round2(b.cost * factor);
      const value = e.valueBrl!;
      return {
        id: `row_${key}_${i}`,
        date: e.date,
        type: e.type,
        asset: e.asset,
        quantity: e.quantity,
        ptax: b.ptax,
        valueBrl: value,
        costBrl: cost,
        gainBrl: round2(value - cost),
        manualPrice: e.priceSource === "manual",
      };
    });
}

function totals(rows: ReportRow[]) {
  const disposedBrl = round2(rows.reduce((s, r) => s + r.valueBrl, 0));
  const costBrl = round2(rows.reduce((s, r) => s + r.costBrl, 0));
  const gainBrl = round2(rows.reduce((s, r) => s + r.gainBrl, 0));
  // Regra simplificada só para a demo: 15% sobre o ganho quando o total alienado passa de R$ 35 mil.
  const taxBrl = disposedBrl > 35000 ? round2(gainBrl * 0.15) : 0;
  return { disposedBrl, costBrl, gainBrl, taxBrl };
}

async function buildReport(key: string): Promise<ReportDetail> {
  const info = monthInfo(key);
  const rows = rowsFor(key);
  const report: ReportDetail = { month: key, status: info.status, totals: totals(rows), rows, attestation: null };
  if (info.status === "final") {
    const hash = await sha256Hex(reportToCsv(report));
    const sig = key === "2026-09" ? FULL_TX : `${FULL_TX.slice(0, 40)}${hash.slice(0, 23)}`;
    report.attestation = {
      hash,
      txSignature: sig,
      slot: 331508764 - (MONTHS.findIndex((m) => m.key === key) - 1) * 6_480_000,
      registeredAt: info.updatedAt,
      publicId: hash.slice(0, 8),
    };
  }
  return report;
}

/* ---------------- Sincronização simulada ---------------- */

const SYNC_KEY = "orbix.mock.syncStartedAt";
const SYNC_DURATION = 14_000;

function syncStartedAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SYNC_KEY);
  return raw ? Number(raw) : null;
}

/* ---------------- API simulada ---------------- */

export const mockApi = {
  async getNonce(address: string): Promise<NonceResponse> {
    await wait(200);
    const nonce = Math.random().toString(36).slice(2, 12);
    const issuedAt = new Date().toISOString();
    return {
      nonce,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      message: [
        "orbixdeclare.com quer que você entre com sua conta Solana:",
        address,
        "",
        "Entrar no Orbix Declare. Esta assinatura não envia transações nem move fundos.",
        "",
        "URI: https://orbixdeclare.com",
        "Versão: 1",
        `Nonce: ${nonce}`,
        `Emitido em: ${issuedAt}`,
      ].join("\n"),
    };
  },

  async verify(req: VerifyRequest | { demo: true }): Promise<Session> {
    await wait(450);
    if ("address" in req) {
      user = { ...user, address: req.address };
      wallets = wallets.map((w) => (w.isLogin ? { ...w, address: req.address, verifiedAt: new Date().toISOString() } : w));
    }
    return { token: `demo.${Date.now()}`, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), user };
  },

  async me(): Promise<User> {
    await wait(120);
    const started = syncStartedAt();
    if (started && Date.now() - started > SYNC_DURATION) user = { ...user, onboarded: true };
    return user;
  },

  async logout(): Promise<void> {
    await wait(120);
  },

  async listWallets(): Promise<Wallet[]> {
    await wait();
    return wallets;
  },

  async addWallet(req: AddWalletRequest): Promise<Wallet> {
    await wait(600);
    if (!/^0x[0-9a-fA-F]{40}$/.test(req.address.trim())) {
      throw new ApiError("Endereço Hyperliquid inválido. Ele começa com 0x e tem 42 caracteres.", 422, "invalid_address");
    }
    if (wallets.some((w) => w.address.toLowerCase() === req.address.trim().toLowerCase())) {
      throw new ApiError("Esta carteira já está conectada.", 409, "duplicate_wallet");
    }
    if (wallets.length >= 3 && user.plan === "free") {
      throw new ApiError("O plano Grátis permite até 3 carteiras. Remova uma ou conheça o Pro.", 403, "plan_limit");
    }
    const w: Wallet = {
      id: `w_${Date.now()}`,
      network: req.network,
      address: req.address.trim(),
      label: req.label?.trim() || "Nova carteira",
      isLogin: false,
      verifiedAt: null,
      lastSyncAt: null,
      status: "empty",
    };
    wallets = [...wallets, w];
    return w;
  },

  async removeWallet(id: string): Promise<void> {
    await wait();
    const w = wallets.find((x) => x.id === id);
    if (w?.isLogin) throw new ApiError("A carteira de login não pode ser removida.", 409, "login_wallet");
    wallets = wallets.filter((x) => x.id !== id);
  },

  async syncWallet(id: string): Promise<Wallet> {
    await wait(900);
    wallets = wallets.map((w) =>
      w.id === id ? { ...w, lastSyncAt: new Date().toISOString(), status: w.status === "empty" ? "empty" : "synced" } : w,
    );
    return wallets.find((w) => w.id === id)!;
  },

  async startSync(): Promise<SyncStatus> {
    if (typeof window !== "undefined" && !syncStartedAt()) {
      window.sessionStorage.setItem(SYNC_KEY, String(Date.now()));
    }
    return this.syncStatus();
  },

  async syncStatus(): Promise<SyncStatus> {
    await wait(80);
    const started = syncStartedAt() ?? Date.now();
    const t = Math.min(1, (Date.now() - started) / SYNC_DURATION);
    const solT = Math.min(1, t / 0.45);
    const hlT = Math.max(0, Math.min(1, (t - 0.3) / 0.6));
    const sol = Math.round(1036 * solT);
    const hl = Math.round(860 * hlT);
    const done = t >= 1;
    if (done) user = { ...user, onboarded: true };
    const step = (cond: boolean, running: boolean) => (cond ? "done" : running ? "running" : "pending") as "done" | "running" | "pending";
    return {
      state: done ? "done" : "running",
      since: "2025-01-01",
      read: sol + hl,
      estimated: 1896,
      wallets: [
        { walletId: "w_sol_main", network: "solana", address: wallets[0]?.address ?? DEMO_ADDRESS, read: sol, total: 1036, state: solT >= 1 ? "done" : "running" },
        { walletId: "w_hl_perps", network: "hyperliquid", address: "0x4f2A8b1C9d3E7f6A5b2C1d0E9f8A7b6C5d4E9c1E", read: hl, total: hlT >= 1 ? 860 : null, state: hlT >= 1 ? "done" : hlT > 0 ? "running" : "pending", detail: "fills e funding" },
      ],
      steps: [
        { key: "verify", label: "Carteira verificada por assinatura", state: "done" },
        { key: "solana", label: "Histórico Solana lido", state: step(solT >= 1, solT < 1) },
        { key: "hyperliquid", label: "Buscando fills e funding na Hyperliquid", state: step(hlT >= 1, hlT > 0 && hlT < 1) },
        { key: "prices", label: "Cotando cada evento pela PTAX", state: step(t >= 0.95, hlT >= 1 && t < 0.95) },
        { key: "dashboard", label: "Montando o painel do mês", state: step(done, t >= 0.95 && !done) },
      ],
    };
  },

  async dashboard(month?: string): Promise<Dashboard> {
    await wait();
    const key = month ?? "2026-09";
    monthInfo(key);
    const events = eventsFor(key);
    const rows = rowsFor(key);
    const t = totals(rows);
    let prevGain: number | null = null;
    const prevKey = previousMonthKey(key);
    if (MONTHS.some((m) => m.key === prevKey)) prevGain = totals(rowsFor(prevKey)).gainBrl;
    return {
      month: key,
      updatedAt: day(2026, 9, 30, 17, 35),
      volumeBrl: t.disposedBrl,
      disposals: rows.length,
      capitalGainBrl: t.gainBrl,
      gainChangePct: key === "2026-09" ? 12.4 : prevGain ? round2(((t.gainBrl - prevGain) / prevGain) * 100) : null,
      estimatedTaxBrl: t.taxBrl,
      exemptionLimitBrl: 35000,
      missingPrices: events.filter((e) => e.valueBrl === null).length,
    };
  },

  async events(month: string): Promise<TaxEvent[]> {
    await wait();
    return eventsFor(month);
  },

  async setManualPrice(eventId: string, unitPriceBrl: number): Promise<TaxEvent> {
    await wait(500);
    manualPrices.set(eventId, unitPriceBrl);
    const month = eventId.split("_")[1];
    return eventsFor(month).find((e) => e.id === eventId)!;
  },

  async reports(): Promise<ReportSummary[]> {
    await wait();
    // Totais e contagens derivados das mesmas linhas do relatório, para a lista bater com o detalhe.
    return MONTHS.map((m) => ({
      month: m.key,
      status: m.status,
      events: eventsFor(m.key).length,
      totalBrl: totals(rowsFor(m.key)).disposedBrl,
      updatedAt: m.updatedAt,
    }));
  },

  async report(month: string): Promise<ReportDetail> {
    await wait();
    return buildReport(month);
  },

  /** No modo demo o CSV é gerado no navegador; ver src/app/(app)/relatorios/[mes]/page.tsx */
  async reportCsv(month: string): Promise<DownloadLink> {
    await wait(300);
    return { url: "", filename: `orbix-declare-${month}.csv`, expiresAt: new Date().toISOString() };
  },

  async generateDecripto(month: string): Promise<DownloadLink> {
    await wait(1100);
    return { url: "", filename: `decripto-${month}.txt`, expiresAt: new Date().toISOString() };
  },

  async verifyPublic(publicId: string): Promise<PublicVerification> {
    await wait(500);
    for (const m of MONTHS.filter((x) => x.status === "final")) {
      const r = await buildReport(m.key);
      if (r.attestation && r.attestation.publicId === publicId.toLowerCase()) {
        return {
          publicId: r.attestation.publicId,
          description: `Relatório mensal · ${monthLabel(m.key).replace(" ", "/")} · titular ocultado`,
          month: m.key,
          hash: r.attestation.hash,
          txSignature: r.attestation.txSignature,
          slot: r.attestation.slot,
          registeredAt: r.attestation.registeredAt,
          valid: true,
        };
      }
    }
    throw new ApiError("Não encontramos um relatório com este código de verificação.", 404, "not_found");
  },

  async agent(req: AgentRequest): Promise<AgentReply> {
    await wait(1200);
    if (user.agentQuestionsLeft <= 0) {
      throw new ApiError("Você usou as 20 perguntas do mês no plano Grátis.", 429, "quota");
    }
    user = { ...user, agentQuestionsLeft: user.agentQuestionsLeft - 1 };
    const q = req.message.toLowerCase();
    const now = new Date().toISOString();
    const ctx = {
      month: "2026-03",
      status: "final" as const,
      volumeBrl: 52304.9,
      gainBrl: 8912.4,
      taxBrl: 1336.86,
      taxRatePct: 15,
      sourceTx: { title: "Swap SOL → USDC · Jupiter", signature: "3JpRk8sT2wQ9mYc4LnB7xVe1HdZ6fGu5aP3rKt9vN8e", date: day(2026, 3, 14, 19, 42), slot: 318442107 },
    };
    const base = { conversationId: req.conversationId ?? `conv_${Date.now()}`, context: ctx, questionsLeft: user.agentQuestionsLeft };

    if (q.includes("custo médio") || q.includes("custo medio")) {
      return {
        ...base,
        suggestions: ["Esse ganho gerou imposto?", "Mostrar todas as vendas de SOL em março"],
        message: {
          id: `m_${Date.now()}`,
          role: "assistant",
          createdAt: now,
          blocks: [
            { type: "text", text: "O custo médio soma tudo o que você pagou pelo SOL (convertido em reais pela PTAX de cada compra) e divide pela quantidade que você tinha. A cada venda, o custo médio não muda; só a quantidade diminui." },
            { type: "breakdown", rows: [
              { label: "Compras acumuladas até 13/03", value: "61,20 SOL" },
              { label: "Custo total em R$", value: "R$ 48.111,62" },
              { label: "Custo médio por SOL", value: "R$ 786,06", emphasis: "total" },
              { label: "× 38,00 SOL vendidos", value: "R$ 29.870,15", emphasis: "gain" },
            ] },
            { type: "citations", items: [{ kind: "report", label: "Relatório · março/2026" }] },
          ],
        },
      };
    }
    if (q.includes("imposto")) {
      return {
        ...base,
        suggestions: ["Como foi calculado o custo médio?", "Quando vence o DARF de março?"],
        message: {
          id: `m_${Date.now()}`,
          role: "assistant",
          createdAt: now,
          blocks: [
            { type: "text", text: "Sim. Em março o total alienado foi de R$ 52.304,90, acima do limite de isenção de R$ 35.000,00 no mês. Por isso o ganho de capital do mês inteiro é tributado." },
            { type: "breakdown", rows: [
              { label: "Ganho de capital do mês", value: "R$ 8.912,40" },
              { label: "× alíquota", value: "15%" },
              { label: "Imposto devido", value: "R$ 1.336,86", emphasis: "total" },
            ] },
            { type: "text", text: "Confirme o valor com seu contador antes de emitir o DARF." },
          ],
        },
      };
    }
    return {
      ...base,
      suggestions: ["Como foi calculado o custo médio?", "Mostrar todas as vendas de SOL em março", "Esse ganho gerou imposto?"],
      message: {
        id: `m_${Date.now()}`,
        role: "assistant",
        createdAt: now,
        blocks: [
          { type: "text", text: `A maior parte do ganho de ${monthSlash("2026-03").split("/")[0]} (R$ 6.335,75 de R$ 8.912,40) veio de uma única venda: 38,00 SOL trocados por USDC na Jupiter em 14/03/2026. O SOL tinha custo médio bem abaixo do preço de venda.` },
          { type: "breakdown", rows: [
            { label: "Valor da venda", value: "US$ 7.182,00" },
            { label: "× PTAX venda · 13/03/2026", value: "R$ 5,0412" },
            { label: "Valor de alienação", value: "R$ 36.205,90" },
            { label: "− Custo médio de 38,00 SOL", value: "R$ 29.870,15" },
            { label: "Ganho de capital", value: "R$ 6.335,75", emphasis: "gain" },
          ] },
          { type: "text", text: "Usei a PTAX de venda do dia útil anterior à operação, publicada pelo Banco Central, como manda a regra de conversão." },
          { type: "citations", items: [
            { kind: "ptax", label: "PTAX · Banco Central · 13/03/2026", url: "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes" },
            { kind: "tx", label: "Transação 3JpR…vN8e", url: explorerTxUrl("3JpRk8sT2wQ9mYc4LnB7xVe1HdZ6fGu5aP3rKt9vN8e") },
          ] },
        ],
      },
    };
  },

  async deleteAccount(): Promise<void> {
    await wait(900);
    if (typeof window !== "undefined") window.sessionStorage.removeItem(SYNC_KEY);
  },
};

