import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import { Stage, HeroVideo, Icon, ramp, useTime, cue, C } from "./Design";
import { Person, Store } from "./StoryArt";
export function Quiet() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    intro = cue("problem", "meet", 6),
    map = cue("problem", "ontology", 9),
    reveal = ramp(t, intro, intro + 0.9);
  return (
    <Stage brand={false}>
      <HeroVideo file="film-world" zoom={1.04} opacity={0.08} />
      <div
        style={{ position: "absolute", inset: 0, opacity: 1 - 0.88 * reveal }}
      >
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
        <Person
          emotion={-0.15}
          gaze={-0.6}
          thinking={0.25}
          style={{
            left: 1370,
            top: 520,
            width: 225,
            height: 391,
            opacity: 0.6 * (1 - reveal),
          }}
        />
      </div>
      <Person
        role="merchant"
        emotion={-0.65 + 0.9 * reveal}
        thinking={1 - 0.75 * reveal}
        gaze={0.8}
        style={{
          left: 680 - 420 * reveal,
          top: 355 + 60 * reveal,
          width: 330 - 70 * reveal,
          height: 574 - 122 * reveal,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1085,
          top: 235,
          width: 735,
          fontSize: 77,
          lineHeight: 1.18,
          fontWeight: 650,
          letterSpacing: -2,
          opacity: 1 - reveal,
        }}
      >
        Could this happen
        <br />
        automatically?
      </div>
      <div
        style={{
          position: "absolute",
          left: 755,
          top: 165,
          width: 1080,
          textAlign: "center",
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: -5,
          opacity: reveal,
          translate: `0px ${(1 - reveal) * 25}px`,
        }}
      >
        Market Metro
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: reveal }}>
        <svg
          width="1920"
          height="1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <path
            d="M1260 480V555M920 690H1125M1395 690H1600"
            stroke="#a8c6df"
            strokeWidth="6"
          />
          {[0, 1].map((i) => (
            <circle
              key={i}
              cx={920 + ((t * 95 + i * 330) % 680)}
              cy="690"
              r="8"
              fill={C.blue}
            />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            left: 1125,
            top: 555,
            width: 270,
            height: 270,
            borderRadius: 135,
            background: C.blue,
            color: "#fff",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 16,
            boxShadow: "0 20px 65px #0877e525",
          }}
        >
          <Icon kind="model" size={75} />
          <div
            style={{
              fontSize: 42,
              fontWeight: 600,
              opacity: ramp(t, map - 0.2, map + 0.3),
            }}
          >
            Ontology
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 1165,
            top: 310,
            width: 190,
            height: 190,
            borderRadius: 30,
            background: "#fff",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 18,
          }}
        >
          <Icon kind="store" size={65} color={C.blue} />
          <div style={{ fontSize: 30 }}>Products</div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 745,
            top: 595,
            width: 195,
            height: 200,
            borderRadius: 30,
            background: "#fff",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 18,
          }}
        >
          <Icon kind="person" size={65} color={C.blue} />
          <div style={{ fontSize: 30 }}>Shoppers</div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 1580,
            top: 595,
            width: 220,
            height: 200,
            borderRadius: 30,
            background: "#fff",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 18,
          }}
        >
          <CanvasImage
            src={staticFile("brand/paypal.svg")}
            premountFor={fps}
            style={{ width: 49, height: 58 }}
          />
          <div style={{ fontSize: 30 }}>Payments</div>
        </div>
      </div>
    </Stage>
  );
}
