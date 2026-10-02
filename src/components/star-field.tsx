import type { CSSProperties } from "react";

// Seeded positions keep the server and client sky identical during hydration.
function starShadows(count: number, seed: number) {
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  return Array.from({ length: count }, () =>
    `${(random() * 100).toFixed(3)}cqw ${(random() * 2000).toFixed(1)}px #fff`,
  ).join(",");
}

const layers = [
  { size: 1, duration: "35s", opacity: 0.85, shadows: starShadows(700, 17) },
  { size: 2, duration: "65s", opacity: 0.9, shadows: starShadows(200, 43) },
  { size: 3, duration: "100s", opacity: 1, shadows: starShadows(70, 97) },
];

export function StarField() {
  return (
    <div aria-hidden="true" className="login-star-field">
      {layers.map(({ size, duration, opacity, shadows }) => (
        <span
          key={size}
          className="login-star-layer"
          style={{
            "--star-size": `${size}px`,
            "--star-duration": duration,
            "--star-shadows": shadows,
            opacity,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
