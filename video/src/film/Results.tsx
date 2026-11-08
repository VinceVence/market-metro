import data from "../../public/data/case.json";
import { Stage, HeroVideo, Note, ramp, useTime, cue, usd, C } from "./Design";
export function Results() {
  const t = useTime();
  const cards = [
    [
      "+16",
      "retained purchases",
      "627 → 643",
      cue("impact", "sixteen", 3),
      C.blue,
    ],
    [
      "+" + usd(data.vsFixed.merchants),
      "merchant contribution",
      "includes inventory",
      cue("impact", "thousand", 6),
      "#0a8f72",
    ],
    [
      "+3.47%",
      "modeled PayPal net",
      "+$114.96 after model cost",
      cue("impact", "percent", 10),
      C.blue,
    ],
  ];
  return (
    <Stage label="Same frozen market · vs fixed">
      <HeroVideo file="film-world" zoom={1.1} opacity={0.09} />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 155,
          fontSize: 80,
          fontWeight: 650,
        }}
      >
        More purchases, measured.
      </div>
      {cards.map(([amount, label, detail, start, color], i) => (
        <div
          key={String(label)}
          style={{
            position: "absolute",
            left: 110 + i * 590,
            top: 410,
            width: 545,
            opacity: ramp(t, Number(start) - 0.4, Number(start) + 0.3),
            translate: `0px ${(1 - ramp(t, Number(start) - 0.4, Number(start) + 0.3)) * 35}px`,
          }}
        >
          <div
            style={{
              height: 8,
              borderRadius: 6,
              background: String(color),
              marginBottom: 26,
            }}
          />
          <div
            style={{
              fontSize: i === 1 ? 82 : 112,
              letterSpacing: -5,
              fontWeight: 700,
              color: String(color),
              minHeight: 160,
            }}
          >
            {amount}
          </div>
          <div style={{ fontSize: 38, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 27, color: C.muted, marginTop: 18 }}>
            {detail}
          </div>
        </div>
      ))}
      <Note>One paired 12-store simulation · not production earnings</Note>
    </Stage>
  );
}
