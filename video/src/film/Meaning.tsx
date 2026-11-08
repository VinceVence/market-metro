import { Sequence, useVideoConfig } from "remotion";
import { Stage, Icon, Clip, Note, ramp, useTime, C } from "./Design";
export function Meaning() {
  const t = useTime(),
    { fps, durationInFrames } = useVideoConfig(),
    cut = durationInFrames / fps - 2.4;
  return (
    <Stage label="Ontology">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 150,
          fontSize: 108,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        Connect the dots.
      </div>
      {t < cut && (
        <>
          <svg
            width="1920"
            height="1080"
            style={{ position: "absolute", inset: 0 }}
          >
            <path
              d="M460 560H840M1080 560H1460"
              fill="none"
              stroke="#bfd3e8"
              strokeWidth="7"
            />
            {[0, 1, 2, 3].map((i) => (
              <circle
                key={i}
                cx={460 + ((t * 160 + i * 250) % 1000)}
                cy={560}
                r="9"
                fill={C.blue}
              />
            ))}
          </svg>
          {[
            ["person", "Shopper"],
            ["card", "Checkout"],
            ["store", "Merchant"],
          ].map(([icon, name], i) => (
            <div
              key={name}
              style={{
                position: "absolute",
                left: 230 + i * 610,
                top: 390,
                width: 280,
                height: 330,
                borderRadius: 36,
                background: i === 1 ? C.blue : "#fff",
                boxShadow: "0 22px 65px #12345614",
                color: i === 1 ? "#fff" : C.ink,
                display: "flex",
                flexDirection: "column",
                gap: 32,
                alignItems: "center",
                justifyContent: "center",
                scale: 0.94 + 0.06 * ramp(t, i * 0.35, i * 0.35 + 0.4),
              }}
            >
              <Icon kind={icon} size={96} />
              <div style={{ fontSize: 39, fontWeight: 600 }}>{name}</div>
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              top: 780,
              left: 720,
              width: 480,
              textAlign: "center",
              fontSize: 43,
              fontWeight: 600,
              color: C.blue,
              opacity: ramp(t, 2.8, 3.2),
            }}
          >
            Counted once.
          </div>
        </>
      )}
      <Sequence from={Math.round(cut * fps)} premountFor={fps}>
        <Clip
          file="ontology"
          trim={6}
          box={[660, 300, 1140, 600]}
          crop={[270, 100, 740, 390]}
        />
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 435,
            fontSize: 82,
            fontWeight: 650,
            lineHeight: 1.1,
            color: "#a66d19",
          }}
        >
          Unclear?
          <br />
          Hold.
        </div>
      </Sequence>
      <Note>Ontology illustration + recorded verifier</Note>
    </Stage>
  );
}
