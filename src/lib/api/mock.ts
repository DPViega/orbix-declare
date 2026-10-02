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
 *
 * Textos que viriam do back-end (etapas da sincronização, respostas do agente, erros) seguem o
 * idioma da interface, como o back-end real deve fazer a partir do header Accept-Language.
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
import { formatBRL, formatDate, monthLabel, monthName, previousMonthKey } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";

/** Texto no idioma atual da interface. */
const tr = (pt: string, en: string) => (getLocale() === "en" ? en : pt);

const wait = (ms = 380) => new Promise((r) => setTimeout(r, ms + Math.random() * 220));

/** Data às 12:00 de Brasília (15:00 UTC) para não "virar o dia" em fuso nenhum do BR. */
const day = (y: number, m: number, d: number, h = 15, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min)).toISOString();

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
    label: "Principal|Main",
    isLogin: true,
    verifiedAt: day(2026, 9, 2, 13, 10),
    lastSyncAt: day(2026, 9, 30, 17, 32),
    status: "synced",
  },
  {
    id: "w_hl_perps",
    network: "hyperliquid",
    address: "0x4f2A8b1C9d3E7f6A5b2C1d0E9f8A7b6C5d4E9c1E",
    label: "Trading de perps|Perps trading",
    isLogin: false,
    verifiedAt: null,
    lastSyncAt: day(2026, 9, 30, 17, 35),
    status: "synced",
  },
  {
    id: "w_sol_reserve",
    network: "solana",
    address: "9bWeT3kR7pQ1mZ5xN8vC2yH6jL4fD0sA9gU3Lm4T",
    label: "Reserva|Reserve",
    isLogin: false,
    verifiedAt: null,
    lastSyncAt: day(2026, 9, 28, 12, 10),
    status: "synced",
  },
];

/** Rótulos das carteiras de exemplo guardam "pt|en"; o usuário digita rótulos sem "|". */
const localizeWallet = (w: Wallet): Wallet => {
  const [pt, en] = w.label.split("|");
  return en === undefined ? w : { ...w, label: tr(pt, en) };
};

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
  {
    d: 28,
    network: "solana",
    type: "swap",
    asset: "SOL → USDC",
    qty: 12.4,
    qtyAsset: "SOL",
    brl: 11284.0,
    hash: "4Zq8nV2xK9pR3sL7wY1cB5mT2k",
    ptax: 5.4128,
    cost: 9412.6,
  },
  {
    d: 26,
    network: "hyperliquid",
    type: "perp",
    asset: "HYPE-PERP",
    qty: 150,
    qtyAsset: "HYPE",
    brl: 6912.5,
    hash: "0x9a3f7c2b5e8d1a4f6c3b9e2d7a5f8c1be41c",
    ptax: 5.4096,
    cost: 5980.0,
  },
  {
    d: 25,
    network: "hyperliquid",
    type: "funding",
    asset: "USDC",
    qty: 18.42,
    qtyAsset: "USDC",
    brl: 99.83,
    hash: "0x1c7e4a9d2f6b8c3e5a1d7f9b2c4e6a8db208",
    ptax: 5.4096,
    cost: 0,
  },
  {
    d: 21,
    network: "solana",
    type: "swap",
    asset: "JUP → SOL",
    qty: 2400,
    qtyAsset: "JUP",
    brl: 7416.0,
    hash: "2vRt6yH3kP9mW1qN5xC8bL4jZ7f8KpL",
    ptax: 5.3987,
    cost: 6524.4,
  },
  {
    d: 17,
    network: "hyperliquid",
    type: "perp",
    asset: "HYPE-PERP",
    qty: 60,
    qtyAsset: "HYPE",
    brl: 2764.8,
    hash: "0x6d02b8e1f4a7c3d9e5b2a6f1c8d4e7b37f9a",
    ptax: 5.3915,
    cost: 2410.77,
  },
  {
    d: 12,
    network: "solana",
    type: "swap",
    asset: "USDC → SOL",
    qty: 85,
    qtyAsset: "USDC",
    brl: 463.0,
    hash: "5mWc8tR2nK6pX4vB9yL1hQ7jF3dTz3Q",
    ptax: 5.4471,
    cost: 430.0,
  },
  {
    d: 9,
    network: "solana",
    type: "swap",
    asset: "JUP → USDC",
    qty: 310,
    qtyAsset: "JUP",
    brl: null,
    hash: "2kLm7pV4xN1rT8cW5bQ9yH3jZ6fQw7R",
    ptax: 5.4302,
    cost: 801.6,
  },
];

