import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, Icon, ramp, useTime, usePop, cue, usd, C, Kicker, Headline, Burst } from "./Design";
export function Results() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    purchaseAt = cue("impact", "sixteen", 1),
    pop = usePop();
  const rows = [
    {
      label: "Extra payment volume",
      value: data.vsFixed.volume,
      at: cue("impact", "volume", 4),
      color: C.cyan,
      detail: "Across the same 12-store market",
    },
    {
      label: "Merchant contribution",
      value: data.vsFixed.merchants,
      at: cue("impact", "merchant", 9),
      color: "#72e0b9",
      detail: "Includes inventory value",
    },
    {
      label: "Modeled PayPal net",
      value: data.vsFixed.paypal,
      at: cue("impact", "paypal", 13),
      color: "#fff",
      detail: "After $0.032 estimated AI inference cost",
    },
  ];
  return (
    <Stage dark disclosure="Controlled benchmark · same market">
      <Kicker n="07" label="Impact" top={110} dark />
      <Headline text="More purchases. Both sides gain." accent={["gain"]} top={150} size={78} dark />
      <Burst at={purchaseAt + 0.4} x={260} y={420} spread={300} count={30} />
      <div
        style={{
          position: "absolute",
          left: 105,
          top: 285,
          opacity: ramp(t, purchaseAt - 0.3, purchaseAt + 0.25),
          scale: 0.8 + 0.2 * pop(purchaseAt - 0.3, 9),
          transformOrigin: "left center",
        }}
      >
        <div
          style={{
            fontSize: 245,
            lineHeight: 1.05,
            letterSpacing: -13,
            fontWeight: 700,
            background: `linear-gradient(90deg, ${C.cyan}, #7ae0bf)`,
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          +
          {Math.round(
            data.vsFixed.purchases *
              ramp(t, purchaseAt - 0.2, purchaseAt + 0.6),
          )}
        </div>
        <div style={{ fontSize: 53, fontWeight: 600, marginTop: 12 }}>
          purchases kept
        </div>
        <div style={{ fontSize: 33, marginTop: 36, color: "#bfd5eb" }}>
          <span style={{ color: "#93a8bf" }}>Fixed {data.fixed.purchases}</span>
          <span style={{ margin: "0 24px" }}>→</span>
          <strong style={{ color: "#fff" }}>
            Agent {data.planner.purchases}
          </strong>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 125,
          top: 755,
          display: "grid",
          gridTemplateColumns: "repeat(8, 57px)",
          gap: 17,
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            style={{
              color: "#7ae0bf",
              opacity: ramp(
                t,
                purchaseAt + 0.12 + i * 0.035,
                purchaseAt + 0.35 + i * 0.035,
              ),
              scale: pop(purchaseAt + 0.12 + i * 0.05, 8),
              translate: `0px ${Math.sin(t * 3 + i * 0.6) * 3}px`,
            }}
          >
            <Icon kind="card" size={52} />
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            position: "absolute",
            left: 920,
            top: 280 + i * 205,
            width: 875,
            height: 185,
            borderRadius: 26,
            opacity: 0.25 + 0.75 * ramp(t, row.at - 0.35, row.at + 0.35),
            translate: `${(1 - pop(row.at - 0.5, 14)) * 120}px 0px`,
            background: `linear-gradient(90deg, ${row.color}${ramp(t, row.at - 0.2, row.at + 0.3) > 0.5 ? "22" : "0a"}, #ffffff05)`,
            borderLeft: `6px solid ${row.color}`,
            boxShadow: ramp(t, row.at - 0.2, row.at + 0.3) > 0.5 ? "0 20px 50px #00000040" : "none",
          }}
        >
          {i === 2 && (
            <div
              style={{
                position: "absolute",
                left: 24,
                top: 20,
                padding: 7,
                borderRadius: 10,
                background: "#fff",
              }}
            >
              <CanvasImage
                src={staticFile("brand/paypal.svg")}
                premountFor={fps}
                style={{ width: 25, height: 30 }}
              />
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: i === 2 ? 78 : 28,
              top: 20,
              fontSize: 30,
              color: "#c4daee",
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 58,
              fontSize: 79,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -3,
              color: row.color,
            }}
          >
            +{usd(row.value * ramp(t, row.at - 0.2, row.at + 0.6))}
          </div>
          <div
            style={{
              position: "absolute",
              left: 30,
              top: 149,
              fontSize: 23,
              color: "#afc8e0",
            }}
          >
            {row.detail}
          </div>
        </div>
      ))}
    </Stage>
  );
}
