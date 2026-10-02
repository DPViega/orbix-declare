import { config } from "@/lib/config";
import { getLocale, intlLocale } from "@/lib/i18n/locale";
import { messagesFor } from "@/lib/i18n/messages";

/**
 * Cliente HTTP mínimo para a API do back-end.
 * - Envia o token da sessão em Authorization: Bearer.
 * - Converte respostas de erro em ApiError com mensagem amigável.
 * - Em 401, avisa a sessão (via onUnauthorized) para voltar ao login.
 * - Envia Accept-Language (pt-BR ou en-US) para o back-end responder no idioma da interface.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

/** Tempo máximo de espera por resposta; sem isso, uma API que aceita a conexão e não responde deixa a tela carregando para sempre. */
export const DEFAULT_TIMEOUT_MS = 20_000;
/** Para chamadas que dependem de trabalho pesado no back-end (sincronizar carteira, gerar DeCripto, agente). */
export const SLOW_TIMEOUT_MS = 90_000;

interface HttpInit {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function http<T>(method: Method, path: string, body?: unknown, init?: HttpInit): Promise<T> {
  const t = messagesFor(getLocale()).api;
  if (!config.apiUrl) {
    throw new ApiError(t.noApiUrl, 0, "no_api_url");
  }

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), init?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const callerSignal = init?.signal;
  const onCallerAbort = () => timeout.abort(callerSignal?.reason);
  if (callerSignal?.aborted) onCallerAbort();
  else callerSignal?.addEventListener("abort", onCallerAbort, { once: true });

  try {
    return await send<T>(method, path, body, timeout.signal, callerSignal, t);
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}

async function send<T>(
  method: Method,
  path: string,
  body: unknown,
  signal: AbortSignal,
  callerSignal: AbortSignal | undefined,
  t: ReturnType<typeof messagesFor>["api"],
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Accept-Language": intlLocale(getLocale()),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: "omit",
    });
  } catch (err) {
    if (callerSignal?.aborted) throw err;
    if (signal.aborted) throw new ApiError(t.timeout, 0, "timeout");
    throw new ApiError(t.network, 0, "network");
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;
  if (signal.aborted && !callerSignal?.aborted) throw new ApiError(t.timeout, 0, "timeout");

  // 401 com sessão ativa = sessão expirou. Sem sessão (ex.: assinatura recusada no login), usa a mensagem do back-end.
  if (res.status === 401 && authToken) {
    onUnauthorized?.();
    throw new ApiError(t.sessionExpired, 401, "unauthorized");
  }

  if (!res.ok) {
    // Formato de erro esperado do back-end: { error: { code, message } }
    const candidate = typeof payload?.error === "string" ? payload.error : payload?.error?.message ?? payload?.message;
    const message = typeof candidate === "string" ? candidate : t.serverError(res.status);
    throw new ApiError(message, res.status, payload?.error?.code);
  }

  return payload as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return messagesFor(getLocale()).api.generic;
}
