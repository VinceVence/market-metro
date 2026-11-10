import type { ReactNode } from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import narration from "../../public/narration-neural.json";
import plan from "../../public/data/plan.json";
import "../fonts";
export const C = {
  ink: "#09284e",
  blue: "#0877e5",
  cyan: "#5fceff",
  mint: "#22b597",
  paper: "#f6f9fd",
  muted: "#698099",
};
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
export const ramp = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
export const useTime = () => useCurrentFrame() / useVideoConfig().fps;
/** Springy 0→1 (with a little overshoot) starting at second `at`. */
export const usePop = () => {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  return (at: number, damping = 12, mass = 0.7) =>
    spring({
      frame: frame - Math.round(at * fps),
      fps,
      config: { damping, mass, stiffness: 140 },
    });
};
export const cue = (scene: string, word: string, fallback: number) => {
  const item = narration.scenes
    .find((s) => s.id === scene)
    ?.words.find(
      (w) =>
        w.text.toLowerCase().replace(/[^a-z0-9]/g, "") === word.toLowerCase(),
    );
  return item ? item.startMs / 1000 : fallback;
};
export const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

export function Brand({ opacity = 1 }: { opacity?: number }) {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 44,
        top: 32,
        display: "flex",
        alignItems: "center",
        gap: 15,
        padding: "8px 15px 8px 8px",
        borderRadius: 18,
        background: "#ffffffed",
        opacity,
        zIndex: 5,
      }}
    >
      <CanvasImage
        src={staticFile("brand/metro.svg")}
        premountFor={fps}
        style={{ width: 48, height: 48 }}
      />
      <div
        style={{
          fontFamily: "DM Sans",
          fontSize: 29,
          fontWeight: 750,
          letterSpacing: -1.1,
          color: "#14354e",
        }}
      >
        Market <span style={{ color: "#087dd6" }}>Metro</span>
      </div>
    </div>
  );
}

export function Stage({
  children,
  dark = false,
  brand = true,
  enter = true,
  disclosure,
}: {
  children: ReactNode;
  dark?: boolean;
  brand?: boolean;
  enter?: boolean;
  disclosure?: string;
}) {
  const { fps } = useVideoConfig(),
    t = useTime();
  return (
    <AbsoluteFill
      style={{
        fontFamily: "DM Sans",
        background: dark ? "#081e35" : "#ffffff",
        color: dark ? "#fff" : C.ink,
        overflow: "hidden",
        opacity: enter ? ramp(t, 0, plan.overlapFrames / fps) : 1,
      }}
    >
      <Ambient dark={dark} />
      {children}
      {brand && <Brand />}
      {disclosure && (
        <div
          style={{
            position: "absolute",
            right: 62,
            top: 124,
            fontSize: 22,
            color: dark ? "#c1d5eb" : "#61758a",
            background: dark ? "#09284e99" : "#ffffffcc",
            padding: "8px 14px",
            borderRadius: 9,
          }}
        >
          {disclosure}
        </div>
      )}
    </AbsoluteFill>
  );
}

