import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import { Stage, HeroVideo, ramp, useTime } from "./Design";
export function Ending() {
  const t = useTime(),
    { fps } = useVideoConfig();
  return (
    <Stage label="">
      <HeroVideo file="film-return" zoom={1.12} opacity={0.14} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          opacity: ramp(t, 0, 0.25),
          scale: 0.96 + 0.04 * ramp(t, 0, 0.6),
        }}
      >
        <CanvasImage
          src={staticFile("brand/metro.svg")}
          premountFor={fps}
          style={{ width: 95, height: 95 }}
        />
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -8 }}>
          Market Metro
        </div>
        <div style={{ fontSize: 54 }}>Agentic commerce that learns.</div>
      </div>
    </Stage>
  );
}