const BASE_TOTAL = 28940.13;

/** Meses disponíveis, com o total (em R$) que cada um deve somar. */
const MONTHS: {
  key: string;
  total: number;
  status: ReportSummary["status"];
  updatedAt: string;
  events: number;
}[] = [
  {
    key: "2026-10",
    total: 6214.9,
    status: "draft",
    updatedAt: day(2026, 9, 30, 17, 35),
    events: 4,
  },
  {
    key: "2026-09",
    total: BASE_TOTAL,
    status: "final",
    updatedAt: day(2026, 10, 5, 13, 14),
    events: 7,
  },
  {
    key: "2026-08",
    total: 41207.88,
    status: "final",
    updatedAt: day(2026, 9, 4),
    events: 12,
  },
  {
    key: "2026-07",
    total: 19563.4,
    status: "final",
    updatedAt: day(2026, 8, 6),
    events: 9,
  },
  {
    key: "2026-06",
    total: 36118.02,
    status: "final",
    updatedAt: day(2026, 7, 3),
    events: 14,
  },
  {
    key: "2026-05",
    total: 12870.55,
    status: "final",
    updatedAt: day(2026, 6, 5),
    events: 6,
  },
  {
    key: "2026-03",
    total: 52304.9,
    status: "final",
    updatedAt: day(2026, 4, 6),
    events: 18,
  },
];

/** Preços manuais informados pelo usuário (id do evento → preço unitário em R$). */
const manualPrices = new Map<string, number>();

