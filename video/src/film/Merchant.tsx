import { Stage, HeroVideo, Icon, Note, ramp, useTime, C } from "./Design";
import { Person, Store } from "./StoryArt";
export function Merchant() {
  const t = useTime();
  return (
    <Stage label="Agentic commerce that learns">
      <HeroVideo file="film-world" zoom={1.04} opacity={0.1} />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 165,
          width: 1700,
          fontSize: 88,
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: -3,
        }}
      >
        Who should we reach next?
      </div>
      <div
        style={{
          position: "absolute",
          left: 115,
          top: 290,
          fontSize: 40,
          color: C.muted,
        }}
      >
        Can AI work it out automatically?
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 835,
          height: 180,
          background: "#dce8f3",
        }}
      />
      <Store style={{ left: 70, top: 315, width: 780, height: 563 }} />
      <Person
        role="merchant"
        style={{ left: 555, top: 585, width: 158, height: 275 }}
      />
      <Person style={{ left: 1450, top: 470, width: 225, height: 391 }} />
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <path
          d="M835 655H1460"
          fill="none"
          stroke="#8bb2d5"
          strokeWidth="5"
          strokeDasharray="10 13"
        />
        {[0, 1].map((i) => (
          <circle
            key={i}
            cx={835 + ((t * 100 + i * 300) % 625)}
            cy={655}
            r="8"
            fill={C.blue}
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 1010,
          top: 530,
          width: 255,
          height: 255,
          borderRadius: 60,
          background: C.blue,
          color: "#fff",
          display: "grid",
          placeContent: "center",
          justifyItems: "center",
          gap: 14,
          boxShadow: "0 20px 65px #0877e52a",
          opacity: ramp(t, 0.3, 0.9),
        }}
      >
        <Icon kind="model" size={83} />
        <div style={{ fontSize: 40, fontWeight: 600 }}>AI agent</div>
      </div>
      <Note>Illustrated question · 12 shops · 600 simulated shoppers</Note>
    </Stage>
  );
}