export function Icon({
  kind,
  size = 60,
  color = "currentColor",
}: {
  kind: string;
  size?: number;
  color?: string;
}) {
  const paths: Record<string, ReactNode> = {
    store: (
      <>
        <path d="M3 10h18l-2-7H5zM5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    data: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v7c0 4 18 4 18 0V5M3 12v7c0 4 18 4 18 0v-7" />
      </>
    ),
    model: (
      <>
        <circle cx="5" cy="5" r="3" />
        <circle cx="19" cy="12" r="3" />
        <circle cx="5" cy="19" r="3" />
        <path d="m8 6 8 5M8 18l8-5" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    card: (
      <>
        <rect x="2" y="5" width="20" height="15" rx="3" />
        <path d="M2 10h20M6 15h5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11Z" />,
    chat: <path d="M4 5h16v11H9l-5 4Z" />,
    bag: (
      <>
        <path d="M5 8h14l-1 13H6Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    x: <path d="M6 6l12 12M18 6 6 18" />,
    tag: (
      <>
        <path d="M3 12V3h9l9 9-9 9Z" />
        <circle cx="8" cy="8" r="1.6" />
      </>
    ),
    spark: <path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />,
    truck: (
      <>
        <path d="M2 6h12v11H2zM14 10h4l4 4v3h-8" />
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[kind] || paths.model}
    </svg>
  );
}
export function Clip({
  file,
  box,
  crop,
  source = [1280, 720],
  rate = 1,
  zoom = 1,
  trim = 0,
  chrome = true,
  label = "Market Metro · live app",
  enterAt = 0,
}: {
  file: string;
  box: [number, number, number, number];
  crop?: [number, number, number, number];
  source?: [number, number];
  rate?: number;
  zoom?: number;
  trim?: number;
  chrome?: boolean;
  label?: string;
  enterAt?: number;
}) {
  const { fps } = useVideoConfig(),
    t = useTime(),
    pop = usePop()(enterAt, 15);
  const bar = chrome ? 46 : 0;
  const [x, y, w, fullH] = box,
    h = fullH - bar,
    [cx, cy, cw, ch] = crop || [0, 0, ...source],
    s = Math.min(w / cw, h / ch) * zoom * (1 + 0.035 * ramp(t, enterAt, enterAt + 9));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: fullH,
        overflow: "hidden",
        borderRadius: 20,
        background: "#fff",
        boxShadow: "0 30px 90px #0a2d4b33, 0 0 0 1px #0a2d4b14",
        opacity: Math.min(1, pop * 1.5),
        scale: 0.94 + 0.06 * pop,
        translate: `0px ${(1 - pop) * 40}px`,
      }}
    >
      {chrome && (
        <div
          style={{
            height: bar,
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "0 18px",
            background: "#f1f5fa",
            borderBottom: "1px solid #dde6ef",
            fontSize: 19,
            color: "#6d8299",
          }}
        >
          {["#ff6b5f", "#ffbf2f", "#2bc840"].map((c) => (
            <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
          ))}
          <div
            style={{
              marginLeft: 16,
              padding: "4px 16px",
              borderRadius: 8,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                background: "#22b597",
                opacity: 0.5 + 0.5 * Math.sin(t * 5),
              }}
            />
            {label}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: bar, width: w, height: h, overflow: "hidden" }}>
        <Video
          name={file + " · actual app recording"}
          src={staticFile("footage/" + file + ".mp4")}
          muted
          trimBefore={Math.round(trim * fps)}
          playbackRate={rate}
          loop
          premountFor={fps}
          style={{
            position: "absolute",
            width: source[0] * s,
            height: source[1] * s,
            left: -cx * s + (w - cw * s) / 2,
            top: -cy * s + (h - ch * s) / 2,
          }}
        />
      </div>
    </div>
  );
}
export function HeroVideo({
  file,
  zoom = 1,
  x = 0,
  y = 0,
  opacity = 1,
  rate = 1,
}: {
  file: string;
  zoom?: number;
  x?: number;
  y?: number;
  opacity?: number;
  rate?: number;
}) {
  const { fps } = useVideoConfig();
  return (
    <div
      style={{ position: "absolute", inset: 0, overflow: "hidden", opacity }}
    >
      <Video
        name={file + " · app renderer"}
        src={staticFile("footage/" + file + ".mp4")}
        muted
        loop
        playbackRate={rate}
        premountFor={fps}
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          scale: zoom,
          translate: `${x}px ${y}px`,
        }}
      />
    </div>
  );
}
export function ProductTable() {
  return (
    <svg
      viewBox="0 0 700 600"
      width="700"
      height="600"
      aria-label="Illustration of a mobile side table"
    >
      <defs>
        <linearGradient id="wood" x2="1" y2="1">
          <stop stopColor="#e6d5b7" />
          <stop offset="1" stopColor="#bc9a6c" />
        </linearGradient>
      </defs>
      <ellipse
        cx="365"
        cy="500"
        rx="225"
        ry="40"
        fill="#0b2850"
        opacity=".08"
      />
      <path d="M180 190 460 130 570 210 288 280Z" fill="url(#wood)" />
      <path d="M180 190v26l108 88v-24Z" fill="#9f8059" />
      <path d="M288 280v24l282-69v-25Z" fill="#c4a77b" />
      {[
        [218, 244],
        [500, 260],
        [316, 308],
      ].map(([x, y]) => (
        <g key={x}>
          <path d={`M${x} ${y}v155`} stroke="#9ba8b7" strokeWidth="20" />
          <ellipse cx={x} cy={y + 165} rx="18" ry="22" fill="#35465b" />
          <ellipse cx={x - 4} cy={y + 162} rx="7" ry="10" fill="#8292a7" />
        </g>
      ))}
      <path
        d="M218 405 316 463 500 415"
        stroke="#9ba8b7"
        strokeWidth="18"
        fill="none"
      />
    </svg>
  );
}

