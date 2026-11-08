import { Stage, HeroVideo, Icon, Note, ramp, useTime, C } from "./Design";
export function Quiet() {
  const t = useTime();
  return (
    <Stage dark label="Spot the gap">
      <HeroVideo
        file="film-world"
        zoom={1.35 + 0.1 * ramp(t, 0, 7)}
        x={-100}
        opacity={0.32}
      />
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 230,
          width: 680,
          height: 620,
          borderRadius: 48,
          background: "#07284fef",
          padding: 50,
          boxSizing: "border-box",
          rotate: `${-3 + 3 * ramp(t, 0, 0.5)}deg`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            color: "#9ddaff",
            fontSize: 30,
          }}
        >
          <Icon kind="person" size={50} />
          Shopper 179
        </div>
        <div
          style={{
            fontSize: 250,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: -12,
          }}
        >
          {Math.round(16 * ramp(t, 0.15, 0.9))}
        </div>
        <div style={{ fontSize: 42 }}>days since purchase</div>
        <div style={{ display: "flex", gap: 14, marginTop: 35 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: i === 15 ? C.cyan : "#4c719b",
                opacity: ramp(t, 0.2 + i * 0.035, 0.5 + i * 0.035),
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1020,
          top: 350,
          width: 740,
          fontSize: 112,
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: -4,
          opacity: ramp(t, 2.6, 3),
        }}
      >
        Find a<br />
        <span style={{ color: C.cyan }}>useful match.</span>
      </div>
      <Note dark>Saved shopper history · market-wide purchase gap</Note>
    </Stage>
  );
}
