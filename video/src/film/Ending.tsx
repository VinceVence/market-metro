import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import { Stage, HeroVideo, Icon, ramp, useTime, cue, C } from "./Design";
import { Person } from "./StoryArt";
export function Ending() {
  const t = useTime(),
    { fps } = useVideoConfig();
  return (
    <Stage brand={false}>
      <HeroVideo file="film-return" zoom={1.12} opacity={0.14} />
      <Person
        role="merchant"
        happy
        wave={1}
        style={{ left: 140, top: 520, width: 200, height: 348 }}
      />
      <Person
        happy
        wave={1}
        style={{ left: 1580, top: 520, width: 200, height: 348 }}
      />
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
        <div style={{ display: "flex", gap: 80, marginTop: 30, color: C.blue }}>
          {[
            ["data", "activity"],
            ["model", "campaigns"],
            ["card", "payments"],
          ].map(([kind, word]) => (
            <div
              key={kind}
              style={{
                opacity: ramp(
                  t,
                  cue("close", word, 1) - 0.3,
                  cue("close", word, 1) + 0.2,
                ),
              }}
            >
              <Icon kind={kind} size={56} />
            </div>
          ))}
        </div>
      </div>
    </Stage>
  );
}
