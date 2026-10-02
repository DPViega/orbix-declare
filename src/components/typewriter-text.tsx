"use client";

import { useEffect, useState } from "react";

/** Reveal a continuous text run instead of animating hundreds of inline layers. */
export function TypewriterText({ text, start = 0 }: { text: string; start?: number }) {
  const [count, setCount] = useState(0);
  const characters = Array.from(text);

  useEffect(() => {
    const length = Array.from(text).length;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let started: number | null = null;
    const tick = (now: number) => {
      if (motion.matches) {
        setCount(length);
        return;
      }
      const splash = document.querySelector(".splash");
      if (splash) {
        started = null;
        frame = requestAnimationFrame(tick);
        return;
      }
      started ??= now;
      const next = Math.min(length, Math.max(0, Math.floor((now - started - 150) / 22) - start + 1));
      setCount(next);
      if (next < length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, start]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {characters.slice(0, count).join("")}
        <span className="login-untyped-text">{characters.slice(count).join("")}</span>
      </span>
    </>
  );
}
