import role from "../../public/data/ontology-role.json";
import { Stage, Icon, ramp, useTime, usePop, cue, C, Kicker, Headline, Pulse } from "./Design";

const NODES = [
  { id: "shoppers", label: "Shoppers", icon: "person", x: 560, y: 550, color: C.blue },
  { id: "contacts", label: "Contacts", icon: "chat", x: 960, y: 350, color: "#885ec0" },
  { id: "products", label: "Products", icon: "tag", x: 1360, y: 550, color: C.mint },
  { id: "payments", label: "Payments", icon: "card", x: 960, y: 750, color: "#e0962c" },
];
// Metro-map routes: 45° bends between stations.
const EDGES = [
  ["M560 550 L660 450 H860 L960 350", C.blue],
  ["M960 350 L1060 450 H1260 L1360 550", "#885ec0"],
  ["M1360 550 L1260 650 H1060 L960 750", C.mint],
  ["M960 750 L860 650 H660 L560 550", "#e0962c"],
];
const LOOP = "M560 550 L660 450 H860 L960 350 L1060 450 H1260 L1360 550 L1260 650 H1060 L960 750 L860 650 H660 L560 550";

export function Meaning() {
  const t = useTime(),
    pop = usePop(),
    connects = cue("ontology", "connects", 3.3),
    prediction = cue("ontology", "prediction", 7),
    split = cue("ontology", "recommendations", 10),
    never = cue("ontology", "never", 11.9),
    rule = cue("ontology", "rule", 14.2),
    inputs = cue("ontology", "inputs", 15.9),
    later = cue("ontology", "later", 16.6),
    labels = cue("ontology", "labels", 18.2);
  const phaseA = 1 - ramp(t, split - 0.6, split - 0.1),
    phaseB = ramp(t, split - 0.3, split + 0.2) * (1 - ramp(t, rule - 0.6, rule - 0.1)),
    phaseC = ramp(t, rule - 0.3, rule + 0.2);
  const count = (n: number, at: number) =>
    Math.round(n * ramp(t, at, at + 1.1)).toLocaleString("en-US");
  const travel = ramp(t, prediction, prediction + 1.8);
  return (
    <Stage disclosure="Historical training example">
      <Kicker n="02" label="Ontology" />
      <Headline text="Data. With meaning." accent={["meaning"]} top={160} size={80} />

      {/* Phase A — the ontology as a metro map */}
      <div style={{ position: "absolute", inset: 0, opacity: phaseA, scale: 1 - 0.08 * (1 - phaseA) }}>
        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
          {EDGES.map(([d, color], i) => {
            const at = connects + i * 0.55;
            return (
              <g key={i}>
                <path d={d} stroke="#e3ebf4" strokeWidth="22" fill="none" strokeLinejoin="round" />
                <path
                  d={d}
                  pathLength={1}
                  stroke={color}
                  strokeWidth="14"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - ramp(t, at, at + 0.7)}
                />
              </g>
            );
          })}
          <path
            id="loop"
            d={LOOP}
            pathLength={1}
            stroke="#fff"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="0.06 0.94"
            strokeDashoffset={-travel}
            opacity={travel > 0 && travel < 1 ? 1 : 0}
            style={{ filter: "drop-shadow(0 0 10px #5fceff)" }}
          />
        </svg>
        {NODES.map((n, i) => {
          const at = cue("ontology", n.id, connects + 0.5 + i * 0.6),
            p = pop(at - 0.15, 9);
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: n.x - 75,
                top: n.y - 75,
                width: 150,
                height: 150,
                borderRadius: 75,
                background: "#fff",
                border: `10px solid ${n.color}`,
                boxSizing: "border-box",
                display: "grid",
                placeItems: "center",
                boxShadow: `0 20px 50px ${n.color}40`,
                scale: p,
              }}
            >
              <Icon kind={n.icon} size={62} color={n.color} />
              <div
                style={{
                  position: "absolute",
                  top: 158,
                  fontSize: 32,
                  fontWeight: 700,
                  color: C.ink,
                  whiteSpace: "nowrap",
                }}
              >
                {n.label}
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 960 - 130,
            top: 520,
            width: 260,
            textAlign: "center",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 3,
            color: C.muted,
            opacity: ramp(t, connects + 2.4, connects + 2.9) * (1 - ramp(t, prediction - 0.3, prediction)),
          }}
        >
          ONE CONNECTED MAP
        </div>
        <div
          style={{
            position: "absolute",
            left: 960 - 190,
            top: 505,
            width: 380,
            padding: "16px 0",
            borderRadius: 40,
            textAlign: "center",
            background: C.ink,
            color: "#fff",
            fontSize: 28,
            fontWeight: 650,
            boxShadow: "0 16px 40px #09284e40",
            scale: pop(prediction + 1.6, 9),
          }}
        >
          <span style={{ color: C.cyan }}>●</span> Right training examples
        </div>
        <Pulse at={prediction + 1.6} x={960} y={542} color={C.cyan} size={420} />
      </div>

      {/* Phase B — two separate lines */}
      <div style={{ position: "absolute", inset: 0, opacity: phaseB }}>
        {[
          { y: 430, label: "Product recommendations", n: role.productContacts, color: C.blue, icon: "tag", at: split },
          { y: 720, label: "General inquiries", n: role.inquiryContacts, color: C.mint, icon: "chat", at: split + 0.9 },
        ].map((lane, i) => (
          <div key={lane.label}>
            <div
              style={{
                position: "absolute",
                left: 600,
                top: lane.y + 54,
                width: 1200 * ramp(t, lane.at, lane.at + 0.8),
                height: 16,
                borderRadius: 8,
                background: lane.color,
              }}
            />
            {Array.from({ length: 7 }, (_, d) => (
              <div
                key={d}
                style={{
                  position: "absolute",
                  left: 600 + ((t * 220 + d * 180 + i * 90) % 1200),
                  top: lane.y + 48,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: "#fff",
                  border: `5px solid ${lane.color}`,
                  boxSizing: "border-box",
                  opacity: ramp(t, lane.at + 0.6, lane.at + 1),
                }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                left: 110,
                top: lane.y,
                width: 450,
                height: 124,
                borderRadius: 26,
                background: i ? "#e1f2ed" : C.blue,
                color: i ? "#11735f" : "#fff",
                padding: "18px 28px",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 22,
                scale: pop(lane.at - 0.2, 10),
                boxShadow: `0 18px 45px ${lane.color}35`,
              }}
            >
              <Icon kind={lane.icon} size={56} color={i ? "#11735f" : "#fff"} />
              <div>
                <div style={{ fontSize: 56, fontWeight: 750, lineHeight: 1 }}>{count(lane.n, lane.at)}</div>
                <div style={{ fontSize: 25, marginTop: 6 }}>{lane.label}</div>
              </div>
            </div>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: 640,
            right: 120,
            top: 640,
            borderTop: "5px dashed #f0a07f",
            opacity: ramp(t, never - 0.2, never + 0.2),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 1110,
            top: 608,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 26px 10px 16px",
            borderRadius: 40,
            background: "#fff1ea",
            border: "3px solid #f0a07f",
            color: "#b4532f",
            fontSize: 30,
            fontWeight: 700,
            scale: pop(never - 0.1, 8),
          }}
        >
          <Icon kind="x" size={32} color="#b4532f" /> Never mixed
        </div>
      </div>

      {/* Phase C — no peeking at the future */}
      <div style={{ position: "absolute", inset: 0, opacity: phaseC }}>
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 380,
            width: 830,
            height: 520,
            borderRadius: 34,
            background: "#e9f7f2",
            border: "2px solid #bfe5d6",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 980,
            top: 380,
            width: 830,
            height: 520,
            borderRadius: 34,
            background: "repeating-linear-gradient(135deg,#fff4e6 0 22px,#fdebd6 22px 44px)",
            border: "2px solid #f1cf9f",
            opacity: ramp(t, later - 0.3, later + 0.2),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 940,
            top: 340,
            width: 40,
            height: 600,
            display: "grid",
            justifyItems: "center",
          }}
        >
          <div style={{ width: 6, height: 600, borderRadius: 3, background: C.ink }} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 960 - 110,
            top: 300,
            width: 220,
            padding: "10px 0",
            borderRadius: 30,
            textAlign: "center",
            background: C.ink,
            color: "#fff",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            scale: pop(rule - 0.1, 9),
          }}
        >
          CONTACT
        </div>
        <div style={{ position: "absolute", left: 150, top: 410, fontSize: 26, fontWeight: 700, letterSpacing: 3, color: "#11735f" }}>
          ◀ BEFORE · MODEL INPUTS
        </div>
        {[
          ["eye", "Product interest"],
          ["bag", "Purchase history"],
          ["clock", "Purchase recency"],
        ].map(([icon, label], i) => (
          <div
            key={label}
            style={{
              position: "absolute",
              left: 150,
              top: 490 + i * 125,
              width: 520,
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "20px 28px",
              borderRadius: 22,
              background: "#fff",
              boxShadow: "0 12px 30px #11735f1c",
              fontSize: 34,
              fontWeight: 600,
              translate: `${(1 - pop(inputs - 1 + i * 0.25, 12)) * -120}px 0px`,
              opacity: ramp(t, inputs - 1 + i * 0.25, inputs - 0.8 + i * 0.25),
            }}
          >
            <Icon kind={icon} size={40} color="#11735f" />
            {label}
            <div style={{ marginLeft: "auto" }}>
              <Icon kind="check" size={36} color="#22b597" />
            </div>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            right: 150,
            top: 410,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            color: "#a46826",
            opacity: ramp(t, later - 0.2, later + 0.2),
          }}
        >
          AFTER · LABELS ONLY ▶
        </div>
        {[
          ["card", "Payment outcomes"],
          ["bag", `Retained basket · ${role.maturityDays}-day`],
        ].map(([icon, label], i) => (
          <div
            key={label}
            style={{
              position: "absolute",
              right: 150,
              top: 510 + i * 140,
              width: 600,
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "22px 28px",
              borderRadius: 22,
              background: "#fff",
              border: "2px solid #f1cf9f",
              boxShadow: "0 12px 30px #a4682620",
              fontSize: 33,
              fontWeight: 600,
              color: "#7a4e1e",
              translate: `${(1 - pop(later + i * 0.3, 12)) * 120}px 0px`,
              opacity: ramp(t, later + i * 0.3, later + 0.2 + i * 0.3),
            }}
          >
            <Icon kind={icon} size={40} color="#a46826" />
            {label}
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: 1060,
            top: 800,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 30,
            fontWeight: 700,
            color: "#a46826",
            scale: pop(labels, 8),
            transformOrigin: "left center",
          }}
        >
          <Icon kind="lock" size={40} color="#a46826" /> Never used as inputs
        </div>
      </div>
    </Stage>
  );
}
