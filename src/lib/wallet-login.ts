"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet, type Wallet as AdapterWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type MessageSignerWalletAdapter } from "@solana/wallet-adapter-base";
import bs58 from "bs58";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/locale";
import { messagesFor } from "@/lib/i18n/messages";

/**
 * Login com carteira Solana (Sign-In With Solana).
 *
 * 1. Conecta a carteira (Phantom/Solflare, detectadas pelo Wallet Standard).
 * 2. Pede ao back-end a mensagem com nonce: GET /api/auth/nonce?address=
 * 3. A carteira assina a mensagem (nenhuma transação é enviada).
 * 4. Envia { address, message, signature(base58) } para POST /api/auth/verify.
 * 5. O back-end valida a assinatura ed25519 + nonce e devolve a sessão.
 *
 * A validação da assinatura acontece SÓ no back-end. O front nunca decide se o login é válido.
 */

export type LoginPhase = "idle" | "connecting" | "signing" | "verifying";

/**
 * Traduz o erro da carteira. Os erros do Wallet Adapter (WalletConnectionError, WalletSignMessageError)
 * embrulham o erro original da extensão em `.error`; "cancelado" só quando ele diz que a pessoa recusou
 * (código 4001 ou texto de recusa). Qualquer outra falha mostra o motivo real, e o erro completo vai
 * para o console para diagnóstico.
 */
function friendly(err: unknown): string {
  const e = err as { name?: string; message?: string; error?: { code?: number; message?: string } };
  const name = e?.name ?? "";
  const inner = e?.error;
  const detail = (inner?.message || e?.message || "").trim();
  const t = messagesFor(getLocale()).walletErrors;
  console.error("[wallet-login]", err, inner ?? "");
  if (inner?.code === 4001 || /reject|denied|cancel|declin/i.test(`${detail} ${errorMessage(err)}`)) return t.cancelled;
  if (name === "WalletNotReadyError") return t.notReady;
  if (name === "WalletWindowClosedError") return t.windowClosed;
  if (name === "WalletConnectionError") return t.connectFailed(detail);
  if (name === "WalletSignMessageError") return t.signFailed(detail);
  return errorMessage(err);
}

export function useWalletLogin() {
  const { wallets, select, disconnect } = useWallet();
  const { signIn } = useSession();
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [formattingError, setFormattingError] = useState(false);
  // Carteiras padrão registram-se de forma assíncrona; esperamos um instante antes de dizer "nenhuma".
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDetected(true), 700);
    return () => clearTimeout(t);
  }, []);

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  const loginWith = useCallback(
    async (wallet: AdapterWallet) => {
      setError(null);
      setFormattingError(false);
      const adapter = wallet.adapter;
      try {
        setPhase("connecting");
        select(adapter.name);
        if (!adapter.connected) await adapter.connect();
        const address = adapter.publicKey?.toBase58();
        if (!address) throw new Error(messagesFor(getLocale()).walletErrors.noAddress);

        if (!("signMessage" in adapter) || typeof adapter.signMessage !== "function") {
          throw new Error(messagesFor(getLocale()).walletErrors.cannotSign(adapter.name));
        }

        const { message } = await api.getNonce(address);
        setPhase("signing");
        const signature = await (adapter as MessageSignerWalletAdapter).signMessage(new TextEncoder().encode(message));

        setPhase("verifying");
        const session = await api.verify({
          address,
          message,
          signature: bs58.encode(signature),
        });
        signIn(session);
        return session;
      } catch (err) {
        const detail = err as { message?: string; error?: { message?: string } };
        setFormattingError(/invalid formatting/i.test(`${detail?.message ?? ""} ${detail?.error?.message ?? ""}`));
        setError(friendly(err));
        try {
          await disconnect();
        } catch {
          /* ignora */
        }
        return null;
      } finally {
        setPhase("idle");
      }
    },
    [select, signIn, disconnect],
  );

  return {
    wallets: installed,
    detected,
    phase,
    error,
    formattingError,
    setError,
    loginWith,
    busy: phase !== "idle",
  };
}
