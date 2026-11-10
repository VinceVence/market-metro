import type { ReactNode } from "react";
import { interpolateColors } from "remotion";
import { useTime, C } from "./Design";
import { Store } from "./StoryArt";

/**
 * A fully vector street (crisp at any zoom). Leo's store sits at world rect
 * STORE; `push` 0→1 flies the camera from the wide street to the framing the
 * story scenes use (store at left 40, top 220, 1050×758). `night` 1→0 brings up the day.
 */
const STORE = { x: 780, y: 520, w: 360, h: 260 };
const S = 1050 / STORE.w;
const FINAL = { cx: (960 - (40 - S * STORE.x)) / S, cy: (540 - (220 - S * STORE.y)) / S };
export const GROUND = STORE.y + (STORE.h * 579) / 650;

const mix = (night: number, n: string, d: string) => interpolateColors(night, [0, 1], [d, n]);
// Deterministic pseudo-random.
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const FAR = Array.from({ length: 16 }, (_, i) => ({ x: i * 128 - 40, w: 110 + rnd(i) * 40, h: 180 + rnd(i + 40) * 260 }));
const NEAR = Array.from({ length: 11 }, (_, i) => ({ x: i * 190 - 60, w: 150 + rnd(i + 7) * 50, h: 120 + rnd(i + 90) * 170 }));
const SHOPS = [
  { x: -10, w: 330, h: 250, awning: "#e2725b", sign: "BAKERY" },
  { x: 370, w: 360, h: 230, awning: "#22b597", sign: "BOOKS" },
  { x: 1190, w: 350, h: 240, awning: "#f2b544", sign: "CAFÉ" },
  { x: 1590, w: 340, h: 260, awning: "#8b6cdf", sign: "FLOWERS" },
];
/** Shoppers drifting along the sidewalk; some pop into a shop and come out again. */
const WALKERS = Array.from({ length: 14 }, (_, i) => ({
  speed: 150 + rnd(i + 3) * 120,
  phase: rnd(i + 11) * 2400,
  dir: i % 3 === 0 ? -1 : 1,
  lane: (i % 3) * 12,
  visit: i % 2 === 0,
}));
export const DOORS = [160, 560, 1046, 1370, 1760];

