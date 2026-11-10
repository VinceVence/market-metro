import { Sequence, useVideoConfig } from "remotion";
import { Stage, Clip, useTime, cue, ramp, C, Kicker, Headline } from "./Design";
export function Evidence() {
  const t = useTime(),
    { fps, durationInFrames } = useVideoConfig(),
    a = cue("ag_grid", "decisions", 6.6),
    b = cue("ag_grid", "receipt", 6),
    c = durationInFrames / fps - 1.9;
  return (
    <Stage dark>
      <Kicker n="08" label="Evidence" top={110} dark />
      <Headline text="Follow the full trail." accent={["trail"]} top={150} size={82} dark />
      <div
        style={{
          position: "absolute",
          left: 115,
          top: 270,
          display: "flex",
          gap: 14,
          fontSize: 30,
          padding: 8,
          borderRadius: 40,
          background: "#ffffff0f",
          border: "1px solid #ffffff1a",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            height: 58,
            borderRadius: 30,
            background: C.blue,
            boxShadow: "0 8px 24px #0877e566",
            width: [172, 200, 192][t < a ? 0 : t < b ? 1 : 2],
            left: 8 + 186 * ramp(t, a - 0.1, a + 0.3) + 214 * ramp(t, b - 0.1, b + 0.3),
          }}
        />
        {[
          ["Models", 0],
          ["Decisions", a],
          ["Payments", b],
        ].map(([name, start]) => (
          <div
            key={String(name)}
            style={{
              position: "relative",
              padding: "10px 32px",
              fontWeight: 650,
              color: "#fff",
              opacity:
                0.45 + 0.55 * ramp(t, Number(start), Number(start) + 0.3),
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
            label="AG Grid · model runs"
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
            label="AG Grid · agent decisions"
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
            label="PayPal widget · verified"
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
            label="Dashboard layout"
          />
        </div>
      </Sequence>
    </Stage>
  );
}
