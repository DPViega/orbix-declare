/**
 * Contrato de dados entre o front-end e a API do back-end.
 *
 * Este arquivo é a PROPOSTA de contrato. O back-end deve devolver exatamente estes formatos
 * (JSON). Valores monetários são números em reais (BRL), datas são ISO 8601 em UTC e a chave
 * de mês é sempre "AAAA-MM". Veja docs/API_CONTRACT.md para a lista de rotas.
 */

export type Network = "solana" | "hyperliquid";
export type EventType = "swap" | "perp" | "funding";
export type ReportStatus = "draft" | "final";
export type Plan = "free" | "pro";

/* ---------- Autenticação (Sign-In With Solana) ---------- */

export interface NonceResponse {
  /** Mensagem exata que a carteira deve assinar (o back-end monta e guarda o nonce). */
  message: string;
  nonce: string;
  expiresAt: string;
}

export interface VerifyRequest {
  address: string;
  message: string;
  /** Assinatura ed25519 da mensagem, em base58. */
  signature: string;
}

export interface Session {
  /** Token de acesso enviado em Authorization: Bearer <token>. */
  token: string;
  expiresAt: string;
  user: User;
}

export interface User {
  id: string;
  /** Endereço Solana usado no login. */
  address: string;
  plan: Plan;
  /** Quantas perguntas ao agente restam no mês (plano grátis: 20). */
  agentQuestionsLeft: number;
  /** true quando a primeira sincronização completa já terminou. */
  onboarded: boolean;
}

/* ---------- Carteiras ---------- */

export type WalletStatus = "synced" | "syncing" | "error" | "empty" | "pending";

export interface Wallet {
  id: string;
  network: Network;
  address: string;
  label: string;
  /** true para a carteira Solana usada no login (não pode ser removida). */
  isLogin: boolean;
  verifiedAt: string | null;
  lastSyncAt: string | null;
  status: WalletStatus;
  /** Mensagem de erro amigável quando status === "error". */
  error?: string | null;
}

export interface AddWalletRequest {
  network: Network;
  address: string;
  label?: string;
}

/* ---------- Sincronização (ingestão) ---------- */

export type StepState = "done" | "running" | "pending" | "error";

export interface SyncWalletProgress {
  walletId: string;
  network: Network;
  address: string;
  read: number;
  /** Total estimado; null enquanto desconhecido. */
  total: number | null;
  state: StepState;
  /** Ex.: "fills e funding" */
  detail?: string;
  error?: string | null;
}

export interface SyncStatus {
  state: "idle" | "running" | "done" | "error";
  /** Início do histórico lido. Ex.: 2025-01-01 */
  since: string;
  read: number;
  estimated: number | null;
  wallets: SyncWalletProgress[];
  steps: { key: string; label: string; state: StepState }[];
}

/* ---------- Painel e eventos ---------- */

export interface Dashboard {
  month: string;
  updatedAt: string;
  volumeBrl: number;
  disposals: number;
  capitalGainBrl: number;
  /** Variação do ganho em relação ao mês anterior, em %. null se não houver base. */
  gainChangePct: number | null;
  estimatedTaxBrl: number;
  /** Limite mensal de isenção (R$ 35.000,00 hoje). Vem do back-end para não fixar regra no front. */
  exemptionLimitBrl: number;
  missingPrices: number;
}

export interface TaxEvent {
  id: string;
  date: string;
  network: Network;
  type: EventType;
  /** Ex.: "SOL → USDC", "HYPE-PERP" */
  asset: string;
  quantity: number;
  /** Símbolo da quantidade. Ex.: "SOL" */
  quantityAsset: string;
  /** null quando nenhuma fonte de preço foi encontrada. */
  valueBrl: number | null;
  priceSource: "auto" | "manual" | null;
  txHash: string;
  explorerUrl: string;

  /*
   * Detalhes para revisar o evento (opcionais: o back-end pode omitir ou mandar null;
   * o front mostra "Indisponível" no lugar).
   */
  /** Carteira de origem do evento. */
  wallet?: { address: string; label: string | null } | null;
  /** Protocolo ou corretora. Ex.: "Jupiter", "Hyperliquid". */
  protocol?: string | null;
  /** Preço unitário usado, em R$. null quando não há preço. */
  unitPriceBrl?: number | null;
  /** Fonte da cotação automática. Ex.: "Birdeye", "Hyperliquid". null se manual ou sem preço. */
  priceProvider?: string | null;
  /** PTAX de venda (USD→BRL) usada na conversão e a data de referência (AAAA-MM-DD). */
  ptax?: number | null;
  ptaxDate?: string | null;
  /** Custo de aquisição e ganho de capital do evento, em R$. */
  costBrl?: number | null;
  gainBrl?: number | null;
}

export interface ManualPriceRequest {
  unitPriceBrl: number;
}

/* ---------- Relatórios ---------- */

export interface ReportSummary {
  month: string;
  status: ReportStatus;
  events: number;
  totalBrl: number;
  updatedAt: string;
}

export interface ReportRow {
  id: string;
  date: string;
  type: EventType;
  asset: string;
  quantity: number;
  ptax: number;
  valueBrl: number;
  costBrl: number;
  gainBrl: number;
  manualPrice?: boolean;
}

export interface Attestation {
  /** SHA-256 (hex) do CSV final do relatório. */
  hash: string;
  txSignature: string;
  slot: number;
  registeredAt: string;
  /** Identificador curto do link público: /v/{publicId} */
  publicId: string;
}

export interface ReportDetail {
  month: string;
  status: ReportStatus;
  totals: { disposedBrl: number; costBrl: number; gainBrl: number; taxBrl: number };
  rows: ReportRow[];
  attestation: Attestation | null;
}

/** URL temporária (presigned) para baixar um arquivo gerado pelo back-end. */
export interface DownloadLink {
  url: string;
  filename: string;
  expiresAt: string;
}

/* ---------- Verificação pública ---------- */

export interface PublicVerification {
  publicId: string;
  /** "Relatório mensal · Setembro/2026 · titular ocultado" */
  description: string;
  month: string;
  hash: string;
  txSignature: string;
  slot: number;
  registeredAt: string;
  /** true quando o hash do registro on-chain bate com o hash guardado. */
  valid: boolean;
}

/* ---------- Agente IA ---------- */

export type AgentBlock =
  | { type: "text"; text: string }
  | { type: "breakdown"; rows: { label: string; value: string; emphasis?: "total" | "gain" }[] }
  | { type: "citations"; items: { kind: "ptax" | "tx" | "report"; label: string; url?: string }[] };

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  /** Mensagens do usuário usam só text; as do agente usam blocks. */
  text?: string;
  blocks?: AgentBlock[];
  createdAt: string;
}

export interface AgentContext {
  month: string;
  status: ReportStatus;
  volumeBrl: number;
  gainBrl: number;
  taxBrl: number;
  taxRatePct: number;
  sourceTx: {
    title: string;
    signature: string;
    date: string;
    slot: number;
  } | null;
}

export interface AgentRequest {
  message: string;
  /** Mês em foco ("AAAA-MM"); o back-end pode inferir se omitido. */
  month?: string;
  conversationId?: string;
}

export interface AgentReply {
  conversationId: string;
  message: AgentMessage;
  context: AgentContext | null;
  suggestions: string[];
  questionsLeft: number;
}
