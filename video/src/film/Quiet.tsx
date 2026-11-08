import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import { Stage, Icon, Note, ramp, useTime, cue, C } from "./Design";
import { Person } from "./StoryArt";
export function Quiet() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    mapped = cue("problem", "ontology", 3);
  return (
    <Stage label="The ontology">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 155,
          fontSize: 82,
          fontWeight: 650,
          letterSpacing: -3,
        }}
      >
        One connected picture.
      </div>
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", inset: 0 }}
      >
        {["M470 585H780", "M1120 585 1450 425", "M1120 585 1450 745"].map(
          (d, i) => (
            <path
              key={d}
              d={d}
              stroke="#aac8e1"
              strokeWidth="6"
              fill="none"
              opacity={ramp(t, mapped + i * 0.35, mapped + i * 0.35 + 0.5)}
            />
          ),
        )}
        <circle
          cx={480 + ((t * 90) % 300)}
          cy="585"
          r="8"
          fill={C.blue}
          opacity={ramp(t, mapped, mapped + 0.5)}
        />
      </svg>
      <Person style={{ left: 170, top: 365, width: 220, height: 383 }} />
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 765,
          fontSize: 32,
          color: C.muted,
        }}
      >
        Shopper history
      </div>
      <div
        style={{
          position: "absolute",
          left: 780,
          top: 415,
          width: 340,
          height: 340,
          borderRadius: 170,
          background: C.blue,
          color: "#fff",
          display: "grid",
          alignContent: "center",
          justifyItems: "center",
          gap: 20,
          boxShadow: "0 25px 80px #0877e526",
          scale: 0.95 + 0.05 * ramp(t, mapped - 0.2, mapped + 0.4),
        }}
      >
        <Icon kind="model" size={90} />
        <div style={{ fontSize: 48, fontWeight: 650 }}>Ontology</div>
        <div style={{ fontSize: 25, color: "#d9f0ff" }}>Shared meaning</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1450,
          top: 300,
          width: 330,
          height: 250,
          borderRadius: 30,
          background: "#fff",
          boxShadow: "0 20px 60px #173c5b10",
          display: "grid",
          placeContent: "center",
          justifyItems: "center",
          gap: 25,
        }}
      >
        <Icon kind="store" size={75} color={C.blue} />
        <div style={{ fontSize: 36, fontWeight: 600 }}>Products</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1450,
          top: 620,
          width: 330,
          height: 250,
          borderRadius: 30,
          background: "#fff",
          boxShadow: "0 20px 60px #173c5b10",
          display: "grid",
          placeContent: "center",
          justifyItems: "center",
          gap: 22,
        }}
      >
        <CanvasImage
          src={staticFile("brand/paypal.svg")}
          premountFor={fps}
          style={{ width: 56, height: 66 }}
        />
        <div style={{ fontSize: 36, fontWeight: 600 }}>Payments</div>
      </div>
      <Note>
        Reviewed relationships connect records, units, timing and business
        meaning
      </Note>
    </Stage>
  );
}