export function CityStreet({ night = 0, push = 1, children }: { night?: number; push?: number; children?: ReactNode }) {
  const t = useTime();
  const z = Math.pow(S, push),
    cx = 960 + (FINAL.cx - 960) * push,
    cy = 540 + (FINAL.cy - 540) * push;
  const sky = `linear-gradient(180deg, ${mix(night, "#030b18", "#a6d2f7")} 0%, ${mix(night, "#0d2c52", "#eef6ff")} 70%)`;
  const lit = (i: number) => 0.55 + 0.45 * Math.sin(t * (0.6 + rnd(i) * 1.2) + i);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: sky }}>
      {/* Stars + moon fade with the night */}
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: night }}>
        {Array.from({ length: 70 }, (_, i) => (
          <circle key={i} cx={rnd(i + 200) * 1920} cy={rnd(i + 300) * 520} r={1 + rnd(i) * 1.8} fill="#fff" opacity={0.3 + 0.6 * lit(i + 500)} />
        ))}
        <circle cx={1600} cy={150} r={46} fill="#fff6dc" />
        <circle cx={1600} cy={150} r={110} fill="#fff6dc" opacity={0.08} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transformOrigin: "0 0",
          transform: `translate(${960 - cx * z}px, ${540 - cy * z}px) scale(${z})`,
        }}
      >
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {/* Far skyline */}
          {FAR.map((b, i) => (
            <g key={"f" + i}>
              <rect x={b.x} y={GROUND - 120 - b.h} width={b.w} height={b.h + 120} fill={mix(night, "#0b2342", "#bfd6ec")} />
              {Array.from({ length: Math.floor(b.h / 46) * 3 }, (_, j) =>
                rnd(i * 50 + j) > 0.55 ? (
                  <rect
                    key={j}
                    x={b.x + 16 + (j % 3) * ((b.w - 40) / 3)}
                    y={GROUND - 100 - b.h + Math.floor(j / 3) * 46}
                    width={14}
                    height={20}
                    rx={2}
                    fill={mix(night, "#ffcf7a", "#e3eef9")}
                    opacity={night * lit(i * 50 + j) * 0.8 + (1 - night) * 0.7}
                  />
                ) : null,
              )}
            </g>
          ))}
          {/* Near skyline */}
          {NEAR.map((b, i) => (
            <rect key={"n" + i} x={b.x} y={GROUND - 40 - b.h - 160} width={b.w} height={b.h + 200} rx={6} fill={mix(night, "#112f55", "#d3e3f2")} />
          ))}
          {/* Sidewalk + road */}
          <rect x={-2000} y={GROUND} width={6000} height={80} fill={mix(night, "#1a3a60", "#cfdeec")} />
          <rect x={-2000} y={GROUND + 80} width={6000} height={1000} fill={mix(night, "#0a1c33", "#b3c7db")} />
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={"d" + i} x={i * 140 - 400} y={GROUND + 150} width={70} height={8} rx={4} fill={mix(night, "#ffffff33", "#ffffff")} />
          ))}
          {/* Neighbour shops */}
          {SHOPS.map((s, i) => {
            const top = GROUND - s.h;
            return (
              <g key={s.sign}>
                <rect x={s.x} y={top} width={s.w} height={s.h} rx={8} fill={mix(night, "#173b66", "#eef3f8")} />
                <rect x={s.x + 24} y={top + 96} width={s.w * 0.55} height={s.h - 120} rx={5} fill={mix(night, "#ffd38a", "#bfe0f2")} opacity={0.6 + 0.4 * night * lit(i + 900)} />
                <rect x={s.x + s.w * 0.68} y={top + 96} width={s.w * 0.22} height={s.h - 96} rx={4} fill={mix(night, "#0e2a4b", "#47698c")} />
                <path d={`M${s.x - 10} ${top + 84} l18 -46 h${s.w - 16} l18 46 Z`} fill={s.awning} opacity={0.75 + 0.25 * (1 - night)} />
                <text x={s.x + s.w / 2} y={top + 28} textAnchor="middle" fontFamily="DM Sans" fontWeight={700} fontSize={22} letterSpacing={3} fill={mix(night, "#ffe6b0", "#123e68")}>
                  {s.sign}
                </text>
              </g>
            );
          })}
          {/* Window glow spills onto the pavement at night */}
          {[...SHOPS.map((s) => s.x + s.w * 0.35), STORE.x + STORE.w * 0.37].map((x, i) => (
            <ellipse key={"g" + i} cx={x} cy={GROUND + 30} rx={140} ry={26} fill="#ffcf7a" opacity={0.16 * night} />
          ))}
          {/* Street lamps */}
          {[340, 750, 1165, 1565].map((x, i) => (
            <g key={"l" + i}>
              <rect x={x - 4} y={GROUND - 210} width={8} height={210} fill={mix(night, "#2b4f78", "#9fb3c8")} />
              <rect x={x - 22} y={GROUND - 222} width={44} height={14} rx={7} fill={mix(night, "#ffe9b8", "#9fb3c8")} />
              <circle cx={x} cy={GROUND - 200} r={70} fill="#ffe2a0" opacity={0.14 * night} />
            </g>
          ))}
        </svg>
        <Store style={{ left: STORE.x, top: STORE.y, width: STORE.w, height: STORE.h }} />
        {/* Leo's window lights up warmly at night */}
        <div
          style={{
            position: "absolute",
            left: STORE.x + (115 / 900) * STORE.w,
            top: STORE.y + (305 / 650) * STORE.h,
            width: (430 / 900) * STORE.w,
            height: (243 / 650) * STORE.h,
            borderRadius: 3,
            background: "radial-gradient(circle at 50% 60%, #ffd896, #ffb84a00 75%)",
            opacity: 0.55 * night,
            mixBlendMode: "screen",
          }}
        />
        {/* Glowing shoppers */}
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible", opacity: night }}>
          {WALKERS.map((w, i) => {
            const span = 2400,
              raw = (w.phase + t * w.speed) % span,
              x = w.dir > 0 ? raw - 240 : 2160 - raw;
            // Visiting walkers vanish into the nearest door for a moment.
            const door = DOORS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
            const near = Math.abs(x - door);
            const inside = w.visit && near < 60 ? 1 - near / 60 : 0;
            const y = GROUND + 18 + w.lane;
            return (
              <g key={i} opacity={1 - inside * 0.95}>
                <line x1={x} y1={y} x2={x - w.dir * 120} y2={y} stroke={C.cyan} strokeWidth={5} strokeLinecap="round" opacity={0.3} />
                <circle cx={x} cy={y - 50} r={12} fill="#e4f8ff" />
                <rect x={x - 12} y={y - 34} width={24} height={36} rx={12} fill="#9fe4ff" />
                <circle cx={x} cy={y - 28} r={40} fill={C.cyan} opacity={0.18} />
              </g>
            );
          })}
        </svg>
        {children}
      </div>
    </div>
  );
}

/** Screen position of a point on Leo's store (store viewBox units), at a given push. */
export const storeOnScreen = (vx: number, vy: number, push: number) => {
  const z = Math.pow(S, push),
    cx = 960 + (FINAL.cx - 960) * push,
    cy = 540 + (FINAL.cy - 540) * push;
  const wx = STORE.x + (vx / 900) * STORE.w,
    wy = STORE.y + (vy / 650) * STORE.h;
  return { x: 960 + (wx - cx) * z, y: 540 + (wy - cy) * z };
};
