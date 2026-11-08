import { Sequence, useVideoConfig } from "remotion";
import { Stage, Clip, Note, useTime, cue, ramp, C } from "./Design";
export function Evidence() {
  const t = useTime(),
    { fps, durationInFrames } = useVideoConfig(),
    a = cue("ag_grid", "decision", 4),
    b = cue("ag_grid", "receipt", 6),
    c = durationInFrames / fps - 1.9;
  return (
    <Stage dark label="AG Grid + AG Charts">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 135,
          fontSize: 85,
          fontWeight: 650,
        }}
      >
        Follow the full trail.
      </div>
      <div
        style={{
          position: "absolute",
          left: 115,
          top: 270,
          display: "flex",
          gap: 55,
          fontSize: 30,
        }}
      >
        {[
          ["Models", 0],
          ["Decisions", a],
          ["Payments", b],
        ].map(([name, start]) => (
          <div
            key={String(name)}
            style={{
              color: C.cyan,
              opacity:
                0.35 + 0.65 * ramp(t, Number(start), Number(start) + 0.3),
            }}
          >
            {name}
          </div>
        ))}
      </div>
      <Sequence
        from={0}
        durationInFrames={Math.round((a + 0.4) * fps)}
        premountFor={fps}
      >
        <div style={{ opacity: 1 - ramp(t, a, a + 0.4) }}>
          <Clip
            file="ag-models"
            rate={1.1}
            box={[110, 420, 1700, 425]}
            crop={[332, 320, 890, 225]}
          />
        </div>
      </Sequence>
      <Sequence
        from={Math.round(a * fps)}
        durationInFrames={Math.round((b - a + 0.4) * fps)}
        premountFor={fps}
      >
        <div
          style={{ opacity: ramp(t, a, a + 0.4) * (1 - ramp(t, b, b + 0.4)) }}
        >
          <Clip
            file="ag-decisions"
            trim={3.2}
            box={[110, 375, 1700, 490]}
            crop={[215, 245, 855, 250]}
          />
        </div>
      </Sequence>
      <Sequence
        from={Math.round(b * fps)}
        durationInFrames={Math.max(1, Math.round((c - b + 0.4) * fps))}
        premountFor={fps}
      >
        <div
          style={{ opacity: ramp(t, b, b + 0.4) * (1 - ramp(t, c, c + 0.4)) }}
        >
          <Clip
            file="ag-paypal"
            box={[580, 335, 780, 570]}
            crop={[778, 183, 450, 330]}
          />
        </div>
      </Sequence>
      <Sequence from={Math.round(c * fps)} premountFor={fps}>
        <div style={{ opacity: ramp(t, c, c + 0.4) }}>
          <Clip
            file="ag-layout"
            rate={1.2}
            box={[330, 355, 1260, 590]}
            crop={[305, 300, 830, 390]}
          />
        </div>
      </Sequence>
      <Note dark>
        Recorded app interactions · authored AG Studio layouts · evaluation
        build
      </Note>
    </Stage>
  );
}
