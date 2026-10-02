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

/** Plays once after a successful sync; this is a transition, not sync progress. */
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
    // Broken/slow assets must never block access to the dashboard.
    const timeout = setTimeout(() => setSettled(true), 3000);
    return () => clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    if (!settled) return;
    const timers = [
      setTimeout(() => setPhase("arrival"), 0),
      setTimeout(() => setPhase("hold"), reduced ? 100 : 2000),
      setTimeout(() => setPhase("exit"), reduced ? 600 : 5000),
      setTimeout(() => router.replace("/painel"), reduced ? 900 : 6500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [settled, reduced, router]);

  return (
    <main className={styles.welcome} data-phase={phase} data-loaded={loaded} aria-busy="true">
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