/** Slowly drifting colour fields and a faint dot grid so no frame is ever still. */
export function Ambient({ dark = false }: { dark?: boolean }) {
  const t = useTime();
  const blobs = dark
    ? [
        ["#1d6fd6", 420, 260, 900],
        ["#13b3a0", 1580, 860, 760],
        ["#5fceff", 1500, 160, 520],
      ]
    : [
        ["#d8ecff", 300, 200, 900],
        ["#dcf6ee", 1650, 900, 800],
        ["#eef4ff", 1500, 220, 600],
      ];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {dark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg,#071a30 0%,#0a2a4f 55%,#08223c 100%)",
          }}
        />
      )}
      {blobs.map(([color, x, y, r], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: Number(x) - Number(r) / 2 + Math.sin(t * 0.35 + i * 2) * 60,
            top: Number(y) - Number(r) / 2 + Math.cos(t * 0.3 + i) * 45,
            width: Number(r),
            height: Number(r),
            borderRadius: "50%",
            background: `radial-gradient(circle, ${color}${dark ? "55" : "cc"} 0%, ${color}00 70%)`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${dark ? "#ffffff14" : "#0a3d6e10"} 1.6px, transparent 1.6px)`,
          backgroundSize: "34px 34px",
          backgroundPosition: `${(t * 6) % 34}px 0px`,
        }}
      />
    </div>
  );
}

/** Small uppercase chapter label with a sliding accent bar. */
export function Kicker({
  n,
  label,
  at = 1.0,
  left = 110,
  top = 112,
  dark = false,
}: {
  n: string;
  label: string;
  at?: number;
  left?: number;
  top?: number;
  dark?: boolean;
}) {
  const t = useTime(),
    k = ramp(t, at, at + 0.6);
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 4,
        color: dark ? C.cyan : C.blue,
        opacity: k,
        translate: `${(1 - k) * -30}px 0px`,
      }}
    >
      <div
        style={{
          width: 56 * k,
          height: 5,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${C.blue}, ${C.mint})`,
        }}
      />
      {n} · {label.toUpperCase()}
    </div>
  );
}

/** Headline whose words spring up one after another. */
export function Headline({
  text,
  at = 1.05,
  left = 110,
  top = 150,
  size = 82,
  accent = [],
  dark = false,
}: {
  text: string;
  at?: number;
  left?: number;
  top?: number;
  size?: number;
  accent?: string[];
  dark?: boolean;
}) {
  const pop = usePop();
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: -size * 0.04,
        display: "flex",
        flexWrap: "wrap",
        columnGap: size * 0.26,
        lineHeight: 1.08,
      }}
    >
      {text.split(" ").map((w, i) => {
        const p = pop(at + i * 0.09, 14);
        const hot = accent.includes(w.replace(/[^\w]/g, ""));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: Math.min(1, p * 1.4),
              translate: `0px ${(1 - p) * size * 0.6}px`,
              ...(hot
                ? {
                    background: `linear-gradient(90deg, ${dark ? C.cyan : C.blue}, ${C.mint})`,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }
                : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** Radial confetti / sparkle burst fired at second `at`. */
export function Burst({
  at,
  x,
  y,
  count = 26,
  spread = 260,
  colors = [C.blue, C.cyan, C.mint, "#ffc35c", "#ff8f7a"],
}: {
  at: number;
  x: number;
  y: number;
  count?: number;
  spread?: number;
  colors?: string[];
}) {
  const t = useTime(),
    k = t - at;
  if (k < 0 || k > 1.6) return null;
  const e = 1 - Math.pow(1 - Math.min(1, k / 0.9), 3);
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 3) * 0.3,
          d = spread * (0.55 + ((i * 37) % 10) / 22) * e,
          size = 9 + (i % 4) * 4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: Math.cos(a) * d - size / 2,
              top: Math.sin(a) * d - size / 2 + 120 * k * k,
              width: size,
              height: i % 2 ? size : size * 0.45,
              borderRadius: i % 3 ? 3 : "50%",
              background: colors[i % colors.length],
              rotate: `${k * 540 + i * 40}deg`,
              opacity: 1 - ramp(k, 0.9, 1.6),
            }}
          />
        );
      })}
    </div>
  );
}

/** Expanding ring pulse — use to draw the eye to something that just happened. */
export function Pulse({
  at,
  x,
  y,
  color = C.mint,
  size = 160,
}: {
  at: number;
  x: number;
  y: number;
  color?: string;
  size?: number;
}) {
  const t = useTime(),
    k = t - at;
  if (k < 0 || k > 1.2) return null;
  return (
    <>
      {[0, 0.25].map((d) => {
        const p = Math.max(0, Math.min(1, (k - d) / 0.9));
        return (
          <div
            key={d}
            style={{
              position: "absolute",
              left: x - (size * (0.4 + p)) / 2,
              top: y - (size * (0.4 + p)) / 2,
              width: size * (0.4 + p),
              height: size * (0.4 + p),
              borderRadius: "50%",
              border: `4px solid ${color}`,
              opacity: (1 - p) * (p > 0 ? 1 : 0),
            }}
          />
        );
      })}
    </>
  );
}
