"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { WelcomeLogo, type WelcomePhase } from "@/components/welcome-logo";
import styles from "./welcome-screen.module.css";

const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};

// Stable coordinates keep SSR and hydration identical.
const STARS = Array.from({ length: 180 }, (_, index) => {
  const x = ((index * 7919 + 113) % 1280);
  const y = ((index * 3571 + 79) % 720);
  return { x, y, radius: 0.45 + (index % 4) * 0.2, opacity: 0.15 + (index % 6) * 0.08 };
});

export const WELCOME_KEY = "orbix.welcome";

/**
 * Decide se as boas-vindas devem tocar: só na primeira vez neste navegador (localStorage). Com redução
 * de movimento toca a versão calma (logo parada, ~1,5 s). Marca como vista ao decidir tocar.
 */
export function shouldPlayWelcome(): boolean {
  try {
    if (window.localStorage.getItem(WELCOME_KEY) === "seen") return false;
    window.localStorage.setItem(WELCOME_KEY, "seen");
  } catch {
    /* storage bloqueado: toca a animação, só não fica lembrada */
  }
  return true;
}

/** Transição curta (~2,6 s) depois da sincronização; clique ou Esc/Enter/espaço pulam direto ao painel. */
export function WelcomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [settled, setSettled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<WelcomePhase>("loading");
  const heading = useRef<HTMLHeadingElement>(null);
  // Caixa onde a logo aparece em repouso; o canvas em si cobre a tela toda (sem corte no voo final).
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    router.prefetch("/painel");
    // Modelo lento ou com erro nunca segura o acesso ao painel.
    const timeout = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    if (!settled) return;
    const timers = [
      setTimeout(() => setPhase("arrival"), 0),
      setTimeout(() => setPhase("hold"), reduced ? 100 : 1200),
      setTimeout(() => setPhase("exit"), reduced ? 1200 : 1600),
      setTimeout(() => router.replace("/painel"), reduced ? 1500 : 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [settled, reduced, router]);

  // Pular: Esc/Enter/espaço (o clique está no <main>).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") router.replace("/painel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <main className={styles.welcome} data-phase={phase} data-loaded={loaded} aria-busy="true" onClick={() => router.replace("/painel")}>
      <svg className={styles.sky} viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {STARS.map((star, index) => <g key={index} opacity={star.opacity}>
          <circle cx={star.x} cy={star.y} r={star.radius} fill="#e5dfff" />
          <line className={styles.ray} x1={star.x} y1={star.y} x2={star.x + (star.x - 640) * 0.28} y2={star.y + (star.y - 360) * 0.28} stroke="#c9bcf7" strokeWidth="0.65" />
        </g>)}
      </svg>
      <section className={styles.composition}>
        <h1 ref={heading} tabIndex={-1} className={styles.heading}>
          {t.welcome.title}<span className="sr-only"> Orbix Declare</span>
        </h1>
        <div className={styles.stage}>
          <svg className={styles.orbit} viewBox="0 0 900 320" aria-hidden="true">
            <g transform="rotate(-10 450 160)">
              <ellipse cx="450" cy="160" rx="418" ry="82" pathLength="1" className={styles.ring} />
              <g>
                <circle r="10" fill="#c9bcf7" opacity="0.06" />
                <circle r="3" fill="#e5dfff" />
                {reduced ? <animateTransform attributeName="transform" type="translate" values="868 160;868 160" dur="1s" fill="freeze" /> : <animateMotion dur="18s" repeatCount="indefinite" path="M868,160 a418,82 0 1,0 -836,0 a418,82 0 1,0 836,0" />}
              </g>
            </g>
          </svg>
          <div ref={frame} className={styles.model} aria-hidden="true" />
          {!loaded && <div className={styles.fallback} aria-hidden="true"><span>Orbix</span> Declare</div>}
        </div>
        <div className={styles.status} role="status" aria-live="polite">
          <div className={styles.track} aria-hidden="true"><span /></div>
          <p>{t.welcome.opening}</p>
        </div>
      </section>
      <div className={styles.canvas}>
        <WelcomeLogo frame={frame} phase={phase} reduced={reduced} onReady={(success) => { setLoaded(success); setSettled(true); }} />
      </div>
    </main>
  );
}
