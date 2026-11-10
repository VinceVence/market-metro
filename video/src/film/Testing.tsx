import data from "../../public/data/case.json";
import { Stage, Icon, ramp, useTime, usePop, cue, usd, C, Kicker, Headline, Burst } from "./Design";

export function Testing() {
  const t = useTime(),
    pop = usePop(),
    tests = cue("verifier", "tests", 3.2),
    checking = cue("verifier", "checking", 6.4),
    merchant = cue("verifier", "merchant", 7.6),
    winner = cue("verifier", "winner", 10.8),
    otherwise = cue("verifier", "otherwise", 12.1);
  const models = [
    { m: data.decision.original, name: "Two-stage response", color: "#8fa6bf" },
    { m: data.decision.chosen, name: "Boosted trees", color: C.blue },
  ];
  const maxPay = Math.max(...models.map((x) => x.m.paypal));
  const stamp = pop(winner + 0.1, 7),
    shake = t > winner + 0.1 && t < winner + 0.4 ? Math.sin(t * 90) * 6 : 0;
  return (
    <Stage disclosure="Mean modeled gain vs fixed · development trials">
      <Kicker n="04" label="Verifier" />
      <Headline text="Nothing ships on a hunch." accent={["hunch"]} top={160} size={82} />
      <div
        style={{
          position: "absolute",
          left: 1340,
          top: 330,
          display: "flex",
          gap: 20,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 2,
          color: C.muted,
          opacity: ramp(t, checking - 0.2, checking + 0.3),
        }}
      >
        <div style={{ width: 220 }}>PAYPAL</div>
        <div style={{ width: 240, opacity: ramp(t, merchant - 0.2, merchant + 0.2) }}>MERCHANT</div>
      </div>
      {models.map(({ m, name, color }, i) => {
        const y = 390 + i * 230,
          win = i === 1,
          run = ramp(t, tests + i * 0.25, tests + 2.6 + i * 0.25),
          dim = win ? 0 : ramp(t, winner, winner + 0.4);
        return (
          <div key={name} style={{ position: "absolute", left: 0, top: y, width: 1920, height: 190, opacity: 1 - 0.45 * dim }}>
            <div
              style={{
                position: "absolute",
                left: 110,
                top: 0,
                width: 470,
                height: 170,
                borderRadius: 28,
                background: "#fff",
                border: `3px solid ${win && t > winner ? C.blue : "#e1e9f2"}`,
                boxShadow: win && t > winner ? "0 20px 60px #0877e535" : "0 12px 30px #0a2d4b10",
                padding: "24px 30px",
                boxSizing: "border-box",
                scale: pop(1.1 + i * 0.25, 11),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 33, fontWeight: 700, whiteSpace: "nowrap" }}>
                <Icon kind="model" size={38} color={color} />
                {name}
              </div>
              <div style={{ marginTop: 16, display: "inline-block", padding: "6px 16px", borderRadius: 20, background: "#eef3f9", fontSize: 24, color: C.muted }}>
                AUC {m.auc.toFixed(3)}
              </div>
            </div>
            <div style={{ position: "absolute", left: 600, top: 76, width: 680, height: 18, borderRadius: 9, background: "#e6edf5" }} />
            <div
              style={{
                position: "absolute",
                left: 600,
                top: 76,
                width: 680 * (m.paypal / maxPay) * run,
                height: 18,
                borderRadius: 9,
                background: win ? `linear-gradient(90deg, ${C.blue}, ${C.cyan})` : color,
              }}
            />
            {Array.from({ length: 6 }, (_, k) => (
              <div
                key={k}
                style={{
                  position: "absolute",
                  left: 600 + k * 136 - 7,
                  top: 70,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  background: "#fff",
                  border: "5px solid #cfdbe7",
                  boxSizing: "border-box",
                }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                left: 600 + 680 * (m.paypal / maxPay) * run - 40,
                top: 48,
                width: 80,
                height: 74,
                borderRadius: 22,
                background: win ? C.blue : color,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 12px 24px #0a2d4b30",
                opacity: ramp(t, tests - 0.2, tests),
              }}
            >
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 30 }}>M</div>
            </div>
            <div style={{ position: "absolute", left: 1340, top: 52, width: 220, fontSize: 54, fontWeight: 750, letterSpacing: -2, opacity: ramp(t, checking - 0.2, checking + 0.2) }}>
              +{usd(m.paypal * ramp(t, checking, checking + 1))}
            </div>
            <div
              style={{
                position: "absolute",
                left: 1580,
                top: 52,
                width: 260,
                fontSize: 54,
                fontWeight: 750,
                letterSpacing: -2,
                color: win ? "#168b75" : "#6d8299",
                opacity: ramp(t, merchant - 0.2, merchant + 0.2),
              }}
            >
              +{usd(m.merchants * ramp(t, merchant, merchant + 1))}
            </div>
          </div>
        );
      })}
      <Burst at={winner + 0.15} x={900} y={650} spread={320} count={34} />
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 590,
          padding: "14px 40px",
          border: "8px solid #22b597",
          borderRadius: 20,
          color: "#22b597",
          background: "#ffffffe8",
          fontSize: 66,
          fontWeight: 800,
          letterSpacing: 8,
          rotate: "-7deg",
          scale: t > winner + 0.1 ? 2.2 - 1.2 * stamp : 0,
          opacity: ramp(t, winner + 0.1, winner + 0.2),
          translate: `${shake}px 0px`,
          boxShadow: "0 20px 50px #22b59740",
        }}
      >
        ✓ PUBLISHED
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 868,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 26px 12px 18px",
          borderRadius: 40,
          background: "#f4f7fb",
          border: "2px solid #dbe6f1",
          fontSize: 28,
          color: C.muted,
          fontWeight: 600,
          scale: pop(otherwise - 0.1, 10),
          transformOrigin: "left center",
        }}
      >
        <Icon kind="lock" size={30} color={C.muted} /> No tested winner? The current policy stays.
      </div>
    </Stage>
  );
}
