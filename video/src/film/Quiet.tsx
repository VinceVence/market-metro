import { CanvasImage, Sequence, staticFile, useVideoConfig } from "remotion";
import {
  Stage,
  Clip,
  Icon,
  ramp,
  useTime,
  usePop,
  Burst,
  cue,
  Brand,
  C,
} from "./Design";
import { Person } from "./StoryArt";
import { CityStreet } from "./City";
export function Quiet() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    intro = cue("problem", "meet", 3),
    reveal = ramp(t, intro, intro + 0.85),
    pop = usePop();
  const steps = [
    ["eye", "Observe", "observe"],
    ["model", "Train", "train"],
    ["check", "Test", "test"],
    ["card", "Measure", "measure"],
  ];
  return (
    <Stage brand={false}>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - reveal }}>
        <CityStreet />
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
          rotate: `${-2 + (1 - pop(0.15, 9)) * -10}deg`,
          scale: pop(0.15, 9) * (1 - 0.15 * reveal),
          transformOrigin: "left bottom",
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
          Could AI bring
          <br />
          customers back?
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
            style={{
              width: 96,
              height: 96,
              scale: pop(intro + 0.1, 8),
              rotate: `${(1 - pop(intro + 0.1, 8)) * -180}deg`,
            }}
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
          label="Market Metro · simulated city"
          enterAt={intro + 0.45}
        />
        <div style={{ opacity: ramp(t, cue("problem", "observe", 7.3) - 0.2, cue("problem", "observe", 7.3) + 0.4) }}>
          <Sequence from={Math.round((cue("problem", "observe", 7.3) - 0.3) * fps)} premountFor={fps}>
            <Clip
              file="film-traffic"
              source={[1920, 1080]}
              box={[680, 320, 1110, 495]}
              crop={[160, 120, 1600, 760]}
              label="Market Metro · live shoppers"
            />
          </Sequence>
        </div>
        <Burst at={intro + 0.15} x={728} y={198} count={18} spread={170} />
        <div
          style={{
            position: "absolute",
            left: 680,
            top: 850,
            width: 1110,
            height: 76,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 40,
              top: 36,
              height: 4,
              borderRadius: 2,
              background: "#dbe7f3",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 40,
              top: 36,
              height: 4,
              borderRadius: 2,
              width:
                1030 * Math.max(0,
                (steps.reduce(
                  (n, [, , word], i) =>
                    n + ramp(t, cue("problem", word, intro + 2 + i) - 0.3, cue("problem", word, intro + 2 + i) + 0.3),
                  0,
                ) -
                  1) /
                3),
              background: `linear-gradient(90deg, ${C.blue}, ${C.mint})`,
            }}
          />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
            {steps.map(([kind, label, word], i) => {
              const at = cue("problem", word, intro + 2 + i),
                on = ramp(t, at - 0.3, at + 0.3),
                p = pop(at - 0.3, 9);
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    gap: 13,
                    alignItems: "center",
                    padding: "14px 26px 14px 18px",
                    borderRadius: 40,
                    fontSize: 30,
                    fontWeight: 650,
                    background: on > 0.5 ? C.blue : "#fff",
                    color: on > 0.5 ? "#fff" : "#8aa0b6",
                    border: "2px solid " + (on > 0.5 ? C.blue : "#dbe7f3"),
                    boxShadow: on > 0.5 ? "0 12px 30px #0877e540" : "none",
                    scale: 0.9 + 0.1 * (t < at - 0.3 ? 0 : p),
                  }}
                >
                  <Icon kind={kind} size={38} color={on > 0.5 ? "#fff" : "#9db3c8"} />
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Brand />
    </Stage>
  );
}
