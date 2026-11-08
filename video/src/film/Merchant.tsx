import { Stage, HeroVideo, Note, ramp, useTime, cue, C } from "./Design";
import { Person, Store } from "./StoryArt";
export function Merchant() {
  const t = useTime(),
    quiet = cue("market", "shopper", 3);
  return (
    <Stage label="A story from the simulated market">
      <HeroVideo file="film-world" zoom={1.04} opacity={0.1} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 825,
          height: 180,
          background: "#dce8f3",
        }}
      />
      <Store style={{ left: 80, top: 190, width: 1020, height: 737 }} />
      <Person
        role="merchant"
        style={{ left: 680, top: 450, width: 245, height: 426 }}
      />
      <div
        style={{
          position: "absolute",
          left: 1130,
          top: 500,
          width: 440,
          borderTop: "5px dashed #91b7d8",
          opacity: ramp(t, quiet, quiet + 0.5),
        }}
      />
      <Person
        style={{
          left: 1430 - 90 * ramp(t, quiet, quiet + 0.8),
          top: 440,
          width: 250,
          height: 435,
          opacity: ramp(t, quiet - 0.3, quiet + 0.35),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1530,
          top: 300,
          width: 130,
          height: 110,
          borderRadius: "28px 28px 28px 4px",
          background: "#fff",
          boxShadow: "0 12px 35px #10345614",
          display: "grid",
          placeItems: "center",
          fontSize: 64,
          color: C.muted,
          opacity: ramp(t, quiet + 0.4, quiet + 0.8),
        }}
      >
        …
      </div>
      <Note>Illustrated story · 12 shops · 600 simulated shoppers</Note>
    </Stage>
  );
}
