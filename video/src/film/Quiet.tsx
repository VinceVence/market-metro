import { Stage, Icon, Note, ramp, useTime, cue, C } from "./Design";
import { Person, Store } from "./StoryArt";
export function Quiet() {
  const t = useTime(),
    gap = cue("problem", "sixteen", 2),
    offer = cue("problem", "discount", 5),
    evidence = cue("problem", "evidence", 9);
  return (
    <Stage label="What would bring this shopper back?">
      <Store
        style={{ left: -260, top: 350, width: 820, height: 592, opacity: 0.18 }}
      />
      <Person style={{ left: 420, top: 420, width: 280, height: 487 }} />
      <div
        style={{
          position: "absolute",
          left: 900,
          top: 190,
          width: 470,
          height: 460,
          borderRadius: 32,
          background: "#fff",
          boxShadow: "0 25px 75px #143d6820",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 82,
            background: C.blue,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 31,
          }}
        >
          Since the last purchase
        </div>
        <div
          style={{
            fontSize: 235,
            lineHeight: 1.3,
            textAlign: "center",
            fontWeight: 700,
            color: C.ink,
          }}
        >
          {Math.round(16 * ramp(t, gap - 0.5, gap + 0.2))}
        </div>
        <div style={{ textAlign: "center", fontSize: 36, color: C.muted }}>
          days
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1470,
          top: 260,
          rotate: "8deg",
          width: 245,
          height: 180,
          borderRadius: 25,
          background: "#f9d08b",
          display: "flex",
          gap: 20,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 86,
          color: "#7d5421",
          opacity:
            ramp(t, offer - 0.3, offer + 0.2) *
            (1 - ramp(t, evidence - 0.8, evidence - 0.3)),
        }}
      >
        % ?
      </div>
      <div
        style={{
          position: "absolute",
          left: 895,
          top: 705,
          display: "flex",
          alignItems: "center",
          gap: 25,
          color: C.blue,
          opacity: ramp(t, evidence - 0.9, evidence - 0.4),
        }}
      >
        <Icon kind="data" size={65} />
        <span style={{ fontSize: 42, fontWeight: 600 }}>
          Start with evidence.
        </span>
      </div>
      <Note>
        Shopper 179 · market-wide purchase gap · illustrated choices, not extra
        campaign events
      </Note>
    </Stage>
  );
}
