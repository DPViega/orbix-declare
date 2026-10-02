/**
 * Ponto único de acesso à API. Todas as telas chamam `api.*` daqui.
 *
 * Cada função tem duas implementações:
 *  - HTTP: chama o back-end em NEXT_PUBLIC_API_URL (rotas documentadas em docs/API_CONTRACT.md)
 *  - Mock: src/lib/api/mock.ts, usado no modo demonstração
 *
 * Para integrar com o back-end real basta configurar NEXT_PUBLIC_API_URL; nenhuma tela muda.
 */
import { config } from "@/lib/config";
import { http, SLOW_TIMEOUT_MS } from "./client";
import { mockApi } from "./mock";
import type {
  AddWalletRequest,
  AgentReply,
  AgentRequest,
  Dashboard,
  DownloadLink,
  ManualPriceRequest,
  NonceResponse,
  PublicVerification,
  ReportDetail,
  ReportSummary,
  Session,
  SyncStatus,
  TaxEvent,
  User,
  VerifyRequest,
  Wallet,
} from "./types";

const enc = encodeURIComponent;

const httpApi = {
  // Autenticação — Sign-In With Solana
  getNonce: (address: string) => http<NonceResponse>("GET", `/api/auth/nonce?address=${enc(address)}`),
  verify: (req: VerifyRequest) => http<Session>("POST", "/api/auth/verify", req),
  me: () => http<User>("GET", "/api/me"),
  logout: () => http<void>("POST", "/api/auth/logout"),

  // Carteiras
  listWallets: () => http<Wallet[]>("GET", "/api/wallets"),
  addWallet: (req: AddWalletRequest) => http<Wallet>("POST", "/api/wallets", req),
  removeWallet: (id: string) => http<void>("DELETE", `/api/wallets/${enc(id)}`),
  syncWallet: (id: string) => http<Wallet>("POST", `/api/wallets/${enc(id)}/sync`, undefined, { timeoutMs: SLOW_TIMEOUT_MS }),

  // Ingestão (o back-end dispara /api/ingest/solana e /api/ingest/hyperliquid internamente)
  startSync: () => http<SyncStatus>("POST", "/api/ingest"),
  syncStatus: () => http<SyncStatus>("GET", "/api/ingest/status"),

  // Painel e eventos
  dashboard: (month?: string) => http<Dashboard>("GET", `/api/dashboard${month ? `?month=${enc(month)}` : ""}`),
  events: (month: string) => http<TaxEvent[]>("GET", `/api/events?month=${enc(month)}`),
  setManualPrice: (eventId: string, unitPriceBrl: number) =>
    http<TaxEvent>("PUT", `/api/events/${enc(eventId)}/price`, { unitPriceBrl } satisfies ManualPriceRequest),

  // Relatórios
  reports: () => http<ReportSummary[]>("GET", "/api/reports"),
  report: (month: string) => http<ReportDetail>("GET", `/api/report/${enc(month)}`),
  reportCsv: (month: string) => http<DownloadLink>("GET", `/api/report/${enc(month)}/csv`),
  generateDecripto: (month: string) => http<DownloadLink>("POST", `/api/report/${enc(month)}/decripto`, undefined, { timeoutMs: SLOW_TIMEOUT_MS }),

  // Verificação pública (sem login)
  verifyPublic: (publicId: string) => http<PublicVerification>("GET", `/api/verify/${enc(publicId)}`),

  // Agente IA (o back-end chama o Claude; a chave nunca fica no front)
  agent: (req: AgentRequest) => http<AgentReply>("POST", "/api/agent", req, { timeoutMs: SLOW_TIMEOUT_MS }),

  // LGPD — exclusão definitiva
  deleteAccount: () => http<void>("DELETE", "/api/me"),
};

export type Api = typeof httpApi;

export const api: Api = config.useMocks ? mockApi : httpApi;

/** Login de demonstração (só existe no modo mock). */
export const demoLogin = () => mockApi.verify({ demo: true });

export * from "./types";
export { ApiError, errorMessage } from "./client";
