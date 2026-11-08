import type { ReactNode } from "react";
import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  interpolate,
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
        background: dark
          ? "radial-gradient(ellipse at 65% 35%,#153f70,#06172e 78%)"
          : "radial-gradient(ellipse at 60% 35%,#ffffff,#f0f5fb)",
        color: dark ? "#fff" : C.ink,
        overflow: "hidden",
        opacity: enter ? ramp(t, 0, plan.overlapFrames / fps) : 1,
      }}
    >
      {children}
      {brand && (
        <CanvasImage
          src={staticFile("brand/metro.svg")}
          premountFor={fps}
          style={{
            position: "absolute",
            left: 62,
            top: 38,
            width: 38,
            height: 38,
          }}
        />
      )}
      {disclosure && (
        <div
          style={{
            position: "absolute",
            right: 62,
            top: 42,
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
}: {
  file: string;
  box: [number, number, number, number];
  crop?: [number, number, number, number];
  source?: [number, number];
  rate?: number;
  zoom?: number;
  trim?: number;
}) {
  const { fps } = useVideoConfig();
  const [x, y, w, h] = box,
    [cx, cy, cw, ch] = crop || [0, 0, ...source],
    s = Math.min(w / cw, h / ch) * zoom;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: "hidden",
        borderRadius: 20,
        background: "#fff",
        boxShadow: "0 28px 85px #0a2d4b23",
      }}
    >
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
  );
}
export function HeroVideo({
  file,
  zoom = 1,
  x = 0,
  y = 0,
  opacity = 1,
}: {
  file: string;
  zoom?: number;
  x?: number;
  y?: number;
  opacity?: number;
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
