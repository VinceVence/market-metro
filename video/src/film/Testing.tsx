import data from "../../public/data/case.json";
import { Stage, Icon, ramp, useTime, cue, usd, C } from "./Design";
export function Testing() {
  const t = useTime(),
    selected = cue("verifier", "selects", 6);
  return (
    <Stage disclosure="Mean modeled PayPal gain vs fixed · development trials">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 145,
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        Prove it. Then launch.
      </div>
      {[data.decision.original, data.decision.chosen].map((m, i) => (
        <div
          key={m.family}
          style={{
            position: "absolute",
            left: 120,
            top: 380 + i * 220,
            width: 1670,
            height: 175,
          }}
        >
          <div style={{ fontSize: 35, color: C.muted }}>
            {i ? "Boosted trees" : "Two-stage response"}
          </div>
          <div
            style={{
              height: 74,
              marginTop: 20,
              width:
                (m.paypal / 31) * 1350 * ramp(t, 0.5 + i * 0.3, 1.8 + i * 0.3),
              borderRadius: 12,
              background: i ? C.blue : "#a5b9cf",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 50,
              fontSize: 62,
              fontWeight: 650,
            }}
          >
            +{usd(m.paypal)}
          </div>
          {i === 1 && (
            <div
              style={{
                position: "absolute",
                left: 1120,
                top: 90,
                display: "flex",
                gap: 15,
                alignItems: "center",
                color: "#fff",
                fontSize: 32,
                opacity: ramp(t, selected, selected + 0.4),
              }}
            >
              <Icon kind="check" size={34} />
              Selected
            </div>
          )}
        </div>
      ))}
    </Stage>
  );
}
