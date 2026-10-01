import { config } from "@/lib/config";

/**
 * Cliente HTTP mínimo para a API do back-end.
 * - Envia o token da sessão em Authorization: Bearer.
 * - Converte respostas de erro em ApiError com mensagem amigável.
 * - Em 401, avisa a sessão (via onUnauthorized) para voltar ao login.
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

export async function http<T>(method: Method, path: string, body?: unknown, init?: { signal?: AbortSignal }): Promise<T> {
  if (!config.apiUrl) {
    throw new ApiError("NEXT_PUBLIC_API_URL não está configurada.", 0, "no_api_url");
  }

  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: init?.signal,
      credentials: "omit",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.", 0, "network");
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  // 401 com sessão ativa = sessão expirou. Sem sessão (ex.: assinatura recusada no login), usa a mensagem do back-end.
  if (res.status === 401 && authToken) {
    onUnauthorized?.();
    throw new ApiError("Sua sessão expirou. Entre de novo com a carteira.", 401, "unauthorized");
  }

  if (!res.ok) {
    // Formato de erro esperado do back-end: { error: { code, message } }
    const message =
      payload?.error?.message ?? payload?.message ?? `O servidor respondeu com erro (${res.status}). Tente de novo.`;
    throw new ApiError(message, res.status, payload?.error?.code);
  }

  return payload as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Algo deu errado. Tente de novo.";
}