function monthInfo(key: string) {
  const m = MONTHS.find((x) => x.key === key);
  if (!m) throw new ApiError(tr("Não há dados para este mês.", "There's no data for this month."), 404, "month_not_found");
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
    const date = day(y, mo, Math.max(1, dd));
    const source = b.brl === null ? (manual !== undefined ? "manual" : null) : "auto";
    const wallet = wallets.find((w) => w.network === b.network);
    const cost = round2(b.cost * factor);
    // PTAX de venda do dia útil anterior (aqui, simplificado para o dia anterior).
    const ptaxDate = new Date(new Date(date).getTime() - 86_400_000).toISOString().slice(0, 10);
    return {
      id,
      date,
      network: b.network,
      type: b.type,
      asset: b.asset,
      quantity: qty,
      quantityAsset: b.qtyAsset,
      valueBrl: value,
      priceSource: source,
      txHash: hash,
      explorerUrl: b.network === "solana" ? explorerTxUrl(hash) : `https://app.hyperliquid.xyz/explorer/tx/${hash}`,
      wallet: wallet ? { address: wallet.address, label: localizeWallet(wallet).label } : null,
      protocol: b.network === "solana" ? "Jupiter" : "Hyperliquid",
      unitPriceBrl: value === null ? null : manual !== undefined ? manual : round2(value / qty),
      priceProvider: source === "auto" ? (b.network === "solana" ? "Birdeye" : "Hyperliquid") : null,
      ptax: b.ptax,
      ptaxDate,
      costBrl: cost,
      gainBrl: value === null ? null : round2(value - cost),
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
  const report: ReportDetail = {
    month: key,
    status: info.status,
    totals: totals(rows),
    rows,
    attestation: null,
  };
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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
    // Mensagem Sign-In With Solana. A Phantom confere o domínio da 1ª linha com a origem da página e
    // recusa se forem diferentes; por isso domínio e URI vêm do endereço real. Os rótulos ficam em
    // inglês (formato padrão que a carteira interpreta); só a frase explicativa acompanha o idioma.
    const { host, origin } = window.location;
    return {
      nonce,
      expiresAt,
      message: [
        `${host} wants you to sign in with your Solana account:`,
        address,
        "",
        tr(
          "Entrar no Orbix Declare. Esta assinatura não envia transações nem move fundos.",
          "Sign in to Orbix Declare. This signature sends no transactions and moves no funds.",
        ),
        "",
        `URI: ${origin}`,
        "Version: 1",
        "Chain ID: mainnet",
        `Nonce: ${nonce}`,
        `Issued At: ${now.toISOString()}`,
        `Expiration Time: ${expiresAt}`,
      ].join("\n"),
    };
  },

  async verify(req: VerifyRequest | { demo: true }): Promise<Session> {
    await wait(450);
    if ("address" in req) {
      user = { ...user, address: req.address };
      wallets = wallets.map((w) => (w.isLogin ? { ...w, address: req.address, verifiedAt: new Date().toISOString() } : w));
    }
    return {
      token: `demo.${Date.now()}`,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user,
    };
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
    return wallets.map(localizeWallet);
  },

  async addWallet(req: AddWalletRequest): Promise<Wallet> {
    await wait(600);
    if (req.network === "hyperliquid" && !/^0x[0-9a-fA-F]{40}$/.test(req.address.trim())) {
      throw new ApiError(
        tr(
          "Endereço Hyperliquid inválido. Ele começa com 0x e tem 42 caracteres.",
          "Invalid Hyperliquid address. It starts with 0x and has 42 characters.",
        ),
        422,
        "invalid_address",
      );
    }
    if (req.network === "solana" && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(req.address.trim())) {
      throw new ApiError(
        tr(
          "Endereço Solana inválido. Ele tem de 32 a 44 letras e números, sem 0, O, I ou l.",
          "Invalid Solana address. It has 32 to 44 letters and numbers, without 0, O, I or l.",
        ),
        422,
        "invalid_address",
      );
    }
    if (wallets.some((w) => w.address.toLowerCase() === req.address.trim().toLowerCase())) {
      throw new ApiError(tr("Esta carteira já está conectada.", "This wallet is already connected."), 409, "duplicate_wallet");
    }
    if (wallets.length >= 3 && user.plan === "free") {
      throw new ApiError(
        tr(
          "O plano Grátis permite até 3 carteiras. Remova uma ou conheça o Pro.",
          "The Free plan allows up to 3 wallets. Remove one or check out Pro.",
        ),
        403,
        "plan_limit",
      );
    }
    const w: Wallet = {
      id: `w_${Date.now()}`,
      network: req.network,
      address: req.address.trim(),
      label: req.label?.trim() || "Nova carteira|New wallet",
      isLogin: false,
      verifiedAt: null,
      lastSyncAt: null,
      // Aguardando a primeira importação; syncWallet leva a "synced".
      status: "pending",
    };
    wallets = [...wallets, w];
    return localizeWallet(w);
  },

  async removeWallet(id: string): Promise<void> {
    await wait();
    const w = wallets.find((x) => x.id === id);
    if (w?.isLogin)
      throw new ApiError(tr("A carteira de login não pode ser removida.", "The sign-in wallet can't be removed."), 409, "login_wallet");
    wallets = wallets.filter((x) => x.id !== id);
  },

  async syncWallet(id: string): Promise<Wallet> {
    await wait(900);
    wallets = wallets.map((w) =>
      w.id === id
        ? {
            ...w,
            lastSyncAt: new Date().toISOString(),
            status: w.status === "empty" ? "empty" : "synced",
          }
        : w,
    );
    return localizeWallet(wallets.find((w) => w.id === id)!);
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
        {
          walletId: "w_sol_main",
          network: "solana",
          address: wallets[0]?.address ?? DEMO_ADDRESS,
          read: sol,
          total: 1036,
          state: solT >= 1 ? "done" : "running",
        },
        {
          walletId: "w_hl_perps",
          network: "hyperliquid",
          address: "0x4f2A8b1C9d3E7f6A5b2C1d0E9f8A7b6C5d4E9c1E",
          read: hl,
          total: hlT >= 1 ? 860 : null,
          state: hlT >= 1 ? "done" : hlT > 0 ? "running" : "pending",
          detail: tr("fills e funding", "fills and funding"),
        },
      ],
      steps: [
        {
          key: "verify",
          label: tr("Carteira verificada por assinatura", "Wallet verified by signature"),
          state: "done",
        },
        {
          key: "solana",
          label: tr("Histórico Solana lido", "Solana history read"),
          state: step(solT >= 1, solT < 1),
        },
        {
          key: "hyperliquid",
          label: tr("Buscando fills e funding na Hyperliquid", "Fetching fills and funding from Hyperliquid"),
          state: step(hlT >= 1, hlT > 0 && hlT < 1),
        },
        {
          key: "prices",
          label: tr("Cotando cada evento pela PTAX", "Pricing every event at the PTAX rate"),
          state: step(t >= 0.95, hlT >= 1 && t < 0.95),
        },
        {
          key: "dashboard",
          label: tr("Montando o painel do mês", "Building this month's dashboard"),
          state: step(done, t >= 0.95 && !done),
        },
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
    return {
      url: "",
      filename: `orbix-declare-${month}.csv`,
      expiresAt: new Date().toISOString(),
    };
  },

  async generateDecripto(month: string): Promise<DownloadLink> {
    await wait(1100);
    return {
      url: "",
      filename: `decripto-${month}.txt`,
      expiresAt: new Date().toISOString(),
    };
  },

  async verifyPublic(publicId: string): Promise<PublicVerification> {
    await wait(500);
    for (const m of MONTHS.filter((x) => x.status === "final")) {
      const r = await buildReport(m.key);
      if (r.attestation && r.attestation.publicId === publicId.toLowerCase()) {
        return {
          publicId: r.attestation.publicId,
          description: tr(
            `Relatório mensal · ${monthLabel(m.key).replace(" ", "/")} · titular ocultado`,
            `Monthly report · ${monthLabel(m.key).replace(" ", "/")} · holder hidden`,
          ),
          month: m.key,
          hash: r.attestation.hash,
          txSignature: r.attestation.txSignature,
          slot: r.attestation.slot,
          registeredAt: r.attestation.registeredAt,
          valid: true,
        };
      }
    }
    throw new ApiError(
      tr("Não encontramos um relatório com este código de verificação.", "We couldn't find a report with this verification code."),
      404,
      "not_found",
    );
  },

  async agent(req: AgentRequest): Promise<AgentReply> {
    await wait(1200);
    if (user.agentQuestionsLeft <= 0) {
      throw new ApiError(
        tr("Você usou as 20 perguntas do mês no plano Grátis.", "You've used this month's 20 questions on the Free plan."),
        429,
        "quota",
      );
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
      sourceTx: {
        title: "Swap SOL → USDC · Jupiter",
        signature: "3JpRk8sT2wQ9mYc4LnB7xVe1HdZ6fGu5aP3rKt9vN8e",
        date: day(2026, 3, 14, 19, 42),
        slot: 318442107,
      },
    };
    const base = {
      conversationId: req.conversationId ?? `conv_${Date.now()}`,
      context: ctx,
      questionsLeft: user.agentQuestionsLeft,
    };

    const sol = (n: number) => `${n.toLocaleString(getLocale() === "en" ? "en-US" : "pt-BR", { minimumFractionDigits: 2 })} SOL`;
    const mar14 = formatDate(day(2026, 3, 14));
    const mar13 = formatDate(day(2026, 3, 13));
    const march = monthName("2026-03");

    if (q.includes("custo médio") || q.includes("custo medio") || q.includes("average cost")) {
      return {
        ...base,
        suggestions: [
          tr("Esse ganho gerou imposto?", "Did this gain trigger tax?"),
          tr("Mostrar todas as vendas de SOL em março", "Show all SOL sales in March"),
        ],
        message: {
          id: `m_${Date.now()}`,
          role: "assistant",
          createdAt: now,
          blocks: [
            {
              type: "text",
              text: tr(
                "O custo médio soma tudo o que você pagou pelo SOL (convertido em reais pela PTAX de cada compra) e divide pela quantidade que você tinha. A cada venda, o custo médio não muda; só a quantidade diminui.",
                "The average cost adds up everything you paid for SOL (converted to reais at each purchase's PTAX rate) and divides it by the amount you held. Each sale leaves the average cost unchanged; only the amount goes down.",
              ),
            },
            {
              type: "breakdown",
              rows: [
                {
                  label: tr(`Compras acumuladas até ${mar13}`, `Purchases accumulated through ${mar13}`),
                  value: sol(61.2),
                },
                {
                  label: tr("Custo total em R$", "Total cost in R$"),
                  value: formatBRL(48111.62),
                },
                {
                  label: tr("Custo médio por SOL", "Average cost per SOL"),
                  value: formatBRL(786.06),
                  emphasis: "total",
                },
                {
                  label: tr(`× ${sol(38)} vendidos`, `× ${sol(38)} sold`),
                  value: formatBRL(29870.15),
                  emphasis: "gain",
                },
              ],
            },
            {
              type: "citations",
              items: [
                {
                  kind: "report",
                  label: tr(`Relatório · ${march}/2026`, `Report · ${march} 2026`),
                },
              ],
            },
          ],
        },
      };
    }
    if (q.includes("imposto") || q.includes("tax")) {
      return {
        ...base,
        suggestions: [
          tr("Como foi calculado o custo médio?", "How was the average cost calculated?"),
          tr("Quando vence o DARF de março?", "When is March's DARF due?"),
        ],
        message: {
          id: `m_${Date.now()}`,
          role: "assistant",
          createdAt: now,
          blocks: [
            {
              type: "text",
              text: tr(
                `Sim. Em março o total alienado foi de ${formatBRL(52304.9)}, acima do limite de isenção de ${formatBRL(35000)} no mês. Por isso o ganho de capital do mês inteiro é tributado.`,
                `Yes. In March the total disposed was ${formatBRL(52304.9)}, above the monthly exemption limit of ${formatBRL(35000)}. That's why the whole month's capital gain is taxed.`,
              ),
            },
            {
              type: "breakdown",
              rows: [
                {
                  label: tr("Ganho de capital do mês", "Capital gain for the month"),
                  value: formatBRL(8912.4),
                },
                { label: tr("× alíquota", "× rate"), value: "15%" },
                {
                  label: tr("Imposto devido", "Tax due"),
                  value: formatBRL(1336.86),
                  emphasis: "total",
                },
              ],
            },
            {
              type: "text",
              text: tr(
                "Confirme o valor com seu contador antes de emitir o DARF.",
                "Confirm the amount with your accountant before issuing the DARF (the Brazilian tax payment slip).",
              ),
            },
          ],
        },
      };
    }
    return {
      ...base,
      suggestions: [
        tr("Como foi calculado o custo médio?", "How was the average cost calculated?"),
        tr("Mostrar todas as vendas de SOL em março", "Show all SOL sales in March"),
        tr("Esse ganho gerou imposto?", "Did this gain trigger tax?"),
      ],
      message: {
        id: `m_${Date.now()}`,
        role: "assistant",
        createdAt: now,
        blocks: [
          {
            type: "text",
            text: tr(
              `A maior parte do ganho de ${march} (${formatBRL(6335.75)} de ${formatBRL(8912.4)}) veio de uma única venda: ${sol(38)} trocados por USDC na Jupiter em ${mar14}. O SOL tinha custo médio bem abaixo do preço de venda.`,
              `Most of the ${march} gain (${formatBRL(6335.75)} of ${formatBRL(8912.4)}) came from a single sale: ${sol(38)} swapped for USDC on Jupiter on ${mar14}. The SOL's average cost was well below the sale price.`,
            ),
          },
          {
            type: "breakdown",
            rows: [
              {
                label: tr("Valor da venda", "Sale value"),
                value: getLocale() === "en" ? "US$7,182.00" : "US$ 7.182,00",
              },
              {
                label: tr(`× PTAX venda · ${mar13}`, `× PTAX sell rate · ${mar13}`),
                value: getLocale() === "en" ? "R$5.0412" : "R$ 5,0412",
              },
              {
                label: tr("Valor de alienação", "Disposal value"),
                value: formatBRL(36205.9),
              },
              {
                label: tr(`− Custo médio de ${sol(38)}`, `− Average cost of ${sol(38)}`),
                value: formatBRL(29870.15),
              },
              {
                label: tr("Ganho de capital", "Capital gain"),
                value: formatBRL(6335.75),
                emphasis: "gain",
              },
            ],
          },
          {
            type: "text",
            text: tr(
              "Usei a PTAX de venda do dia útil anterior à operação, publicada pelo Banco Central, como manda a regra de conversão.",
              "I used the PTAX sell rate from the business day before the trade, published by Brazil's Central Bank, as the conversion rule requires.",
            ),
          },
          {
            type: "citations",
            items: [
              {
                kind: "ptax",
                label: tr(`PTAX · Banco Central · ${mar13}`, `PTAX · Central Bank of Brazil · ${mar13}`),
                url: "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes",
              },
              {
                kind: "tx",
                // Sem url: a transação é fictícia e não existe no Solana Explorer.
                label: tr("Transação 3JpR…vN8e (fictícia)", "Transaction 3JpR…vN8e (fictitious)"),
              },
            ],
          },
        ],
      },
    };
  },

  async deleteAccount(): Promise<void> {
    await wait(900);
    if (typeof window !== "undefined") window.sessionStorage.removeItem(SYNC_KEY);
  },
};
