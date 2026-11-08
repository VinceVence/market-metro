import { useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, HeroVideo, Note, ramp, useTime, usd, C } from "./Design";
export function Results() {
  const t = useTime(),
    { durationInFrames, fps } = useVideoConfig(),
    d = durationInFrames / fps,
    i = t < d * 0.375 ? 0 : t < d * 0.66 ? 1 : 2,
    at = [0, d * 0.375, d * 0.66][i];
  const cards = [
    ["+16", "retained purchases", "627 → 643"],
    [
      "+" + usd(data.vsFixed.merchants),
      "merchant contribution",
      "includes inventory",
    ],
    ["+3.47%", "modeled PayPal net", "+$114.96 after model cost"],
  ];
  return (
    <Stage label="Same market · vs fixed">
      <HeroVideo file="film-world" zoom={1.15} opacity={0.13} />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 170,
          fontSize: 34,
          fontWeight: 600,
          color: C.blue,
        }}
      >
        THE PAYOFF
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 310,
          translate: `0px ${(1 - ramp(t, at, at + 0.3)) * 40}px`,
          opacity: ramp(t, at, at + 0.2),
        }}
      >
        <div
          style={{
            fontSize: i === 1 ? 205 : 270,
            fontWeight: 700,
            letterSpacing: -12,
            color: i === 1 ? "#0a8f72" : C.blue,
            lineHeight: 1.2,
          }}
        >
          {cards[i][0]}
        </div>
        <div style={{ fontSize: 66, fontWeight: 600, marginTop: 15 }}>
          {cards[i][1]}
        </div>
        <div style={{ fontSize: 34, color: C.muted, marginTop: 28 }}>
          {cards[i][2]}
        </div>
      </div>
      <Note>One paired 12-store simulation · not production earnings</Note>
    </Stage>
  );
}
