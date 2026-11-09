import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, Icon, ramp, useTime, cue, usd, C } from "./Design";
export function Results() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    purchaseAt = cue("impact", "sixteen", 1);
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
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 135,
          fontSize: 82,
          fontWeight: 650,
          letterSpacing: -3,
        }}
      >
        More purchases. Both sides gain.
      </div>
      <div
        style={{
          position: "absolute",
          left: 105,
          top: 285,
          opacity: ramp(t, purchaseAt - 0.3, purchaseAt + 0.25),
        }}
      >
        <div
          style={{
            fontSize: 245,
            lineHeight: 1.05,
            letterSpacing: -13,
            fontWeight: 700,
            color: C.cyan,
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
              translate: `0px ${(1 - ramp(t, purchaseAt + 0.12 + i * 0.035, purchaseAt + 0.35 + i * 0.035)) * 18}px`,
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
            background: "#ffffff0a",
            border: "1px solid #ffffff13",
            opacity: 0.25 + 0.75 * ramp(t, row.at - 0.35, row.at + 0.35),
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
