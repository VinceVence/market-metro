import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import {
  Stage,
  HeroVideo,
  Clip,
  Icon,
  ramp,
  useTime,
  cue,
  Brand,
  C,
} from "./Design";
import { Person, Store } from "./StoryArt";
export function Quiet() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    intro = cue("problem", "meet", 3),
    reveal = ramp(t, intro, intro + 0.85);
  const steps = [
    ["data", "Observe", "analyze"],
    ["model", "Train", "train"],
    ["check", "Test", "test"],
    ["card", "Measure", "measure"],
  ];
  return (
    <Stage brand={false}>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - reveal }}>
        <HeroVideo file="film-world" zoom={1.04} opacity={0.08} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 884,
            height: 200,
            background: "#dce8f3",
          }}
        />
        <Store style={{ left: 40, top: 220, width: 1050, height: 758 }} />
      </div>
      <Person
        role="merchant"
        emotion={-0.65 + 1.1 * reveal}
        thinking={1 - 0.8 * reveal}
        gaze={0.7}
        style={{
          left: 680 - 480 * reveal,
          top: 355 + 25 * reveal,
          width: 330 - 30 * reveal,
          height: 574 - 52 * reveal,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1040,
          top: 235,
          width: 730,
          padding: "42px 45px",
          boxSizing: "border-box",
          borderRadius: "38px 38px 38px 6px",
          background: "#fff4da",
          border: "3px solid #214a65",
          boxShadow: "9px 12px 0 #24465716",
          rotate: "-2deg",
          opacity: 1 - reveal,
        }}
      >
        <div
          style={{
            fontSize: 70,
            lineHeight: 1.15,
            fontWeight: 750,
            letterSpacing: -2,
          }}
        >
          Could AI do
          <br />
          this for Leo?
        </div>
        <svg width="380" height="22" style={{ marginTop: 18 }}>
          <path
            d="M3 12Q180 -6 375 11"
            stroke="#edaa75"
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: reveal }}>
        <div
          style={{
            position: "absolute",
            left: 680,
            top: 150,
            display: "flex",
            alignItems: "center",
            gap: 22,
          }}
        >
          <CanvasImage
            src={staticFile("brand/metro.svg")}
            premountFor={fps}
            style={{ width: 96, height: 96 }}
          />
          <div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 750,
                letterSpacing: -4,
                color: "#173d57",
              }}
            >
              Market Metro
            </div>
            <div style={{ fontSize: 34, color: "#58778e", marginTop: 9 }}>
              A commerce world for AI agents
            </div>
          </div>
        </div>
        <Clip
          file="film-park"
          source={[1920, 1080]}
          box={[680, 320, 1110, 495]}
          crop={[100, 80, 1710, 900]}
        />
        <div
          style={{
            position: "absolute",
            left: 680,
            top: 835,
            width: 1110,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {steps.map(([kind, label, word], i) => {
            const at = cue("problem", word, intro + 2 + i);
            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  gap: 13,
                  alignItems: "center",
                  fontSize: 30,
                  fontWeight: 600,
                  color: C.ink,
                  opacity: 0.3 + 0.7 * ramp(t, at - 0.3, at + 0.3),
                }}
              >
                <Icon kind={kind} size={42} color={C.blue} />
                {label}
              </div>
            );
          })}
        </div>
      </div>
      <Brand />
    </Stage>
  );
}
